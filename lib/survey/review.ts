/**
 * 설문 다시 하기 — 바뀐 것만 고르는 요약 화면의 줄(2026-10-21 사장님 "맨 처음 받은 설문을 또 맨 처음부터 하는 게 의미가 있냐").
 *
 * # 무엇
 * v4 설문을 한 번 한 강아지가 설문에 다시 들어오면 지난 답으로 상태를 채우고(refine.ts seedFromSurvey) 질문 대신 **요약 한 장**에서
 * 시작한다. 줄마다 지금 답이 보이고, 누르면 그 질문 화면만 열렸다가 '다음'을 누르면 요약으로 돌아온다. 맨 아래 '이대로 저장'은
 * 평소와 같은 제출(새 surveys + analyses 행). 정기배송 중이면 그 새 설문으로 다음 박스가 제안된다(DB 트리거, 규칙309).
 *
 * React 를 모르는 순수 함수 — 화면 순서(flow.buildScreens)를 받아 줄로 묶는다. 문구는 설문 보기와 같다(labels.SURVEY_OPTION_TEXT).
 */
import type { Screen, ScreenKey } from './flow.ts'
import { SURVEY_OPTION_TEXT as T, surveyWalkText } from './labels.ts'
import { CHRONIC_CONDITION_LABELS } from '../nutrition/guidelines.ts'

/** 요약에 필요한 답 — SurveyClient 상태와 같은 이름(RefineSeed 와도 같다). */
export type ReviewState = {
  bodyAssess: { ribs: string; waist: string; abdomen: string }
  weightTrend: string
  easyKeeper: string
  bristol: number | null
  stoolSkipped: boolean
  giSensitivity: string
  foodType: string
  snackFreq: string
  treatKcal: string
  homeCookingExp: string
  allergies: string[]
  preferredProteins: string[]
  hasChronic: string
  chronicConditions: string[]
  prescriptionDiet: string
  pregnancy: string
  careGoal: string
  currentBrand: string
  kibbleKcal: string
  walkMinutes: string
  indoorActivity: string
  vigorous: string
  housing: string
  medications: string
}

export type ReviewRow = {
  /** 누르면 차례로 여는 질문 화면들(체형은 세 화면). 마지막 화면에서 '다음' = 요약으로. */
  keys: ScreenKey[]
  title: string
  value: string
  /** 답이 비어 있음(새로 생긴 질문 등) — 요약에서 눈에 띄게. */
  empty: boolean
}

const pick = (m: Record<string, string>, v: string): string => (v && m[v]) || ''
const join = (xs: string[]) => xs.filter(Boolean).join(' · ')

function rowFor(key: ScreenKey, s: ReviewState): Omit<ReviewRow, 'keys'> | null {
  switch (key) {
    case 'ribs': {
      const v = join([
        pick(T.RIBS, s.bodyAssess.ribs) && `갈비뼈 ${pick(T.RIBS, s.bodyAssess.ribs)}`,
        pick(T.WAIST, s.bodyAssess.waist) && `허리 ${pick(T.WAIST, s.bodyAssess.waist)}`,
        pick(T.ABDOMEN, s.bodyAssess.abdomen) && `배 ${pick(T.ABDOMEN, s.bodyAssess.abdomen)}`,
      ])
      return { title: '체형', value: v, empty: !s.bodyAssess.ribs || !s.bodyAssess.waist || !s.bodyAssess.abdomen }
    }
    case 'weight': {
      const v = join([pick(T.WEIGHT_TREND, s.weightTrend), s.easyKeeper === 'yes' ? '살이 잘 찌는 편' : ''])
      return { title: '최근 체중 변화', value: v, empty: !s.weightTrend }
    }
    case 'stool': {
      const b = s.bristol !== null ? T.BRISTOL[String(s.bristol)] ?? '' : s.stoolSkipped ? '잘 모르겠어요' : ''
      const v = join([b, s.giSensitivity ? `사료 바꿀 때 무른 변 ${pick(T.GI, s.giSensitivity)}` : ''])
      return { title: '변 상태', value: v, empty: !b }
    }
    case 'food':
      return { title: '지금 먹는 밥', value: s.foodType, empty: !s.foodType }
    case 'snack': {
      const kcal = s.treatKcal.trim() ? `하루 ${s.treatKcal.trim()}kcal` : ''
      return { title: '간식', value: join([s.snackFreq, kcal]), empty: !s.snackFreq }
    }
    case 'fresh':
      return { title: '화식 먹여 본 경험', value: pick(T.COOKING, s.homeCookingExp), empty: !s.homeCookingExp }
    case 'allergy': {
      const al = s.allergies.length ? `알레르기 ${s.allergies.join('·')}` : '알레르기 없어요'
      const pref = s.preferredProteins.length
        ? `잘 먹는 고기 ${s.preferredProteins.map((p) => pick(T.PROTEIN_KR, p) || p).join('·')}`
        : ''
      return { title: '알레르기·잘 먹는 고기', value: join([al, pref]), empty: false }
    }
    case 'chronic': {
      if (s.hasChronic === 'no') return { title: '앓는 병', value: '없어요', empty: false }
      const names = s.chronicConditions.map((c) => (CHRONIC_CONDITION_LABELS as Record<string, string>)[c] ?? c)
      const v = join([...names, s.prescriptionDiet.trim() ? `처방식 ${s.prescriptionDiet.trim()}` : ''])
      return { title: '앓는 병', value: v || '있어요', empty: s.hasChronic === '' }
    }
    case 'pregnancy':
      return { title: '임신·수유', value: pick(T.PREGNANCY, s.pregnancy), empty: !s.pregnancy }
    case 'goal':
      return { title: '바라는 것', value: pick(T.CARE_GOAL, s.careGoal), empty: !s.careGoal }
    case 'optFood': {
      const v = join([s.currentBrand.trim(), s.kibbleKcal.trim() ? `${s.kibbleKcal.trim()}kcal/kg` : ''])
      return { title: '지금 먹는 사료 이름', value: v || '적지 않았어요', empty: false }
    }
    case 'optWalk': {
      const w = s.walkMinutes ? surveyWalkText(Number(s.walkMinutes)) ?? '' : ''
      return { title: '산책·집 안 활동', value: join([w, pick(T.INDOOR, s.indoorActivity)]) || '적지 않았어요', empty: false }
    }
    case 'optExercise': {
      const vig = s.vigorous === 'self' ? T.VIGOROUS.self_report : pick(T.VIGOROUS, s.vigorous)
      const v = join([vig && `숨찬 운동 ${vig}`, pick(T.HOUSING, s.housing)])
      return { title: '운동·사는 곳', value: v || '적지 않았어요', empty: false }
    }
    case 'optMeds':
      return { title: '먹는 약', value: s.medications.trim() || '없어요', empty: false }
    default:
      // 갈비뼈 다음 허리·배는 '체형' 한 줄에 묶인다. 관문(gate)은 요약에 없다.
      return null
  }
}

/** 화면 순서 → 요약 줄. 체형(ribs·waist·abdomen)은 한 줄. */
export function reviewRows(screens: readonly Screen[], s: ReviewState): ReviewRow[] {
  const keys = screens.map((x) => x.key)
  const out: ReviewRow[] = []
  for (const k of keys) {
    const r = rowFor(k, s)
    if (!r) continue
    const group: ScreenKey[] = k === 'ribs' ? (['ribs', 'waist', 'abdomen'] as ScreenKey[]).filter((x) => keys.includes(x)) : [k]
    out.push({ keys: group, ...r })
  }
  return out
}
