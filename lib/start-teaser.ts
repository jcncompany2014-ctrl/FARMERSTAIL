// 트랙B B2재설계-B — /start 웹 라이트 설문 → 간결 티저 결과 계산.
//
// localStorage 초안(dog 기본 + 라이트 answers)을 calculateNutrition 입력으로
// 매핑해 **간결한 실값**(하루 권장 칼로리·급여량 + 체형 코멘트 + 추천 단백질)만
// 뽑는다. 정밀 38영양소·SKU·건강추적은 앱(가입 후). 가짜 수치/질병 단정 0 —
// 전부 nutrition.ts 의 실제 계산값.
//
// DB/auth 미접촉(순수 함수). B5 이관 때 이 매핑을 재사용(draft→surveys/analyses).

import { calculateNutrition, type DogInfo, type SurveyAnswers } from './nutrition.ts'
import { loadAutosignupDraft, type AutosignupDraft } from './autosignup-draft.ts'

export type StartTeaser = {
  dogName: string
  /** 체형 한 줄 코멘트(질병 단정 아님). */
  bodyComment: string
  /** 하루 권장 칼로리 (MER, kcal/일). */
  merKcal: number
  /** 하루 권장 급여량 (g/일). */
  feedG: number
  /** 추천 단백질 한글 1~2개 (알레르기 제외). */
  proteins: string[]
}

const BODY_COMMENT: Record<string, string> = {
  skinny: '지금은 많이 마른 편이라, 칼로리를 넉넉히 잡았어요.',
  slim: '지금은 마른 편이라, 칼로리를 살짝 넉넉히 잡았어요.',
  ideal: '이상적인 체형이에요. 지금 컨디션을 유지하는 기준으로 계산했어요.',
  chubby: '약간 통통한 편이라, 체중 관리를 고려해 계산했어요.',
  obese: '체중 관리가 필요한 편이라, 적정 체중을 목표로 계산했어요.',
}

const PROTEIN_KR: Record<string, string> = {
  chicken: '닭', beef: '소', duck: '오리', salmon: '연어', lamb: '양', pork: '돼지',
}
// 기본 추천 우선순위(알레르기 흔한 닭·소를 뒤로).
const PROTEIN_ORDER = ['duck', 'salmon', 'lamb', 'beef', 'chicken', 'pork']

/** 초안 → calculateNutrition 입력(검증된 매핑). 티저·B5 이관이 **공유**해 둘이
 *  항상 같은 결과를 내게 한다(사용자가 본 티저 수치 = 저장된 분석). dog 부실 시 null. */
export type DraftNutritionInput = {
  dogInfo: DogInfo
  answers: SurveyAnswers
  dogName: string
  /** 'skinny'|'slim'|'ideal'|'chubby'|'obese' — bodyComment 키 (BCS 5단계) */
  body: string
  /** 알레르기 단백질 키(none 제외) */
  allergies: string[]
  /** 건강 관심사 키(none 제외) — 이관 시 한글 라벨/보충제 매핑 원천 */
  health: string[]
}

export function draftToNutritionInput(
  draft: AutosignupDraft | null | undefined,
): DraftNutritionInput | null {
  const dog = draft?.dog
  if (!dog) return null
  const weight = parseFloat(dog.weight ?? '')
  const ageValue = parseInt(dog.ageValue ?? '', 10)
  if (!(weight > 0) || !(ageValue > 0)) return null
  if (dog.ageUnit !== 'years' && dog.ageUnit !== 'months') return null
  if (
    dog.activityLevel !== 'low' &&
    dog.activityLevel !== 'medium' &&
    dog.activityLevel !== 'high'
  ) {
    return null
  }

  const a = (draft?.answers ?? {}) as Record<string, string | string[]>
  const body =
    typeof a.body === 'string' && ['skinny', 'slim', 'ideal', 'chubby', 'obese'].includes(a.body)
      ? a.body
      : 'ideal'
  // '없어요'(none) 센티넬 제외.
  const allergies = (Array.isArray(a.allergy) ? a.allergy : []).filter((x) => x !== 'none')
  const health = (Array.isArray(a.health) ? a.health : []).filter((x) => x !== 'none')
  const appetite =
    a.taste === 'good' ? 'strong' : a.taste === 'picky' ? 'picky' : a.taste === 'normal' ? 'normal' : undefined

  const dogInfo: DogInfo = {
    weight,
    ageValue,
    ageUnit: dog.ageUnit,
    neutered: dog.neutered === true,
    activityLevel: dog.activityLevel,
    gender: dog.gender === 'male' || dog.gender === 'female' ? dog.gender : null,
  }
  const answers: SurveyAnswers = {
    bodyCondition: body as SurveyAnswers['bodyCondition'],
    allergies,
    healthConcerns: health,
    foodType: typeof a.food === 'string' ? a.food : undefined,
    appetite: appetite as SurveyAnswers['appetite'],
  }
  return { dogInfo, answers, dogName: (dog.name || '').trim() || '우리 아이', body, allergies, health }
}

/**
 * 초안으로 간결 티저 계산. 모듈 함수 — render 에서 호출 가능(purity 회피).
 * draftArg 미지정 시 localStorage 로드(앱 경로), 테스트는 draft 직접 주입.
 */
export function computeStartTeaser(draftArg?: AutosignupDraft | null): StartTeaser | null {
  const draft = draftArg !== undefined ? draftArg : loadAutosignupDraft()
  const m = draftToNutritionInput(draft)
  if (!m) return null

  const nu = calculateNutrition(m.dogInfo, m.answers)
  const proteins = PROTEIN_ORDER.filter((p) => !m.allergies.includes(p))
    .slice(0, 2)
    .map((p) => PROTEIN_KR[p]!)

  return {
    dogName: m.dogName,
    bodyComment: BODY_COMMENT[m.body] ?? BODY_COMMENT.ideal!,
    merKcal: Math.round(nu.mer),
    feedG: Math.round(nu.feedG),
    proteins: proteins.length ? proteins : ['닭'],
  }
}
