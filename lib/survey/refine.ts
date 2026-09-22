/**
 * 설문 v4 — "정확도 올리기" (2026-09-22, 시니어 사용성 3단계).
 *
 * # 무엇
 * 관문에서 "건너뛰고 결과 보기"를 고른 사용자가 결과 화면에서 나중에 선택 4개를
 * 답할 수 있게 한다. 결과 화면은 마지막 설문의 answers.optionalSkipped 를 보고 카드를
 * 띄우고, `/dogs/[id]/survey?refine=1` 로 들어오면 서버가 마지막 설문 행을 넘겨준다.
 * SurveyClient 는 이 파일의 seedFromSurvey 로 상태를 채운 뒤 **선택 묶음 첫 화면**에서
 * 시작한다 — 이미 답한 11개를 다시 묻지 않는다. 제출은 평소와 같은 파이프라인
 * (새 surveys + analyses 행 = 더 많은 정보로 한 재분석).
 *
 * # 왜 "답하지 않은 질문 N개" 대신 플래그인가
 * 약을 먹지 않는 강아지는 약 칸이 원래 비어 있다 — 빈 칸 개수를 세면 건강한 개일수록
 * "답하지 않은 질문이 있다"가 영원히 뜬다. 그래서 **묶음을 통째로 건너뛴 사실**만 기록한다.
 * v3 설문(플래그 없음)은 카드가 뜨지 않는다 — 건너뛴 건지 알 수 없으므로.
 */

export type SurveyRowLike = {
  answers?: unknown
  iris_stage?: number | null
  current_medications?: string[] | null
  current_food_brand?: string | null
  daily_walk_minutes?: number | null
  indoor_activity?: string | null
  expected_adult_weight_kg?: number | null
  pregnancy_week?: number | null
  litter_size?: number | null
  /** dogs.prescription_diet — 설문 행이 아니라 강아지 행에 저장된다. */
  prescription_diet?: string | null
}

/** 마지막 설문이 선택 묶음을 통째로 건너뛰었나 (결과 화면 카드 노출 조건). */
export function optionalSkipped(row: SurveyRowLike | null | undefined): boolean {
  const a = asRecord(row?.answers)
  return a?.optionalSkipped === true
}

export type RefineSeed = {
  bodyAssess: {
    ribs: 'visible' | 'easy' | 'slight_pressure' | 'hard' | ''
    waist: 'clear' | 'slight' | 'none' | ''
    abdomen: 'tucked' | 'level' | 'sagging' | ''
  }
  bcs: number | null
  weightTrend: 'stable' | 'gained' | 'lost' | 'unknown' | ''
  easyKeeper: '' | 'yes' | 'no'
  bristol: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null
  stoolSkipped: boolean
  giSensitivity: 'rare' | 'sometimes' | 'frequent' | 'always' | ''
  foodType: string
  snackFreq: string
  treatKcal: string
  /** 건사료 라벨 kcal/kg 문자열 (answers 는 /100g 로 저장돼 있어 ×10). */
  kibbleKcal: string
  currentBrand: string
  homeCookingExp: 'first' | 'occasional' | 'frequent' | ''
  walkMinutes: string
  indoorActivity: 'calm' | 'moderate' | 'active' | ''
  vigorous: '' | 'none' | 'self' | 'objective'
  housing: '' | 'indoor' | 'indoor_outdoor' | 'outdoor'
  coldOutdoor: '' | 'yes' | 'no'
  /** 'unknown'(잘 몰라요)은 저장되지 않아 복원 불가 — 재료가 있으면 has, 없으면 none. */
  dlMode: 'none' | 'has'
  allergies: string[]
  preferredProteins: string[]
  hasChronic: 'yes' | 'no'
  chronicConditions: string[]
  prescriptionDiet: string
  medications: string
  irisStage: 1 | 2 | 3 | 4 | null
  pancreatitisSeverity: 'moderate' | 'severe' | null
  pregnancy: 'none' | 'pregnant' | 'lactating' | ''
  pregnancyWeek: number | null
  litterSize: number | null
  expectedAdultWeightKg: number | null
  careGoal: string
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | '' {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : ''
}
function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** 마지막 설문 행 → SurveyClient 초기 상태. 없는 값은 미응답('')/null. */
export function seedFromSurvey(row: SurveyRowLike): RefineSeed {
  const a = asRecord(row.answers) ?? {}
  const body = asRecord(a.bodyAssessment)
  const bcs = num(a.bcsExact)
  const allergies = strArr(a.allergies)
  const conditions = strArr(a.chronicConditions)
  const meds = Array.isArray(row.current_medications)
    ? row.current_medications.filter((m): m is string => typeof m === 'string')
    : strArr(a.currentMedications)
  const prescription = str(row.prescription_diet)
  const sev = asRecord(a.diagnosedSeverity)
  const pancreatitis = sev ? oneOf(sev.pancreatitis, ['moderate', 'severe'] as const) : ''
  const kibble100 = num(a.kibbleKcalPer100g)
  const treat = num(a.treatKcalPerDay)
  const walk = row.daily_walk_minutes ?? num(a.dailyWalkMinutes)
  const iris = row.iris_stage
  const vig = a.vigorousExercise
  return {
    bodyAssess: {
      ribs: body ? oneOf(body.ribs, ['visible', 'easy', 'slight_pressure', 'hard'] as const) : '',
      waist: body ? oneOf(body.waist, ['clear', 'slight', 'none'] as const) : '',
      abdomen: body ? oneOf(body.abdomen, ['tucked', 'level', 'sagging'] as const) : '',
    },
    bcs: bcs !== null && bcs >= 1 && bcs <= 9 ? bcs : null,
    weightTrend: oneOf(a.weightTrend6mo, ['stable', 'gained', 'lost', 'unknown'] as const),
    easyKeeper: a.isEasyKeeper === true ? 'yes' : a.isEasyKeeper === false ? 'no' : '',
    bristol: (() => {
      const b = num(a.bristolScore)
      return b !== null && b >= 1 && b <= 7 ? (b as 1 | 2 | 3 | 4 | 5 | 6 | 7) : null
    })(),
    stoolSkipped: num(a.bristolScore) === null,
    giSensitivity: oneOf(a.giSensitivity, ['rare', 'sometimes', 'frequent', 'always'] as const),
    foodType: str(a.foodType),
    snackFreq: str(a.snackFreq),
    treatKcal: treat !== null ? String(treat) : '',
    kibbleKcal: kibble100 !== null ? String(Math.round(kibble100 * 10)) : '',
    currentBrand: str(row.current_food_brand) || str(a.currentFoodBrand),
    homeCookingExp: oneOf(a.homeCookingExperience, ['first', 'occasional', 'frequent'] as const),
    walkMinutes: walk !== null && walk !== undefined ? String(walk) : '',
    indoorActivity: oneOf(row.indoor_activity ?? a.indoorActivity, ['calm', 'moderate', 'active'] as const),
    vigorous: vig === 'self_report' ? 'self' : oneOf(vig, ['none', 'objective'] as const),
    housing: oneOf(a.housing, ['indoor', 'indoor_outdoor', 'outdoor'] as const),
    coldOutdoor: a.coldExposure === true ? 'yes' : a.coldExposure === false ? 'no' : '',
    dlMode: allergies.length > 0 ? 'has' : 'none',
    allergies,
    preferredProteins: strArr(a.preferredProteins),
    hasChronic: conditions.length > 0 || prescription.trim() !== '' ? 'yes' : 'no',
    chronicConditions: conditions,
    prescriptionDiet: prescription,
    medications: meds.join(', '),
    irisStage: iris === 1 || iris === 2 || iris === 3 || iris === 4 ? iris : null,
    pancreatitisSeverity: pancreatitis === '' ? null : pancreatitis,
    pregnancy: oneOf(a.pregnancyStatus, ['none', 'pregnant', 'lactating'] as const),
    pregnancyWeek: row.pregnancy_week ?? num(a.pregnancyWeek),
    litterSize: row.litter_size ?? num(a.litterSize),
    expectedAdultWeightKg: row.expected_adult_weight_kg ?? null,
    careGoal: str(a.careGoal),
  }
}
