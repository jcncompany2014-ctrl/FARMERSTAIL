/**
 * 설문 v4 — "화면당 질문 하나" 흐름의 순수 로직 (2026-09-22, 시니어 사용성 3단계).
 *
 * # 왜
 * 사장님 제보(9/20): 부모님 세대가 설문을 어색해한다 — 한 화면에 질문 3~5개가
 * 쌓여 있고, "선택"·"건너뛰기"가 어디인지 헷갈린다. 결정(9/21):
 *   ① 화면당 질문 하나 ② 불필요 문항 삭제(식욕·털 상태 — 계산 미사용)
 *   ③ '살 잘 찌는 편'은 체중 변화 화면의 둘째 줄, '사료 바꿀 때 무른 변'은 변 상태
 *      화면의 둘째 줄로 합침(지우지 않음 — 칼로리 감산·첫 박스 구성에 쓰인다)
 *   ④ 체중 잰 방법은 접힌 채 유지 ⑤ 선택 묶음(현재 사료·산책·운동·약)은 관문
 *      화면에서 "4개 더 답하기 / 건너뛰고 결과 보기"로 구조적으로 건너뛸 수 있게.
 *
 * # 무엇
 * 이 파일은 React 를 모른다. 강아지 조건(성별·중성화·나이)과 선택 묶음 결정만
 * 받아 **화면 순서**를 만들고, 각 화면의 **필수 답 누락 문구**를 돌려준다.
 * SurveyClient 가 상태를 들고 이걸 호출한다. 테스트: lib/survey/flow.test.ts.
 *
 * # 화면 구성
 *   항상(11): ribs · waist · abdomen · weight · stool · food · snack · fresh ·
 *             allergy · chronic · goal
 *   조건부(0~2): pregnancy(암컷·비중성화) · adultWeight(18개월 미만)
 *   관문(1): gate — "4개 더 답하기" / "건너뛰고 결과 보기"
 *   선택(4, 관문에서 '답하기'일 때만): optFood · optWalk · optExercise · optMeds
 *   loading 은 제출 화면(번호 없음).
 */

export type ScreenKey =
  | 'ribs'
  | 'waist'
  | 'abdomen'
  | 'weight'
  | 'stool'
  | 'food'
  | 'snack'
  | 'fresh'
  | 'allergy'
  | 'chronic'
  | 'pregnancy'
  | 'adultWeight'
  | 'goal'
  | 'gate'
  | 'optFood'
  | 'optWalk'
  | 'optExercise'
  | 'optMeds'

export type ScreenPart = 'required' | 'conditional' | 'gate' | 'optional'

export type Screen = { key: ScreenKey; part: ScreenPart }

/** 흐름 결정에 필요한 강아지 조건만. */
export type FlowDog = {
  gender: 'male' | 'female' | null
  neutered: boolean
  ageMonths: number
}

/** 관문 결정. '' = 아직 안 골랐음. */
export type OptionalChoice = '' | 'answer' | 'skip'

export const REQUIRED_KEYS: readonly ScreenKey[] = [
  'ribs',
  'waist',
  'abdomen',
  'weight',
  'stool',
  'food',
  'snack',
  'fresh',
  'allergy',
  'chronic',
  'goal',
]

export const OPTIONAL_KEYS: readonly ScreenKey[] = [
  'optFood',
  'optWalk',
  'optExercise',
  'optMeds',
]

/** 임신·수유 화면 노출 조건 — 수컷/중성화견에 켜져 MER ×2.5 폭주하던 사고 방지(기존 Pregnancy.tsx 규칙 그대로). */
export function showsPregnancy(dog: FlowDog): boolean {
  return (dog.gender === 'female' || dog.gender == null) && !dog.neutered
}

/** 예상 성견 체중 — 18개월 미만 자견만(AAFCO 대형견 Ca 상한 판정). */
export function showsAdultWeight(dog: FlowDog): boolean {
  return dog.ageMonths < 18
}

export function buildScreens(dog: FlowDog, choice: OptionalChoice): Screen[] {
  const out: Screen[] = []
  const req = (k: ScreenKey) => out.push({ key: k, part: 'required' })
  req('ribs')
  req('waist')
  req('abdomen')
  req('weight')
  req('stool')
  req('food')
  req('snack')
  req('fresh')
  req('allergy')
  req('chronic')
  if (showsPregnancy(dog)) out.push({ key: 'pregnancy', part: 'conditional' })
  if (showsAdultWeight(dog)) out.push({ key: 'adultWeight', part: 'conditional' })
  req('goal')
  out.push({ key: 'gate', part: 'gate' })
  if (choice === 'answer') {
    for (const k of OPTIONAL_KEYS) out.push({ key: k, part: 'optional' })
  }
  return out
}

/** 번호가 붙는 본 질문(관문·선택 제외) 개수. "질문 3 / 11" 의 분모. */
export function mainCount(screens: Screen[]): number {
  return screens.filter((s) => s.part === 'required' || s.part === 'conditional').length
}

/**
 * 화면 상단 카운터 문구. 관문은 번호 없음, 선택 묶음은 "추가 질문 n / 4".
 * 시니어에게 "STEP 03 / 07" 같은 영어·두 자리 표기는 읽히지 않는다(2단계 결정).
 */
export function counterLabel(screens: Screen[], idx: number): string {
  const cur = screens[idx]
  if (!cur) return ''
  if (cur.part === 'gate') return ''
  if (cur.part === 'optional') {
    const n = screens.slice(0, idx + 1).filter((s) => s.part === 'optional').length
    return `추가 질문 ${n} / ${OPTIONAL_KEYS.length}`
  }
  const n = screens.slice(0, idx + 1).filter((s) => s.part !== 'gate' && s.part !== 'optional').length
  return `질문 ${n} / ${mainCount(screens)}`
}

/** 진행률(0~100). 마지막 화면에서 100. */
export function progressPct(screens: Screen[], idx: number): number {
  if (screens.length <= 1) return 100
  return Math.min(100, Math.round((idx / (screens.length - 1)) * 100))
}

/** 필수 판정에 필요한 답 스냅샷 — SurveyClient 의 state 에서 뽑아 넘긴다. */
export type FlowAnswers = {
  ribs: string
  waist: string
  abdomen: string
  weightTrend: string
  bristol: number | null
  /** "잘 모르겠어요" 를 명시적으로 눌렀는지. 미선택과 건너뛰기를 구분한다. */
  stoolSkipped: boolean
  foodType: string
  snackFreq: string
  homeCookingExp: string
  dlMode: string
  allergies: string[]
  hasChronic: '' | 'yes' | 'no'
  chronicConditions: string[]
  prescriptionDiet: string
  pregnancy: string
  careGoal: string
  optChoice: OptionalChoice
}

/**
 * 이 화면에서 다음으로 못 넘어가는 이유. null 이면 통과.
 * 문구는 "무엇을 누르면 되는지"까지 말한다 — "선택해 주세요" 만으로는 어르신이
 * 어디를 눌러야 하는지 모른다.
 */
export function screenError(key: ScreenKey, a: FlowAnswers): string | null {
  switch (key) {
    case 'ribs':
      return a.ribs ? null : '갈비뼈가 어떻게 만져지는지 하나를 골라 주세요'
    case 'waist':
      return a.waist ? null : '허리 모양을 하나 골라 주세요'
    case 'abdomen':
      return a.abdomen ? null : '배 모양을 하나 골라 주세요'
    case 'weight':
      return a.weightTrend ? null : '체중 변화를 골라 주세요. 모르면 "잘 모름"을 누르면 돼요'
    case 'stool':
      return a.bristol !== null || a.stoolSkipped
        ? null
        : '변 상태를 고르거나 "잘 모르겠어요"를 눌러 주세요'
    case 'food':
      return a.foodType ? null : '지금 주로 먹는 밥을 하나 골라 주세요'
    case 'snack':
      return a.snackFreq ? null : '간식을 얼마나 자주 주는지 골라 주세요'
    case 'fresh':
      return a.homeCookingExp ? null : '화식 경험을 하나 골라 주세요'
    case 'allergy':
      if (!a.dlMode) return '알레르기가 있는지 골라 주세요. 모르면 "잘 몰라요"를 누르면 돼요'
      if (a.dlMode === 'has' && a.allergies.length === 0)
        return '피해야 할 재료를 하나 이상 골라 주세요'
      return null
    case 'chronic':
      if (!a.hasChronic) return '진단받은 질환이 있는지 골라 주세요'
      if (
        a.hasChronic === 'yes' &&
        a.chronicConditions.length === 0 &&
        a.prescriptionDiet.trim() === ''
      )
        return '해당 질환을 골라 주세요. 목록에 없으면 "없어요"를 누르면 돼요'
      return null
    case 'pregnancy':
      return a.pregnancy ? null : '해당하지 않으면 "해당 없음"을 눌러 주세요'
    case 'goal':
      return a.careGoal ? null : '가장 신경 쓰고 싶은 것을 하나 골라 주세요'
    case 'gate':
      return a.optChoice ? null : '둘 중 하나를 골라 주세요'
    case 'adultWeight':
    case 'optFood':
    case 'optWalk':
    case 'optExercise':
    case 'optMeds':
      return null
  }
}

/** 화면이 "안 답해도 넘어갈 수 있는" 화면인지(CTA 라벨 '건너뛰기' 판정용). */
export function isSkippable(key: ScreenKey): boolean {
  return key === 'adultWeight' || OPTIONAL_KEYS.includes(key)
}

/**
 * 옛 초안(v3 STEPS: body·stool·meal·life·allergy·chronic·status·loading) 의
 * currentStep 을 새 화면으로. 7일 안에 돌아온 사용자가 처음부터 다시 안 하도록.
 */
export function legacyStepToScreen(step: string): ScreenKey {
  switch (step) {
    case 'body':
      return 'ribs'
    case 'stool':
      return 'stool'
    case 'meal':
    case 'diet':
      return 'food'
    case 'life':
      return 'allergy'
    case 'allergy':
      return 'allergy'
    case 'chronic':
      return 'chronic'
    case 'status':
    case 'loading':
      return 'goal'
    default:
      return 'ribs'
  }
}

export const ALL_SCREEN_KEYS: readonly ScreenKey[] = [
  ...REQUIRED_KEYS.slice(0, 10),
  'pregnancy',
  'adultWeight',
  'goal',
  'gate',
  ...OPTIONAL_KEYS,
]

export function isScreenKey(v: unknown): v is ScreenKey {
  return typeof v === 'string' && (ALL_SCREEN_KEYS as readonly string[]).includes(v)
}
