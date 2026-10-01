/**
 * 근거 문구(reasoning) 실행 스윕 — 고객에게 나가는 문구에 영문 라인명·라인 비율%가 없다.
 *
 * # 왜 (2026-09-24 사장님 "추천 박스가 70/30 으로 나온다, 우리 30% 는 없다")
 * reasoning.action/chipLabel/trigger 는 고객 재제안 화면(ApproveClient '왜 이렇게 제안했어요')과
 * 어드민 설문 기록에 그대로 렌더된다. "Weight 40% → 50%" 같은 문구는 임상 룰의 **내부 라인
 * 비율**이라 실제 박스(1종 100% / 2종 50:50)와 맞지 않고, 영문 라인명은 고객 문구 규칙에 어긋난다.
 * 규칙90(audit-rules)이 템플릿 소스를 잠그고, 여기는 실제로 룰을 넓게 발화시켜 결과 문자열을 본다 —
 * 조건부로만 발화하는 룰(응급 저체중·CKD 단계·대형견 퍼피·재제안 체크인 등)은 소스 정규식이 놓칠 수 있다.
 *
 * 허용하는 % : 칼로리(간식 5%·10% 이내), 영양소(지방 ≤14% DM), 급여 일정(1~3일 25%). 라인 비율은 금지.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { decideFirstBox } from './firstBox.ts'
import { decideNextBox } from './nextBox.ts'
import { gateAvailability } from './skuMap.ts'
import type { AlgorithmInput, Checkin, Formula, Reasoning } from './types.ts'
import type { FoodLine } from './types.ts'
import { ALL_LINES, FOOD_LINE_META } from './lines.ts'
import { collapseToSingle } from './boxComposition.ts'
import { finalizeReasoning, namedSoldLines } from './reasoning-final.ts'

// 영문 라인명(대문자) + 설문 키(소문자 — "선호 단백질: beef, salmon, pork, lamb" 처럼 trigger 에 그대로 새던 것).
const ENGLISH_LINE = /\b(Weight|Joint|Skin|Premium|Basic|Chicken|Duck|Pork|Beef|Salmon|chicken|duck|pork|beef|salmon|lamb)\b/
/** 라인 비율 표기 — 치환 전 실제로 있던 모양들. */
const LINE_PCT = /\d+%\s*→|→\s*\d+%|라인 \d+%|메인 \d+%|≥\s*\d+%|[+-]\d+%|↑\d+%|\d+%\s*\(단일|\d+% 위주|\d+% \/ |Weight\/Joint 0%/
/** % 가 남아 있어도 되는 문맥 — 칼로리·영양소·급여 일정. */
const PCT_OK = /칼로리|kcal|DM|지방|간식|\d일\+? ?\d+%|\d~\d일 \d+%|\d+% 이내/

function base(): AlgorithmInput {
  return {
    dogId: 'dog-1',
    dogName: '푸린',
    ageMonths: 36,
    weightKg: 5,
    neutered: true,
    activityLevel: 'medium',
    bcs: 5,
    allergies: [],
    chronicConditions: [],
    pregnancy: 'none',
    careGoal: 'general_upgrade',
    homeCookingExperience: 'occasional',
    currentDietSatisfaction: 4,
    weightTrend6mo: 'stable',
    giSensitivity: 'rare',
    preferredProteins: [],
    indoorActivity: 'moderate',
    dailyWalkMinutes: 30,
    pregnancyWeek: null,
    litterSize: null,
    expectedAdultWeightKg: null,
    irisStage: null,
    breed: null,
    dailyKcal: 280,
    dailyGrams: 200,
  }
}

const CHRONIC = [
  'diabetes', 'kidney', 'cardiac', 'pancreatitis', 'ibd', 'allergy_skin', 'arthritis', 'liver', 'dental',
  'epilepsy', 'urinary_stone', 'cognitive_decline', 'long_term_steroid', 'epi', 'hypothyroid', 'cushings',
  'patellar_luxation', 'ivdd', 'tracheal_collapse', 'mmvd', 'obesity',
]
const COMBOS: string[][] = [['kidney', 'arthritis'], ['allergy_skin', 'arthritis'], ['pancreatitis', 'obesity'], ['cardiac', 'kidney'], ['diabetes', 'pancreatitis']]

function* firstBoxInputs(): Generator<AlgorithmInput> {
  const ACT: Array<[AlgorithmInput['activityLevel'], number, AlgorithmInput['indoorActivity']]> = [['low', 10, 'calm'], ['medium', 30, 'moderate'], ['high', 90, 'active']]
  // 1) 체형 × 나이 × 체중 추세 × 활동 — 일반 룰 전부
  for (const bcs of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) for (const ageMonths of [5, 36, 110]) for (const weightTrend6mo of ['stable', 'gained', 'lost'] as const) for (const [activityLevel, dailyWalkMinutes, indoorActivity] of ACT) {
    yield { ...base(), bcs, ageMonths, weightTrend6mo, activityLevel, dailyWalkMinutes, indoorActivity, expectedAdultWeightKg: ageMonths < 12 ? 30 : null, treatReductionPct: 0.1 }
  }
  // 2) 질환 하나씩 × 체형 × 나이 (+ IRIS 단계)
  for (const c of [...CHRONIC.map((x) => [x]), ...COMBOS]) for (const bcs of [3, 5, 7] as const) for (const ageMonths of [36, 110]) {
    yield { ...base(), chronicConditions: c, bcs, ageMonths, irisStage: c.includes('kidney') ? 3 : null }
    if (c.includes('kidney')) yield { ...base(), chronicConditions: c, bcs, ageMonths, irisStage: 1 }
    if (c.includes('pancreatitis')) yield { ...base(), chronicConditions: c, bcs, ageMonths, diagnosedSeverity: { pancreatitis: 'severe' } }
  }
  // 3) 케어 목표 × 알레르기 × 선호 × 위장 민감 × v3 시드
  for (const careGoal of ['weight_management', 'skin_coat', 'joint_senior', 'allergy_avoid', 'general_upgrade'] as const)
    for (const allergies of [[], ['닭·칠면조'], ['소고기', '오리']]) for (const preferredProteins of [[], ['pork'], ['chicken', 'beef']]) for (const giSensitivity of ['rare', 'always'] as const) {
      yield { ...base(), careGoal, allergies, preferredProteins, giSensitivity }
      yield { ...base(), careGoal, allergies, preferredProteins, giSensitivity, baseRatiosOverride: { basic: 0, weight: 0.7, skin: 0, premium: 0, joint: 0.3 }, availableLines: ['basic', 'weight', 'premium', 'joint'] }
    }
  // 4) 품종 · 임신/수유 · 첫 화식
  for (const breed of ['프렌치 불독', '진돗개', '푸들', '시바', '요크셔테리어', '치와와', '골든 리트리버']) yield { ...base(), breed, bcs: 6 }
  yield { ...base(), pregnancy: 'pregnant', pregnancyWeek: 3, neutered: false }
  yield { ...base(), pregnancy: 'pregnant', pregnancyWeek: 8, neutered: false }
  yield { ...base(), pregnancy: 'lactating', litterSize: 5, neutered: false }
  yield { ...base(), homeCookingExperience: 'first', currentDietSatisfaction: 2 }
}

function checkin(checkpoint: 'week_2' | 'week_4', s: Partial<{ stool: number; coat: number; appetite: number; satisfaction: number }>): Checkin {
  return {
    cycleNumber: 1,
    checkpoint,
    stoolScore: (s.stool as Checkin['stoolScore']) ?? null,
    coatScore: (s.coat as Checkin['coatScore']) ?? null,
    appetiteScore: (s.appetite as Checkin['appetiteScore']) ?? null,
    overallSatisfaction: (s.satisfaction as Checkin['overallSatisfaction']) ?? null,
    respondedAt: '2026-06-01T00:00:00Z',
  }
}

function previousFormula(): Formula {
  return {
    lineRatios: { basic: 0.5, weight: 0.1, skin: 0.2, premium: 0.1, joint: 0.1 },
    toppers: { protein: 0, vegetable: 0.1 },
    reasoning: [],
    transitionStrategy: 'gradual',
    dailyKcal: 280,
    dailyGrams: 200,
    cycleNumber: 1,
    algorithmVersion: 'v1.0.0',
    userAdjusted: false,
  }
}

function offenders(rs: Reasoning[], where: string): string[] {
  const out: string[] = []
  for (const r of rs) {
    for (const [k, v] of [['action', r.action], ['chipLabel', r.chipLabel], ['trigger', r.trigger]] as const) {
      if (typeof v !== 'string') continue
      if (ENGLISH_LINE.test(v)) out.push(`${where} ${r.ruleId} ${k} 영문: ${v.slice(0, 90)}`)
      if (LINE_PCT.test(v)) out.push(`${where} ${r.ruleId} ${k} 라인비율: ${v.slice(0, 90)}`)
      if (/%/.test(v) && !PCT_OK.test(v)) out.push(`${where} ${r.ruleId} ${k} 허용 외 %: ${v.slice(0, 90)}`)
    }
  }
  return out
}

describe('근거 문구 스윕 — 영문 라인명·라인 비율% 없음', () => {
  it('첫 박스: 체형·나이·활동·질환·알레르기·선호·품종·임신 전 조합', () => {
    let runs = 0
    let chips = 0
    const bad: string[] = []
    const seenRules = new Set<string>()
    for (const input of firstBoxInputs()) {
      const f = decideFirstBox(input)
      runs++
      chips += f.reasoning.length
      for (const r of f.reasoning) if (r.ruleId) seenRules.add(r.ruleId)
      bad.push(...offenders(f.reasoning, `first(bcs${input.bcs},${input.chronicConditions.join('+') || '-'})`))
    }
    // 카나리아: 스윕이 실제로 넓게 발화했는지 — 룰 종류가 적으면 입력 격자가 깨진 것.
    assert.ok(runs >= 400, `실행 ${runs}회`)
    assert.ok(seenRules.size >= 40, `발화한 룰 종류 ${seenRules.size}개뿐 — 격자가 좁다`)
    assert.ok(chips >= 1500, `근거 칩 ${chips}개뿐`)
    assert.deepEqual([...new Set(bad)].slice(0, 12), [], `${bad.length}건:\n${[...new Set(bad)].slice(0, 12).join('\n')}`)
  })

  it('다음 박스: 2·4주차 변·털·식욕 체크인 조합 + 새 알레르기', () => {
    const bad: string[] = []
    let runs = 0
    for (const stool2 of [3, 5, 7]) for (const stool4 of [3, 6]) for (const coat of [2, 5]) for (const appetite of [2, 5])
      for (const allergies of [[], ['닭·칠면조']]) for (const preferredProteins of [[], ['pork']]) for (const cycleNumber of [2, 3]) {
        const f = decideNextBox({
          previousFormula: previousFormula(),
          checkins: [checkin('week_2', { stool: stool2 }), checkin('week_4', { stool: stool4, coat, appetite, satisfaction: 4 })],
          surveyInput: { ...base(), allergies, preferredProteins },
          cycleNumber,
        })
        runs++
        bad.push(...offenders(f.reasoning, `next(s${stool2}/${stool4},c${coat},a${appetite})`))
      }
    assert.ok(runs >= 100, `실행 ${runs}회`)
    assert.deepEqual([...new Set(bad)].slice(0, 12), [], `${bad.length}건:\n${[...new Set(bad)].slice(0, 12).join('\n')}`)
  })

  it('가용성 게이트: 준비 중 레시피 대체·토퍼 미오픈 문구', () => {
    const reasoning: Reasoning[] = []
    gateAvailability(
      { basic: 0.2, weight: 0.2, skin: 0.5, premium: 0.1, joint: 0 },
      { protein: 0.1, vegetable: 0.1 },
      { availableLines: ['basic', 'weight', 'premium', 'joint'], availableToppers: [], reasoning },
    )
    assert.ok(reasoning.length >= 2, '게이트 근거가 발화하지 않았다')
    assert.deepEqual(offenders(reasoning, 'gate'), [])
  })
})

// ── 2026-10-01 사장님 "연어라는 멘트 나오면 안 되는 거 알지? 아예 전부 안 나오게" · "오리 알러지인데 왜 오리가" ──
// 고객 화면 근거 문구에 판매하지 않는 연어가 한 번도 나오지 않고, 알레르기 레시피가 박스에 들어가지 않으며,
// 막힌 레시피·최종 박스에 없는 레시피를 약속하는 조정 문구가 남지 않는다 — compute 라우트와 같은 순서
// (decideFirstBox → 첫 박스 1종 접기 → finalizeReasoning)로 넓게 돌려 본다.
const SOLD: FoodLine[] = ['basic', 'weight', 'premium', 'joint']
const blockedOf = (allergies: string[]): Set<FoodLine> =>
  new Set(ALL_LINES.filter((l) => FOOD_LINE_META[l].blockingAllergies.some((a) => allergies.includes(a))))
const salmonIn = (rs: Reasoning[]) => rs.filter((r) => /연어/.test(`${r.trigger}${r.action}${r.chipLabel}`)).map((r) => `${r.ruleId}: ${r.chipLabel}`)

function* salmonDuckInputs(): Generator<AlgorithmInput> {
  // 기존 격자 전부 + 판매 라인 제한(연어 없음)
  for (const i of firstBoxInputs()) yield { ...i, availableLines: SOLD }
  // 펀치형: 닭·오리 알레르기 × 피부·인지 질환(연어 몫을 만드는 룰) × 위장 민감 × 선호(연어 포함/없음) × 나이
  for (const allergies of [['오리'], ['닭·칠면조', '오리', '계란'], ['소고기', '오리'], ['돼지고기'], ['연어·생선']])
    for (const chronicConditions of [[], ['allergy_skin'], ['cognitive_decline'], ['allergy_skin', 'arthritis']])
      for (const giSensitivity of ['rare', 'frequent', 'always'] as const)
        for (const preferredProteins of [[], ['salmon'], ['salmon', 'duck', 'beef'], ['pork']])
          for (const ageMonths of [7, 48, 110])
            yield { ...base(), allergies, chronicConditions, giSensitivity, preferredProteins, ageMonths, careGoal: 'skin_coat', availableLines: SOLD }
}

describe('연어 비노출 · 알레르기 레시피 비출고 · 근거↔박스 일치 (2026-10-01)', () => {
  it('첫 박스 — 라우트와 같은 순서로 넓게', () => {
    let runs = 0
    const bad: string[] = []
    for (const input of salmonDuckInputs()) {
      runs++
      const blocked = blockedOf(input.allergies)
      const f = decideFirstBox(input)
      const final = collapseToSingle(f.lineRatios, f.firstBoxLine ?? null)
      const rs = finalizeReasoning(f.reasoning, final, { blockedLines: blocked })
      const tag = `[${input.allergies.join('+') || '-'}|${input.chronicConditions.join('+') || '-'}|gi:${input.giSensitivity}|pref:${input.preferredProteins.join('+') || '-'}|${input.ageMonths}m]`
      for (const s of salmonIn(f.reasoning)) bad.push(`${tag} 엔진 출력에 연어: ${s}`)
      if ((final.skin ?? 0) > 0) bad.push(`${tag} 최종 박스에 연어 ${final.skin}`)
      // 판매 레시피 중 하나라도 먹을 수 있으면 알레르기 레시피는 박스에 없어야 한다(전부 막히면 라우트가 상담으로).
      if (SOLD.some((l) => !blocked.has(l))) {
        for (const l of blocked) if ((final[l] ?? 0) > 0) bad.push(`${tag} 알레르기 레시피 ${FOOD_LINE_META[l].nameKo} 출고 ${final[l]}`)
        for (const l of blocked) if ((f.lineRatios[l] ?? 0) > 0) bad.push(`${tag} 접기 전 비율에도 알레르기 ${FOOD_LINE_META[l].nameKo} ${f.lineRatios[l]}`)
      }
      for (const r of rs) {
        if (r.promisedLines && !r.promisedLines.some((l) => (final[l] ?? 0) > 0)) bad.push(`${tag} 박스에 없는 레시피 약속: ${r.chipLabel}`)
        if (!/^(next-)?allergy-/.test(r.ruleId)) for (const l of blocked) if (`${r.action}${r.chipLabel}`.includes(FOOD_LINE_META[l].nameKo)) bad.push(`${tag} 막힌 ${FOOD_LINE_META[l].nameKo} 언급: ${r.ruleId} ${r.chipLabel}`)
      }
    }
    assert.ok(runs >= 1200, `실행 ${runs}회 — 격자가 좁다`)
    assert.deepEqual([...new Set(bad)].slice(0, 15), [], `${bad.length}건:\n${[...new Set(bad)].slice(0, 15).join('\n')}`)
  })

  it('다음 박스(재제안) — 연어 선호·오리 알레르기에도 연어·막힌 레시피를 말하지 않는다', () => {
    const bad: string[] = []
    for (const allergies of [[], ['오리'], ['닭·칠면조', '오리']]) for (const preferredProteins of [[], ['salmon'], ['salmon', 'duck', 'beef']])
      for (const appetite of [2, 5]) for (const coat of [2, 5]) {
        const blocked = blockedOf(allergies)
        const f = decideNextBox({
          previousFormula: previousFormula(),
          checkins: [checkin('week_4', { appetite, coat, stool: 4 })],
          surveyInput: { ...base(), allergies, preferredProteins, availableLines: SOLD },
          cycleNumber: 2,
        })
        for (const s of salmonIn(f.reasoning)) bad.push(`next[${allergies}|${preferredProteins}] 연어: ${s}`)
        if ((f.lineRatios.skin ?? 0) > 0) bad.push(`next[${allergies}] 연어 비율 ${f.lineRatios.skin}`)
        for (const l of blocked) if ((f.lineRatios[l] ?? 0) > 0) bad.push(`next[${allergies}] 알레르기 ${FOOD_LINE_META[l].nameKo} ${f.lineRatios[l]}`)
      }
    assert.deepEqual([...new Set(bad)].slice(0, 12), [], `${bad.length}건:\n${[...new Set(bad)].slice(0, 12).join('\n')}`)
  })
})

// ── 2026-10-01 사장님 "박스에 없는 레시피를 말하는 칩은 지워. 앞으로도 이런 헷갈리는 일 없게" ──
// 피카(3개월 자견, 오리 100% 박스) 근거에 '맞춤 베이스 · 베이스 레시피: 치킨'이 떴다. 임상 룰이 여러 레시피 비율을
// 옮기며 남긴 설명이, 첫 박스를 한 가지로 접은 뒤에도 남아 있었다(조합 9,261개 중 64종).
// 최종 근거의 판매 레시피 이름은 박스에 있거나 그 문구가 '뺐다'고 말하는 것이어야 한다.
// 안전 안내(당뇨·심장·응급 저체중 등)는 레시피 문장이 빠져도 사라지지 않는다.
const ALLERGY_RULE_ID = /^(next-)?allergy-/
function boxMismatches(rs: Reasoning[], final: Partial<Record<FoodLine, number>>, tag: string): string[] {
  const inBox = new Set(ALL_LINES.filter((l) => (final[l] ?? 0) > 0))
  const out: string[] = []
  for (const r of rs) {
    if (ALLERGY_RULE_ID.test(r.ruleId)) continue
    const excluded = r.excludedLines ?? []
    for (const l of namedSoldLines(r)) {
      if (!inBox.has(l) && !excluded.includes(l)) out.push(`${tag} 박스에 없는 ${FOOD_LINE_META[l].nameKo}: ${r.ruleId} | ${r.chipLabel} | ${r.action}`)
    }
    for (const l of excluded) if (inBox.has(l)) out.push(`${tag} 뺐다는 ${FOOD_LINE_META[l].nameKo}가 박스에: ${r.ruleId}`)
  }
  return out
}
/** 레시피 이야기가 빠져도 반드시 남아야 하는 안전 안내 — 이름으로 고정한다(withoutRecipe 를 지우면 검사도 같이 빠지지 않게). */
const SAFETY_RULES = new Set([
  'chronic-diabetes', 'chronic-cardiac', 'chronic-epi', 'chronic-hypothyroid', 'chronic-cushings',
  'chronic-musculoskeletal', 'chronic-long-term-steroid', 'bcs-refeeding-risk', 'age-puppy-large-breed',
  'chronic-kidney', 'chronic-kidney-early', 'chronic-kidney-stage3', 'chronic-kidney-stage4', 'chronic-hepatic', 'chronic-urinary-stone',
])
const V3_SEEDS: Array<Record<FoodLine, number>> = [
  { basic: 0, weight: 1, skin: 0, premium: 0, joint: 0 },
  { basic: 0, weight: 0, skin: 0, premium: 1, joint: 0 },
  { basic: 0, weight: 0, skin: 0, premium: 0, joint: 1 },
  { basic: 0.5, weight: 0, skin: 0, premium: 0.5, joint: 0 },
]

describe('근거 칩 ↔ 최종 박스 — 박스에 없는 레시피를 말하지 않는다 (2026-10-01 피카)', () => {
  it('마지막 그물: 표시(promisedLines)가 없는 새 문구도 박스에 없는 레시피 이름이면 빠지고, 뺐다는 문구·알레르기 문구는 남는다', () => {
    const box = { basic: 1, weight: 0, skin: 0, premium: 0, joint: 0 }
    const r = (ruleId: string, action: string, extra: Partial<Reasoning> = {}): Reasoning => ({ trigger: 't', action, chipLabel: 'c', priority: 3, ruleId, ...extra })
    const out = finalizeReasoning([
      r('new-rule', '고단백 레시피(한우) 비중을 올렸어요'),
      r('new-rule-ok', '오리 레시피로 담았어요'),
      r('chronic-x', '한우 레시피는 뺐어요', { excludedLines: ['premium'] }),
      r('chronic-y', '치킨 레시피는 뺐어요', { excludedLines: ['basic'] }),
      r('allergy-premium', '한우 레시피는 제외했어요'),
      r('goal-x', '베이스 레시피: 치킨 · 오리 · 한우'),
    ], box)
    assert.deepEqual(out.map((x) => `${x.ruleId}:${x.action}`), [
      'new-rule-ok:오리 레시피로 담았어요',
      'chronic-x:한우 레시피는 뺐어요',
      'allergy-premium:한우 레시피는 제외했어요',
      'goal-x:베이스 레시피: 오리',
    ])
    // new-rule(박스에 없는 한우를 올렸다) · chronic-y(뺐다는 오리가 박스에 있다)는 빠진다.
  })

  it('피카 재현: 엔진 초안 치킨 + 3개월 자견 → 오리 박스에 치킨 근거가 없다', () => {
    const input: AlgorithmInput = { ...base(), ageMonths: 3, weightKg: 5.1, baseRatiosOverride: V3_SEEDS[0], availableLines: SOLD, treatReductionPct: 0.1 }
    const f = decideFirstBox(input)
    const final = collapseToSingle(f.lineRatios, f.firstBoxLine ?? null)
    const rs = finalizeReasoning(f.reasoning, final, { blockedLines: [] })
    assert.equal(final.basic, 1, '전제: 피카처럼 오리 한 가지 박스')
    assert.ok(f.reasoning.some((r) => r.chipLabel === '맞춤 베이스' && r.action.includes('치킨')), '전제: 엔진 초안이 치킨 베이스 문구를 낸다')
    assert.ok(!rs.some((r) => `${r.action}${r.chipLabel}`.includes('치킨')), '오리 박스 근거에 치킨이 남았다')
    const puppy = rs.find((r) => r.ruleId === 'age-puppy')
    assert.ok(puppy, '성장기 설명은 남아야 한다')
    assert.ok(!puppy.action.includes('한우'), `박스에 없는 한우를 말한다: ${puppy.action}`)
  })

  it('첫 박스 — 라우트 순서(엔진 → 1종 접기 → 최종 정리)로 넓게, 안전 안내는 살아남는다', () => {
    let runs = 0
    const bad: string[] = []
    function* inputs(): Generator<AlgorithmInput> {
      // 엔진 초안(v3 베이스)을 바꿔 가며 — 같은 임상 룰이어도 첫 박스가 다른 레시피로 접힌다(피카: 치킨 초안 → 오리).
      for (const i of salmonDuckInputs()) {
        yield i
        for (const seed of V3_SEEDS) yield { ...i, baseRatiosOverride: seed }
      }
    }
    for (const input of inputs()) {
      runs++
      const blocked = blockedOf(input.allergies)
      const f = decideFirstBox(input)
      const final = collapseToSingle(f.lineRatios, f.firstBoxLine ?? null)
      const rs = finalizeReasoning(f.reasoning, final, { blockedLines: blocked })
      const tag = `[${input.allergies.join('+') || '-'}|${input.chronicConditions.join('+') || '-'}|${input.ageMonths}m|bcs${input.bcs}]`
      bad.push(...boxMismatches(rs, final, tag))
      for (const r of f.reasoning) {
        if ((r.withoutRecipe || SAFETY_RULES.has(r.ruleId)) && !rs.some((x) => x.ruleId === r.ruleId)) bad.push(`${tag} 안전 안내가 사라졌다: ${r.ruleId}`)
      }
    }
    assert.ok(runs >= 1500, `실행 ${runs}회 — 격자가 좁다`)
    assert.deepEqual([...new Set(bad)].slice(0, 15), [], `${bad.length}건:\n${[...new Set(bad)].slice(0, 15).join('\n')}`)
  })

  it('다음 박스(재제안) — 체크인·알레르기·선호 조합에서도 박스에 없는 레시피를 말하지 않는다', () => {
    const bad: string[] = []
    let runs = 0
    for (const stool2 of [3, 6]) for (const stool4 of [3, 6]) for (const appetite of [2, 5]) for (const coat of [2, 5])
      for (const allergies of [[], ['닭·칠면조'], ['오리']]) for (const preferredProteins of [[], ['pork'], ['duck']]) {
        const blocked = blockedOf(allergies)
        const f = decideNextBox({
          previousFormula: previousFormula(),
          checkins: [checkin('week_2', { stool: stool2 }), checkin('week_4', { stool: stool4, coat, appetite, satisfaction: 4 })],
          surveyInput: { ...base(), allergies, preferredProteins, availableLines: SOLD },
          cycleNumber: 2,
        })
        runs++
        bad.push(...boxMismatches(f.reasoning, f.lineRatios, `next[s${stool2}/${stool4}|a${appetite}|${allergies}|${preferredProteins}]`))
        for (const r of f.reasoning) for (const l of blocked) if (!ALLERGY_RULE_ID.test(r.ruleId) && `${r.action}${r.chipLabel}`.includes(FOOD_LINE_META[l].nameKo) && !(r.excludedLines ?? []).includes(l)) bad.push(`next 막힌 ${FOOD_LINE_META[l].nameKo}: ${r.ruleId}`)
      }
    assert.ok(runs >= 100, `실행 ${runs}회`)
    assert.deepEqual([...new Set(bad)].slice(0, 12), [], `${bad.length}건:\n${[...new Set(bad)].slice(0, 12).join('\n')}`)
  })
})
