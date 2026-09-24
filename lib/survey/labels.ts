/**
 * 설문 답변·분석·추천 박스 → 사람이 읽는 한글 라벨 (어드민 "설문 기록" 화면용).
 *
 * # 왜 (2026-09-24 사장님)
 * 고객이 "이게 맞는지 모르겠다"며 분석 캡처를 보내왔는데, 어드민엔 그 고객이 설문에
 * 뭐라고 답했는지 볼 화면이 없었다(DB 를 직접 열어야 했다). 답변 JSON 은 영어 키
 * ('slight_pressure', 'weight_management'…)라 그대로 보여주면 사장님도 못 읽는다.
 * 여기서 **설문 3세대(앱 v4 · 앱 v3 · 웹 1분 설문)** 의 answers 를 전부 같은 모양의
 * 한글 섹션으로 바꾼다. React 를 모르는 순수 함수 — 테스트: lib/survey/labels.test.ts.
 *
 * 라벨 문구는 설문 화면(app/(main)/dogs/[id]/survey/steps, app/start/StartSurvey.tsx)의
 * 선택지 문구와 같게 둔다 — 고객이 누른 글자 그대로 사장님이 본다.
 */
import { CHRONIC_CONDITION_LABELS } from '../nutrition/guidelines.ts'

export type LabelTone = 'warn' | 'good' | 'muted'
export type LabelItem = { label: string; value: string; tone?: LabelTone }
export type LabelSection = { title: string; items: LabelItem[] }

/** surveys 행의 컬럼 중 답변 표시에 필요한 것(answers JSON 밖에 저장되는 값). */
export type SurveyRowMeta = {
  iris_stage?: number | null
  expected_adult_weight_kg?: number | string | null
  pregnancy_week?: number | null
  litter_size?: number | null
  current_medications?: string[] | null
  daily_walk_minutes?: number | null
  current_food_brand?: string | null
  /** dogs.prescription_diet — 설문이 아니라 강아지 행에 저장된다. */
  prescription_diet?: string | null
}

export type SurveyOrigin = 'app_v4' | 'app_v3' | 'web'
export const ORIGIN_LABEL: Record<SurveyOrigin, string> = {
  app_v4: '앱 설문 (화면당 질문 하나)',
  app_v3: '앱 설문 (이전 버전)',
  web: '웹 1분 설문',
}

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null
}
function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return null
}
function strs(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []
}
function pick<T extends Record<string, string>>(map: T, v: unknown): string | null {
  return typeof v === 'string' && v in map ? map[v]! : null
}

// ── 선택지 문구 (설문 화면과 동일) ──────────────────────────────────────────
const RIBS = { visible: '안 만져도 보여요', easy: '살짝 만지면 느껴져요', slight_pressure: '꾹 눌러야 느껴져요', hard: '눌러도 잘 안 느껴져요' }
const WAIST = { clear: '잘록하게 들어가요', slight: '살짝 들어가요', none: '일자거나 볼록해요' }
const ABDOMEN = { tucked: '위로 올라가요', level: '거의 일자예요', sagging: '아래로 처져요' }
export const BODY_CONDITION = { skinny: '많이 말랐어요', slim: '약간 말랐어요', ideal: '적당해요', chubby: '약간 통통해요', obese: '많이 통통해요' }
const WEIGHT_TREND = { stable: '비슷해요', gained: '늘었어요', lost: '빠졌어요', unknown: '잘 모름' }
const BRISTOL: Record<string, string> = { '1': '딱딱한 알갱이 (심한 변비)', '2': '딱딱한 편 (변비)', '3': '겉이 갈라짐 (경계)', '4': '적당해요 (이상적)', '5': '부드러운 덩어리 (경계)', '6': '조금 무른 편', '7': '물설사 같아요' }
const GI = { rare: '거의 없음', sometimes: '가끔', frequent: '자주', always: '매번' }
const WEB_FOOD = { kibble: '사료 (건식)', fresh: '화식·자연식', mix: '사료 + 토핑', unknown: '잘 모르겠어요' }
const COOKING = { first: '처음이에요', occasional: '가끔 (한 달에 1~2번)', frequent: '자주 (일주일에 1번 이상)' }
const PROTEIN_KR: Record<string, string> = { chicken: '닭/칠면조', duck: '오리', beef: '소고기', salmon: '연어/생선', pork: '돼지고기', lamb: '양고기' }
const WEB_ALLERGY_KR: Record<string, string> = { chicken: '닭', beef: '소', duck: '오리', salmon: '연어', lamb: '양', pork: '돼지' }
const WEB_HEALTH_KR: Record<string, string> = { joint: '관절', skin: '피부·털', digest: '소화', dental: '치아', weight: '체중' }
const CARE_GOAL = { weight_management: '체중 관리', skin_coat: '피부·털 개선', joint_senior: '관절·시니어 케어', allergy_avoid: '알레르기·민감 피하기', general_upgrade: '골고루 건강하게' }
const INDOOR = { calm: '차분해요', moderate: '보통이에요', active: '활발해요' }
const VIGOROUS = { none: '안 해요', self_report: '해요 (느낌상)', objective: '해요 (앱·시계로 기록)' }
const HOUSING = { indoor: '실내', indoor_outdoor: '실내 + 마당', outdoor: '실외' }
const PREGNANCY = { none: '해당 없음', pregnant: '임신 중', lactating: '수유 중' }
const PANCREATITIS = { moderate: '만성 · 관리 중', severe: '급성 · 중증' }
const COAT = { healthy: '건강', dull: '푸석', shedding: '심한 탈모', itchy: '가려움', lesions: '상처·염증' }
const APPETITE = { strong: '뭐든 잘 먹어요', normal: '보통이에요', picky: '까다로워요', reduced: '식욕이 줄었어요' }
const CONFLICT = { weight_down_bcs_up: '체중은 줄었는데 체형은 통통해짐', weight_up_bcs_down: '체중은 늘었는데 체형은 말라짐' }

const WALK: Record<string, string> = { '0': '거의 안 가요', '30': '하루 1번', '60': '하루 2번 이상' }
function walkLabel(min: number | null): string | null {
  if (min === null) return null
  return WALK[String(min)] ?? `하루 ${min}분`
}

/** 이 answers 가 어느 설문 화면에서 왔나. */
export function surveyOrigin(answers: unknown): SurveyOrigin {
  const a = rec(answers)
  if (num(a.surveyVersion) === 4) return 'app_v4'
  // 웹 라이트 설문은 체형 5지선다(bodyCondition)만 있고 체형 3분해·케어 목표가 없다.
  if (a.bcsExact == null && !('bodyAssessment' in a) && !('careGoal' in a)) return 'web'
  return 'app_v3'
}

/** 설문 답변 전체 → 한글 섹션. 없는 답은 빼고, 값이 있는 것만 보여준다. */
export function describeSurvey(answers: unknown, meta: SurveyRowMeta = {}): LabelSection[] {
  const a = rec(answers)
  const origin = surveyOrigin(a)
  const body = rec(a.bodyAssessment)
  const out: LabelSection[] = []
  const push = (title: string, items: Array<LabelItem | null>) => {
    const real = items.filter((x): x is LabelItem => x !== null)
    if (real.length) out.push({ title, items: real })
  }
  const item = (label: string, value: string | null, tone?: LabelTone): LabelItem | null =>
    value === null ? null : { label, value, tone }

  // 몸
  const bcs = num(a.bcsExact)
  const cond = pick(BODY_CONDITION, a.bodyCondition)
  push('몸 상태', [
    item('갈비뼈', pick(RIBS, body.ribs)),
    item('허리', pick(WAIST, body.waist)),
    item('배', pick(ABDOMEN, body.abdomen)),
    item(
      '체형',
      bcs !== null ? `${bcs}단계 (9단계 중)${cond ? ` · ${cond}` : ''}` : cond,
      bcs !== null && (bcs <= 3 || bcs >= 7) ? 'warn' : undefined,
    ),
    item('최근 6개월 체중', pick(WEIGHT_TREND, a.weightTrend6mo), a.weightTrend6mo === 'lost' || a.weightTrend6mo === 'gained' ? 'warn' : undefined),
    item('살이 잘 찌는 편', a.isEasyKeeper === true ? '네, 쉽게 쪄요' : a.isEasyKeeper === false ? '아니요' : null),
    item('체중↔체형 모순', pick(CONFLICT, a.bcsWeightConflict), 'warn'),
    item('예상 성견 체중', num(meta.expected_adult_weight_kg) !== null ? `${num(meta.expected_adult_weight_kg)} kg` : null),
    item('근육 상태(옛 설문)', num(a.mcsScore) !== null ? `${num(a.mcsScore)} / 4` : null),
  ])

  // 소화
  const bristol = num(a.bristolScore)
  push('소화', [
    item('변 상태', bristol !== null ? BRISTOL[String(bristol)] ?? `${bristol} / 7` : null, bristol !== null && (bristol <= 2 || bristol >= 6) ? 'warn' : undefined),
    item('사료 바꿀 때 무른 변', pick(GI, a.giSensitivity), a.giSensitivity === 'frequent' || a.giSensitivity === 'always' ? 'warn' : undefined),
  ])

  // 식사
  const treat = num(a.treatKcalPerDay)
  const kibble100 = num(a.kibbleKcalPer100g)
  push('식사', [
    item('주식', origin === 'web' ? (pick(WEB_FOOD, a.foodType) ?? str(a.foodType)) : str(a.foodType)),
    item('간식', str(a.snackFreq)),
    item('하루 간식 칼로리', treat !== null ? `${treat} kcal` : null),
    item('화식 경험', pick(COOKING, a.homeCookingExperience)),
    item('입맛(옛 설문)', pick(APPETITE, a.appetite)),
    item('지금 먹는 사료', str(meta.current_food_brand) ?? str(a.currentFoodBrand)),
    item('사료 열량', kibble100 !== null ? `${Math.round(kibble100 * 10)} kcal/kg` : null),
  ])

  // 알레르기·선호
  const allergies = strs(a.allergies).map((x) => WEB_ALLERGY_KR[x] ?? x)
  const proteins = strs(a.preferredProteins).map((x) => PROTEIN_KR[x] ?? x)
  push('알레르기', [
    item('피해야 할 재료', allergies.length ? allergies.join(' · ') : 'allergies' in a ? '없음' : null, allergies.length ? 'warn' : 'good'),
    item('잘 먹는 고기', proteins.length ? proteins.join(' · ') : null),
  ])

  // 건강
  const conds = strs(a.chronicConditions).map((k) => (CHRONIC_CONDITION_LABELS as Record<string, string>)[k] ?? k)
  const sev = rec(a.diagnosedSeverity)
  const meds = meta.current_medications && meta.current_medications.length ? meta.current_medications : strs(a.currentMedications)
  const concerns = strs(a.healthConcerns).map((x) => WEB_HEALTH_KR[x] ?? x)
  push('건강', [
    item('진단받은 질환', conds.length ? conds.join(' · ') : 'chronicConditions' in a ? '없음' : null, conds.length ? 'warn' : 'good'),
    item('신장질환 단계', meta.iris_stage != null ? `${meta.iris_stage}단계` : null, 'warn'),
    item('췌장염 상태', pick(PANCREATITIS, sev.pancreatitis), 'warn'),
    item('처방식', str(meta.prescription_diet)),
    item('먹는 약·보충제', meds.length ? meds.join(' / ') : null, meds.length ? 'warn' : undefined),
    item('임신·수유', pick(PREGNANCY, a.pregnancyStatus)),
    item('임신 주차', meta.pregnancy_week != null ? `${meta.pregnancy_week}주차` : num(a.pregnancyWeek) !== null ? `${num(a.pregnancyWeek)}주차` : null),
    item('새끼 수', meta.litter_size != null ? `${meta.litter_size}마리` : num(a.litterSize) !== null ? `${num(a.litterSize)}마리` : null),
    item('모질·피부(옛 설문)', pick(COAT, a.coatCondition)),
    item('관심사(웹 설문)', concerns.length ? concerns.join(' · ') : null),
  ])

  // 생활
  const walk = meta.daily_walk_minutes ?? num(a.dailyWalkMinutes)
  push('생활', [
    item('하루 산책', walkLabel(walk)),
    item('산책 외 실내 활동', pick(INDOOR, a.indoorActivity)),
    item('격한 운동', pick(VIGOROUS, a.vigorousExercise)),
    item('사는 곳', pick(HOUSING, a.housing)),
    item('겨울에도 밖에서', a.coldExposure === true ? '네' : a.coldExposure === false ? '아니요' : null),
  ])

  // 목표·기타
  push('케어 목표', [
    item('가장 신경 쓰고 싶은 것', pick(CARE_GOAL, a.careGoal)),
    item('추가 질문 4개', a.optionalSkipped === true ? '건너뜀 (관문에서 "건너뛰고 결과 보기")' : origin === 'app_v4' ? '답함' : null, a.optionalSkipped === true ? 'muted' : undefined),
  ])

  return out
}

/** 목록용 요약 칩 — 한 줄에 들어갈 5~6개. */
export function surveyChips(answers: unknown, meta: SurveyRowMeta = {}): string[] {
  const a = rec(answers)
  const chips: string[] = []
  const bcs = num(a.bcsExact)
  const cond = pick(BODY_CONDITION, a.bodyCondition)
  if (bcs !== null) chips.push(`체형 ${bcs}/9`)
  else if (cond) chips.push(`체형 ${cond}`)
  const trend = pick(WEIGHT_TREND, a.weightTrend6mo)
  if (trend && a.weightTrend6mo !== 'unknown') chips.push(`체중 ${trend}`)
  const food = surveyOrigin(a) === 'web' ? pick(WEB_FOOD, a.foodType) ?? str(a.foodType) : str(a.foodType)
  if (food) chips.push(food)
  const allergies = strs(a.allergies)
  if (allergies.length) chips.push(`알레르기 ${allergies.length}`)
  const conds = strs(a.chronicConditions)
  if (conds.length) chips.push(`질환 ${conds.length}`)
  const meds = meta.current_medications?.length ?? strs(a.currentMedications).length
  if (meds) chips.push(`약 ${meds}`)
  const goal = pick(CARE_GOAL, a.careGoal)
  if (goal) chips.push(goal)
  return chips
}

// ── 분석 ────────────────────────────────────────────────────────────────────
export type AnalysisLike = {
  rer?: number | string | null
  mer?: number | string | null
  factor?: number | string | null
  factor_breakdown?: unknown
  feed_g?: number | string | null
  bcs_score?: number | null
  stage?: string | null
  protein_pct?: number | string | null
  fat_pct?: number | string | null
  carb_pct?: number | string | null
  risk_flags?: unknown
  vet_consult_recommended?: boolean | null
  supplements?: unknown
  next_review_date?: string | null
}

const RISK_KR: Record<string, string> = {
  STEROID_SIDE_EFFECTS: '스테로이드 부작용 주의',
  SKIN_BARRIER_COMPROMISED: '피부 장벽 손상',
  MUSCLE_LOSS: '근손실',
  CHRONIC_CONFLICT: '질환 간 상충',
  TREAT_EXCESS: '간식 과다',
}

export type AnalysisSummary = {
  rer: number | null
  mer: number | null
  factor: number | null
  /** 계수 사다리 — "기본 1.4", "쉽게 찌는 체질 −0.1" 같은 줄. */
  ladder: Array<{ label: string; delta: number }>
  feedG: number | null
  bcs: number | null
  stage: string | null
  macros: string | null
  riskFlags: string[]
  vetConsult: boolean
  supplements: string[]
  nextReview: string | null
}

export function describeAnalysis(a: AnalysisLike | null | undefined): AnalysisSummary | null {
  if (!a) return null
  const ladder: Array<{ label: string; delta: number }> = []
  if (Array.isArray(a.factor_breakdown)) {
    for (const row of a.factor_breakdown) {
      const r = rec(row)
      const label = str(r.label)
      const delta = num(r.delta)
      if (label && delta !== null) ladder.push({ label, delta })
    }
  }
  const p = num(a.protein_pct), f = num(a.fat_pct), c = num(a.carb_pct)
  return {
    rer: num(a.rer),
    mer: num(a.mer),
    factor: num(a.factor),
    ladder,
    feedG: num(a.feed_g),
    bcs: a.bcs_score ?? null,
    stage: str(a.stage),
    macros: p !== null && f !== null ? `단백질 ${p}% · 지방 ${f}%${c !== null ? ` · 탄수화물 ${c}%` : ''}` : null,
    riskFlags: strs(a.risk_flags).map((k) => RISK_KR[k] ?? k),
    vetConsult: a.vet_consult_recommended === true,
    supplements: strs(a.supplements),
    nextReview: str(a.next_review_date),
  }
}

// ── 추천 박스 (dog_formulas) ─────────────────────────────────────────────────
/** 라인 → 단백질. 정본은 lib/personalization/skuModel.ts LEGACY_LINE_TO_PROTEIN (표시용 복제). */
const LINE_TO_PROTEIN: Record<string, string> = { basic: 'duck', weight: 'chicken', skin: 'salmon', premium: 'beef', joint: 'pork' }
const RECIPE_KR: Record<string, string> = { chicken: '치킨', duck: '오리', beef: '한우', pork: '흑돼지', salmon: '연어' }

export type FormulaRowLike = {
  formula?: unknown
  reasoning?: unknown
  daily_kcal?: number | null
  daily_grams?: number | null
  computed_at?: string | null
  algorithm_version?: string | null
  approval_status?: string | null
  user_adjusted?: boolean | null
  cycle_number?: number | null
}

export type BoxSummary = {
  picks: Array<{ name: string; protein: string; ratio: number; kcalPer100g: number | null; claims: string[] }>
  dailyKcal: number | null
  dailyGrams: number | null
  chips: string[]
  reasons: Array<{ chip: string; action: string; trigger: string }>
  trace: string[]
  waitlist: string[]
  needsConsultation: boolean
  computedAt: string | null
  algorithmVersion: string | null
  approvalStatus: string | null
  userAdjusted: boolean
  cycle: number | null
}

export function describeBox(row: FormulaRowLike | null | undefined): BoxSummary | null {
  if (!row) return null
  const f = rec(row.formula)
  const v3 = rec(f.v3)
  const layerA = rec(v3.layerA)
  const layerB = rec(v3.layerB)
  const picks: BoxSummary['picks'] = []
  if (Array.isArray(layerA.picks)) {
    for (const p of layerA.picks) {
      const r = rec(p)
      const protein = str(r.protein) ?? ''
      const ratio = num(r.ratio) ?? 0
      picks.push({
        name: str(r.nameKr) ?? RECIPE_KR[protein] ?? protein,
        protein,
        ratio,
        kcalPer100g: num(r.kcalPer100g),
        claims: Array.isArray(r.claims) ? r.claims.map((c) => str(rec(c).text)).filter((x): x is string => !!x) : [],
      })
    }
  }
  if (picks.length === 0) {
    // v3 layer 가 없는 옛 처방 — lineRatios 에서 상위 2개(50:50) 또는 1개(100%).
    const lr = rec(f.lineRatios)
    const nonZero = Object.entries(lr)
      .map(([line, r]) => ({ line, ratio: num(r) ?? 0 }))
      .filter((x) => x.ratio > 0)
      .sort((a, b) => b.ratio - a.ratio)
    const top = nonZero.slice(0, 2)
    const snapped = top.length >= 2 && top[1]!.ratio >= 0.3 ? top.map((t) => ({ ...t, ratio: 0.5 })) : top.slice(0, 1).map((t) => ({ ...t, ratio: 1 }))
    for (const t of snapped) {
      const protein = LINE_TO_PROTEIN[t.line] ?? t.line
      picks.push({ name: RECIPE_KR[protein] ?? protein, protein, ratio: t.ratio, kcalPer100g: null, claims: [] })
    }
  }
  const reasons: BoxSummary['reasons'] = []
  if (Array.isArray(row.reasoning)) {
    for (const r of row.reasoning) {
      const x = rec(r)
      const chip = str(x.chipLabel)
      const action = str(x.action) ?? ''
      if (chip) reasons.push({ chip, action, trigger: str(x.trigger) ?? '' })
    }
  }
  const trace = Array.isArray(layerA.trace)
    ? layerA.trace.map((t) => { const x = rec(t); const s = str(x.step); const d = str(x.detail); return s && d ? `${s}: ${d}` : null }).filter((x): x is string => !!x)
    : []
  const waitlist = strs(layerB.waitlistConcerns)
  return {
    picks,
    dailyKcal: row.daily_kcal ?? num(layerA.dailyKcal),
    dailyGrams: row.daily_grams ?? num(layerA.dailyGrams),
    chips: reasons.map((r) => r.chip),
    reasons,
    trace,
    waitlist,
    needsConsultation: f.needsConsultation === true || layerA.needsConsultation === true,
    computedAt: str(row.computed_at),
    algorithmVersion: str(row.algorithm_version),
    approvalStatus: str(row.approval_status),
    userAdjusted: row.user_adjusted === true,
    cycle: row.cycle_number ?? null,
  }
}

export const APPROVAL_KR: Record<string, string> = {
  auto_applied: '자동 적용',
  proposed: '동의 대기',
  approved: '고객 동의',
  rejected: '고객 거절',
  expired: '동의 시한 지남',
}
