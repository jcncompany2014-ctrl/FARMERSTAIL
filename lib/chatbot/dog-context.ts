/**
 * AI 상담에 넘기는 강아지 정보(<dog_info>) — 순수 함수 (2026-10-13 점검, 규칙191).
 *
 * # 왜
 * 예전엔 알레르기를 `dogs.allergies` 에서 읽었다. 그 칸은 **항상 비어 있다** — 알레르기는 설문
 * (surveys.answers.allergies)에만 저장된다. 그래서 AI 는 모든 강아지를 '알러지: 없음'으로 받았고,
 * 9/14 실제 대화에서 소고기·계란 알레르기견에게 소고기·계란을 권했다.
 * 이제 그 강아지의 **최신 설문**에서 알레르기·기저질환을 읽고, 모르면 '없음'이 아니라 '알 수 없음'으로 넘긴다
 * (시스템 프롬프트가 '알 수 없음이면 먼저 묻기'를 지킨다).
 *
 * `@/` 값 import 없음 — node 테스트(lib/chatbot/dog-context.test.ts)가 그대로 읽는다.
 */
import { CHRONIC_CONDITION_LABELS } from '../nutrition/guidelines.ts'

export type ChatDogRow = {
  name: string | null
  breed: string | null
  age_value: number | null
  age_unit: string | null
  weight: number | null
  gender: string | null
  neutered: boolean | null
}

/** 최신 설문 한 행 — 없으면 null(설문 기록 없음). */
export type ChatSurveyRow = {
  answers: unknown
  chronic_conditions: string[] | null
} | null

/** 자유 입력이 섞일 수 있는 값 — 태그 탈출·명령 주입을 막으려고 꺾쇠·중괄호를 빼고 길이를 자른다. */
export function sanitizeChatValue(v: unknown, max: number): string {
  return String(v ?? '').replace(/[<>{}]/g, '').slice(0, max).trim()
}

function strList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null
  return v.map((x) => sanitizeChatValue(x, 80)).filter((x) => x.length > 0)
}

/**
 * 설문의 알레르기. null = 모름(설문이 없거나 알레르기 문항 답이 없음) · [] = 설문에서 '없다'고 답함.
 * 모름과 없음을 섞지 않는 게 핵심이다 — 섞으면 AI 가 모르는 강아지에게 아무 재료나 권한다.
 */
export function allergiesFromSurvey(survey: ChatSurveyRow): string[] | null {
  if (!survey) return null
  const answers = survey.answers
  if (!answers || typeof answers !== 'object') return null
  return strList((answers as Record<string, unknown>).allergies)
}

/** 설문의 기저질환(한글 이름). surveys.chronic_conditions 칸이 정본, 비어 있으면 answers.chronicConditions. null = 모름. */
export function chronicFromSurvey(survey: ChatSurveyRow): string[] | null {
  if (!survey) return null
  const fromColumn = strList(survey.chronic_conditions)
  const fromAnswers =
    survey.answers && typeof survey.answers === 'object'
      ? strList((survey.answers as Record<string, unknown>).chronicConditions)
      : null
  const keys = fromColumn && fromColumn.length > 0 ? fromColumn : (fromAnswers ?? fromColumn)
  if (!keys) return null
  const labels = CHRONIC_CONDITION_LABELS as Record<string, string>
  return keys.map((k) => labels[k] ?? k)
}

/** 알레르기 줄 — '알 수 없음' 문구는 시스템 프롬프트의 '먼저 묻기' 규칙과 같은 말이어야 한다. */
export const ALLERGY_UNKNOWN = '알 수 없음 (설문 기록 없음)'

export function allergyLine(allergies: string[] | null): string {
  if (allergies === null) return ALLERGY_UNKNOWN
  if (allergies.length === 0) return '없음 (최신 설문에서 없다고 답함)'
  return `${allergies.join(', ')} (최신 설문 기준 — 이 재료는 어떤 형태로도 권하지 않기)`
}

export function chronicLine(chronic: string[] | null): string {
  if (chronic === null) return '알 수 없음 (설문 기록 없음)'
  if (chronic.length === 0) return '없음 (최신 설문 기준)'
  return `${chronic.join(', ')} (최신 설문 기준)`
}

/**
 * <dog_info> 블록. dog 가 null 이면(조회 실패·남의 강아지) 이름 없이 알 수 없음만 넘긴다 —
 * 그래야 AI 가 '없음'으로 착각하지 않고 먼저 묻는다.
 */
export function buildDogInfoBlock(dog: ChatDogRow | null, survey: ChatSurveyRow): string {
  const allergies = allergiesFromSurvey(survey)
  const chronic = chronicFromSurvey(survey)
  if (!dog) {
    return `
<dog_info>
- 강아지 정보를 불러오지 못했어요
- 알러지: ${ALLERGY_UNKNOWN}
- 기저질환: 알 수 없음
</dog_info>
`
  }
  return `
<dog_info>
- 이름: ${sanitizeChatValue(dog.name, 50)}
- 견종: ${sanitizeChatValue(dog.breed ?? '미상', 50)}
- 나이: ${dog.age_value ?? '?'} ${sanitizeChatValue(dog.age_unit, 10)}
- 체중: ${dog.weight ?? '?'} kg
- 성별: ${sanitizeChatValue(dog.gender ?? '미상', 10)} ${dog.neutered ? '(중성화 완료)' : ''}
- 알러지: ${allergyLine(allergies)}
- 기저질환: ${chronicLine(chronic)}
</dog_info>
`
}
