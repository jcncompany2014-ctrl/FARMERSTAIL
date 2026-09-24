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
