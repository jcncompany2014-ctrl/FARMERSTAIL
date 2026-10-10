/**
 * /design-check/survey 예시 값 — 앱 설문(새 틀) 36장(시안 '설문 (새 틀)' E01~E18 · F22~F32 · L19~L35)을 로그인 없이 본다.
 * 손님 화면이 아니다(실제 사이트에선 /design-check 자체가 404). 예시 강아지는 시안과 같은 '땅콩'.
 *
 * 클라이언트 모듈에 두면 서버 페이지가 배열 대신 참조를 받는다 — 그래서 일반 .ts 다.
 * 창(체중 잰 방법·간식 칼로리·나가기 확인)은 점검 화면이 버튼을 눌러 띄운다(click 칸 — shoot.mjs 의 @@click).
 */

import type { SurveyPreview } from '../../dogs/[id]/survey/SurveyClient'
import type { SurveyDog } from '../../dogs/[id]/survey/steps/Pregnancy'
import type { RefineSeed } from '@/lib/survey/refine'
import { screenError } from '@/lib/survey/flow'

export const DOG_ID = '00000000-0000-4000-8000-0000000000b6'

/** 시안 땅콩 — 4살 중성화 수컷 11.2kg. */
const DOG: SurveyDog = {
  id: DOG_ID,
  name: '땅콩',
  weight: 11.2,
  age_value: 4,
  age_unit: 'years',
  neutered: true,
  activity_level: 'medium',
  gender: 'male',
  birth_date: null,
}
/** 임신·수유 질문이 나오는 아이(암컷 · 중성화 안 함). */
const GIRL: SurveyDog = { ...DOG, gender: 'female', neutered: false }
/** 12개월 안 된 암컷(시안 F31 — 어린 강아지 임신 안내). */
const PUPPY: SurveyDog = { ...GIRL, age_value: 8, age_unit: 'months' }

/** 몸 상태 세 답(갈비뼈 살짝 · 허리 살짝 · 배 거의 일자 = 5단계). */
const BODY_5: Partial<RefineSeed> = {
  bodyAssess: { ribs: 'easy', waist: 'slight', abdomen: 'level' },
  bcs: 5,
}

/** 정확도 올리기 시드(시안 L19·L20) — 본 질문 11개는 이미 답한 상태. */
export const REFINE_SEED: RefineSeed = {
  bodyAssess: { ribs: 'easy', waist: 'slight', abdomen: 'level' },
  bcs: 5,
  weightTrend: 'stable',
  easyKeeper: 'no',
  bristol: 4,
  stoolSkipped: false,
  giSensitivity: 'rare',
  foodType: '건식 사료',
  snackFreq: '가끔',
  treatKcal: '',
  kibbleKcal: '',
  currentBrand: '',
  homeCookingExp: 'first',
  walkMinutes: '',
  indoorActivity: '',
  vigorous: '',
  housing: '',
  coldOutdoor: '',
  dlMode: 'none',
  allergies: [],
  preferredProteins: ['chicken'],
  hasChronic: 'no',
  chronicConditions: [],
  prescriptionDiet: '',
  medications: '',
  irisStage: null,
  pancreatitisSeverity: null,
  pregnancy: '',
  pregnancyWeek: null,
  litterSize: null,
  expectedAdultWeightKg: null,
  careGoal: 'general_upgrade',
}

/** 답을 하나도 안 고르고 '다음'을 눌렀을 때 문구 — 정본 lib/survey/flow 에서 그대로 받는다(시안 L21). */
const NO_ANSWER_RIBS =
  screenError('ribs', {
    ribs: '',
    waist: '',
    abdomen: '',
    weightTrend: '',
    bristol: null,
    stoolSkipped: false,
    foodType: '',
    snackFreq: '',
    homeCookingExp: '',
    dlMode: '',
    allergies: [],
    hasChronic: '',
    chronicConditions: [],
    prescriptionDiet: '',
    pregnancy: '',
    careGoal: '',
    optChoice: '',
  }) ?? ''

export type SurveyCase = {
  key: string
  title: string
  /** 시안 보드 이름(canvas-web/shots/p2b6). */
  mock: string
  preview: SurveyPreview
  /** 직전 분석(체중↔체형 모순 — 시안 F32). */
  previous?: { bcs: number; weightKg: number }
  /** 정확도 올리기(?refine=1)로 연다. */
  refine?: boolean
  /** 이 글자로 시작하는 버튼을 눌러 창을 띄운다. */
  click?: string
}

/** 목록 순서 = 점검 화면 목록 순서 = 시안 보드 순서. */
export const CASES: SurveyCase[] = [
  { key: 'ribs', title: '1 갈비뼈', mock: 'E01-Ribs', preview: { dog: DOG, screen: 'ribs', seed: { bodyAssess: { ribs: 'easy', waist: '', abdomen: '' } } } },
  { key: 'waist', title: '2 허리', mock: 'E02-Waist', preview: { dog: DOG, screen: 'waist', seed: { bodyAssess: { ribs: 'easy', waist: 'slight', abdomen: '' } } } },
  { key: 'belly', title: '3 배 + 체형 결과', mock: 'E03-Belly', preview: { dog: DOG, screen: 'abdomen', seed: BODY_5 } },
  { key: 'weight', title: '4 체중 변화', mock: 'E04-WeightChange', preview: { dog: DOG, screen: 'weight', seed: { ...BODY_5, weightTrend: 'stable', easyKeeper: 'no' } } },
  { key: 'stool', title: '5 변 상태', mock: 'E05-Stool', preview: { dog: DOG, screen: 'stool', seed: { ...BODY_5, bristol: 4, giSensitivity: 'rare' } } },
  { key: 'food', title: '6 지금 먹는 밥', mock: 'E06-Food', preview: { dog: DOG, screen: 'food', seed: { ...BODY_5, foodType: '건식 사료' } } },
  { key: 'snack', title: '7 간식', mock: 'E07-Snack', preview: { dog: DOG, screen: 'snack', seed: { ...BODY_5, snackFreq: '가끔' } } },
  { key: 'fresh', title: '8 화식 경험', mock: 'E08-Fresh', preview: { dog: DOG, screen: 'fresh', seed: { ...BODY_5, homeCookingExp: 'first' } } },
  { key: 'allergy', title: '9 알레르기', mock: 'E09-Allergy', preview: { dog: DOG, screen: 'allergy', seed: { ...BODY_5, dlMode: 'none', preferredProteins: ['chicken', 'beef'] } } },
  { key: 'chronic', title: '10 질환', mock: 'E10-Chronic', preview: { dog: DOG, screen: 'chronic', seed: { ...BODY_5, hasChronic: 'no' } } },
  { key: 'pregnancy', title: '11 임신·수유', mock: 'E11-Pregnancy', preview: { dog: GIRL, screen: 'pregnancy', seed: { ...BODY_5, pregnancy: 'none' } } },
  { key: 'goal', title: '11 케어 목표(마지막 필수)', mock: 'E12-Goal', preview: { dog: DOG, screen: 'goal', seed: { ...BODY_5, careGoal: 'general_upgrade' } } },
  { key: 'gate', title: '관문', mock: 'E13-Gate', preview: { dog: DOG, screen: 'gate', seed: BODY_5 } },
  { key: 'opt-food', title: '추가 1 사료 이름', mock: 'E14-OptFood', preview: { dog: DOG, screen: 'optFood', seed: { ...BODY_5, foodType: '건식 사료' } } },
  { key: 'opt-walk', title: '추가 2 산책', mock: 'E15-OptWalk', preview: { dog: DOG, screen: 'optWalk', seed: { ...BODY_5, walkMinutes: '30', indoorActivity: 'moderate' } } },
  { key: 'opt-exercise', title: '추가 3 운동', mock: 'E16-OptExercise', preview: { dog: DOG, screen: 'optExercise', seed: { ...BODY_5, vigorous: 'none', housing: 'indoor' } } },
  { key: 'opt-meds', title: '추가 4 약', mock: 'E17-OptMeds', preview: { dog: DOG, screen: 'optMeds', seed: { ...BODY_5, medications: '관절 영양제' } } },
  { key: 'loading', title: '분석 중', mock: 'E18-Loading', preview: { dog: DOG, screen: 'loading', seed: BODY_5, loadingStage: 2 } },
  { key: 'allergy-has', title: '알레르기 있어요', mock: 'F22-AllergyHas', preview: { dog: DOG, screen: 'allergy', seed: { ...BODY_5, dlMode: 'has', allergies: ['소고기', '양고기', '유제품'], preferredProteins: ['chicken'] } } },
  { key: 'allergy-has-end', title: '알레르기 있어요 · 끝까지 내림', mock: 'F22b-AllergyHasEnd', preview: { dog: DOG, screen: 'allergy', scroll: 'end', seed: { ...BODY_5, dlMode: 'has', allergies: ['소고기', '양고기', '유제품'], preferredProteins: ['chicken'] } } },
  { key: 'chronic-has', title: '질환 있어요', mock: 'F23-ChronicHas', preview: { dog: DOG, screen: 'chronic', seed: { ...BODY_5, hasChronic: 'yes', chronicConditions: ['kidney', 'pancreatitis'], irisStage: 2, pancreatitisSeverity: 'moderate' } } },
  // 시안 F24 는 끝이 아니라 신장 단계가 보이는 자리까지(707px) 내린 그림이다.
  { key: 'chronic-stage', title: '질환 · 단계까지 내림', mock: 'F24-ChronicStage', preview: { dog: DOG, screen: 'chronic', scroll: 707, seed: { ...BODY_5, hasChronic: 'yes', chronicConditions: ['kidney', 'pancreatitis'], irisStage: 2, pancreatitisSeverity: 'moderate' } } },
  { key: 'weight-method', title: '체중 잰 방법 창', mock: 'F25-WeightMethod', click: '체중을 어떻게', preview: { dog: DOG, screen: 'weight', weightMethod: 'home_digital', seed: { ...BODY_5, weightTrend: 'stable', easyKeeper: 'no' } } },
  { key: 'snack-kcal', title: '간식 칼로리 창', mock: 'F26-SnackKcal', click: '하루 간식 칼로리를', preview: { dog: DOG, screen: 'snack', seed: { ...BODY_5, snackFreq: '가끔' } } },
  { key: 'exercise-cold', title: '운동 · 실외 겨울', mock: 'F27-ExerciseCold', preview: { dog: DOG, screen: 'optExercise', scroll: 'end', seed: { ...BODY_5, vigorous: 'none', housing: 'outdoor', coldOutdoor: 'yes' } } },
  { key: 'meds-suggest', title: '약 → 질환 제안', mock: 'F28-MedsSuggest', preview: { dog: DOG, screen: 'optMeds', seed: { ...BODY_5, medications: '멜록시캄, 오메가-3' } } },
  { key: 'pregnancy-week', title: '임신 주차', mock: 'F29-PregnancyWeek', preview: { dog: GIRL, screen: 'pregnancy', seed: { ...BODY_5, pregnancy: 'pregnant' } } },
  { key: 'pregnancy-litter', title: '수유 마릿수', mock: 'F30-PregnancyLitter', preview: { dog: GIRL, screen: 'pregnancy', seed: { ...BODY_5, pregnancy: 'lactating' } } },
  { key: 'pregnancy-puppy', title: '어린 강아지 임신 안내', mock: 'F31-PregnancyPuppy', preview: { dog: PUPPY, screen: 'pregnancy', seed: { ...BODY_5, pregnancy: 'pregnant' } } },
  {
    key: 'body-conflict',
    title: '체중↔체형 모순',
    mock: 'F32-BodyConflict',
    previous: { bcs: 5, weightKg: 11.6 },
    preview: { dog: DOG, screen: 'abdomen', scroll: 'end', seed: { bodyAssess: { ribs: 'slight_pressure', waist: 'slight', abdomen: 'sagging' }, bcs: 6 } },
  },
  { key: 'refine-start', title: '정확도 올리기 시작', mock: 'L19-RefineStart', refine: true, preview: { dog: DOG, screen: 'optFood' } },
  { key: 'refine-exit', title: '정확도 올리기 나가기', mock: 'L20-RefineExit', refine: true, click: '나가기', preview: { dog: DOG, screen: 'optFood' } },
  { key: 'no-answer', title: '안 고르고 다음', mock: 'L21-NoAnswer', preview: { dog: DOG, screen: 'ribs', err: NO_ANSWER_RIBS } },
  // 새 첫 화면 마지막 장 — 가입하자마자 들어온 설문 첫 질문(위 줄 자리에 '가입 완료' 띠, 실제는 3.5초 뒤 위 줄로).
  { key: 'welcome', title: '가입 직후 첫 질문', mock: 'Y7-Survey1', preview: { dog: DOG, screen: 'ribs', welcome: true, seed: { bodyAssess: { ribs: 'easy', waist: '', abdomen: '' } } } },
  { key: 'welcome-live', title: '가입 직후 첫 질문 · 3.5초 뒤 위 줄로', mock: '—', preview: { dog: DOG, screen: 'ribs', welcome: 'live' } },
  { key: 'save-failed', title: '저장 실패', mock: 'L33-SaveFailed', preview: { dog: DOG, screen: 'loading', seed: BODY_5, loadingStage: 2, err: '저장하지 못했어요' } },
  { key: 'exit-confirm', title: '설문 나가기 확인', mock: 'L34-ExitConfirm', click: '나가기', preview: { dog: DOG, screen: 'waist', seed: { bodyAssess: { ribs: 'easy', waist: 'slight', abdomen: '' } } } },
  {
    key: 'draft-restored',
    title: '이어 쓰기 복원',
    mock: 'L35-DraftRestored',
    // 7일 안에 저장된 초안(지금 먹는 밥 화면에서 멈춤) — 실제 복원 흐름이 화면·답을 채우고 알림을 띄운다.
    preview: {
      dog: DOG,
      screen: 'ribs',
      draft: {
        bodyAssess: { ribs: 'easy', waist: 'slight', abdomen: 'level' },
        bcs: 5,
        weightTrend: 'stable',
        easyKeeper: 'no',
        bristol: 4,
        giSensitivity: 'rare',
        foodType: '건식 사료',
        screen: 'food',
      },
    },
  },
]
