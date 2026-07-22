// 트랙B(FD식 자동회원가입) B1 — 익명 설문 초안의 localStorage 보관 헬퍼.
//
// 설계: FD_AUTOSIGNUP_DESIGN.md. 사장님 확정(회차316) = **옵션 A(localStorage)**.
// 비회원이 /start 에서 강아지 기본(스텝0) + 설문에 답하는 동안 그 답을 이 키에
// 임시 보관했다가, '결과 직전' 가입 직후 계정으로 이관(dogs+surveys+analyses 생성).
//
// 왜 서버 테이블이 아니라 localStorage 인가:
//   - DB migration / anon RLS / PIPA 파기설계 0 → 불변영역 미접촉, 가장 안전·빠름.
//   - 트레이드오프: 교차기기(다른 브라우저에서 인증메일 열기) 시 초안 유실. 같은
//     브라우저면 이메일확인 ON/OFF 모두 생존 → 대다수 케이스 정상.
//
// NewDogClient.tsx 의 검증된 NewDogDraft 패턴(v 버전·ts 7일 만료·purity 회피용
// 모듈수준 함수)을 그대로 따른다. 이 모듈은 **순수 util** — 라우트/DB/인증 무관.

/** 강아지 기본 정보 — /dogs/new(NewDogClient) 필수 필드와 1:1. 영양계산 입력원.
 *  나이=생일 자동파생·활동량 폐지(2026-07-20 사장님). */
export type AutosignupDogDraft = {
  name?: string
  breed?: string
  gender?: 'male' | 'female' | ''
  neutered?: boolean | null
  /** 생일(YYYY-MM-DD) — 입력 소스. 나이는 여기서 자동 파생. NewDogClient 동일. */
  birthDate?: string
  /** 생일에서 파생한 나이 — 칼로리 알고리즘이 age_value/age_unit 을 읽어 downstream
   *  유지. 폼이 생일 입력 시 함께 갱신(순수 teaser 가 Date.now 없이 읽게 초안에 파생값 적재). */
  ageValue?: string
  ageUnit?: 'years' | 'months'
  /** 폼 입력 그대로 문자열 보관 — 이관 시 parseFloat. */
  weight?: string
}

/**
 * 설문 답변 묶음. 스텝별로 점진 저장되므로 모두 optional.
 * 실제 스키마는 SurveyClient 의 SurveyAnswers 와 정합 — B2 에서 채워 넣는다.
 * 지금은 구조만 열어둔다(타입 강결합은 B2 에서 import 정합화).
 */
export type AutosignupAnswersDraft = Record<string, unknown>

export type AutosignupDraft = {
  /** schema 버전 — 깨진/구버전 draft 무시. */
  v: 1
  /** 최종 저장 시각(ms). 7일 경과 시 자동 폐기. */
  ts: number
  dog: AutosignupDogDraft
  answers: AutosignupAnswersDraft
  /**
   * 프로모션 코드 — `/start?p=busan1102` 로 들어온 경우 (2026-07-16).
   *
   * 왜 여기 싣나: 링크로 들어와 **설문을 마치고 가입**할 때까지 살아 있어야 한다.
   * 초안이 이미 그 여정(링크→설문→가입)을 통째로 나르고 있어서, 별도 쿠키를 두는
   * 것보다 여기 붙이는 게 수명이 정확히 맞는다(초안이 죽으면 프로모션도 같이 죽는 게 맞다).
   * 가입 직후 `claim_promotion` 으로 계정에 박히고 나면 이 값은 쓸모가 없어진다.
   */
  promo?: string
  /** 앱 가입-먼저 흐름(Phase B, 2026-07-20) 표식 — 강아지정보 입력 후 가입, 설문은
   *  가입 뒤 앱내에서. true 면 로그인 훅이 applyAutosignupDraft(설문완료 가정 →
   *  dog+survey+analysis 일괄) 대신 createDogFromDraft(dog 만) → 앱 설문으로 보낸다.
   *  OAuth 경로는 /start/onboard 허브가 직접 처리하므로 이 표식과 무관(이메일 경로만
   *  공유 /login 훅을 타서 필요). */
  surveyDeferred?: boolean
}

/** 단일 익명 키 — userId 없음(비회원). 브라우저당 1개 초안. */
export const AUTOSIGNUP_DRAFT_KEY = 'ft:autosignup-draft'

/** 7일(ms) — NewDogDraft 와 동일 만료. */
const MAX_AGE_MS = 7 * 86_400_000

/**
 * 초안 로드. SSR/미존재/파싱오류/구버전/만료 → null(만료 시 키 삭제).
 * 모듈수준 함수 — react-hooks/purity 회피(Date.now()/localStorage 가 render
 * path 로 인식되지 않도록). NewDogClient.loadNewDogDraft 와 같은 이유.
 */
export function loadAutosignupDraft(): AutosignupDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTOSIGNUP_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AutosignupDraft>
    if (parsed.v !== 1) return null
    if (typeof parsed.ts === 'number' && Date.now() - parsed.ts > MAX_AGE_MS) {
      localStorage.removeItem(AUTOSIGNUP_DRAFT_KEY)
      return null
    }
    return {
      v: 1,
      ts: typeof parsed.ts === 'number' ? parsed.ts : Date.now(),
      dog: parsed.dog ?? {},
      answers: parsed.answers ?? {},
      ...(parsed.surveyDeferred ? { surveyDeferred: true } : {}),
    }
  } catch {
    return null
  }
}

/**
 * 초안 부분 갱신(merge). dog/answers 는 얕은 병합 — 스텝별 점진 저장에 맞춤.
 * ts 는 매 저장마다 현재 시각으로 갱신(만료 타이머 리셋). 실패는 silent(quota 등).
 */
export function saveAutosignupDraft(patch: {
  dog?: Partial<AutosignupDogDraft>
  answers?: Partial<AutosignupAnswersDraft>
  promo?: string
  surveyDeferred?: boolean
}): void {
  if (typeof window === 'undefined') return
  try {
    const prev = loadAutosignupDraft()
    const next: AutosignupDraft = {
      v: 1,
      ts: Date.now(),
      dog: { ...(prev?.dog ?? {}), ...(patch.dog ?? {}) },
      answers: { ...(prev?.answers ?? {}), ...(patch.answers ?? {}) },
      // 먼저 박힌 프로모션이 이긴다 — 링크를 여러 개 타고 와도 처음 것.
      // (계정당 1회라 DB 도 같은 규칙. 여기서 미리 맞춰 두면 화면 표시가 안 흔들린다.)
      ...(prev?.promo || patch.promo ? { promo: prev?.promo ?? patch.promo } : {}),
      ...(prev?.surveyDeferred || patch.surveyDeferred
        ? { surveyDeferred: true }
        : {}),
    }
    localStorage.setItem(AUTOSIGNUP_DRAFT_KEY, JSON.stringify(next))
  } catch {
    /* quota 초과 등 — silent (설문은 계속 진행 가능) */
  }
}

/** 초안 폐기 — 이관 완료 또는 사용자 명시 초기화 시. */
export function clearAutosignupDraft(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(AUTOSIGNUP_DRAFT_KEY)
  } catch {
    /* noop */
  }
}

/**
 * 강아지 기본 필드(이름·견종·성별·중성화·생일·체중)가 영양계산/dogs insert 에
 * 충분히 채워졌는지. 활동량은 폐지(2026-07-20). 나이는 생일 파생값(ageValue)이
 * 함께 채워진 것을 확인. 스텝0 → 설문 진행 가드(미완성이면 스텝0 으로)에 사용.
 */
export function isDogDraftComplete(dog: AutosignupDogDraft | undefined): boolean {
  if (!dog) return false
  return (
    !!dog.name?.trim() &&
    !!dog.breed &&
    (dog.gender === 'male' || dog.gender === 'female') &&
    (dog.neutered === true || dog.neutered === false) &&
    !!dog.birthDate &&
    !!dog.ageValue &&
    Number(dog.ageValue) > 0 &&
    (dog.ageUnit === 'years' || dog.ageUnit === 'months') &&
    !!dog.weight &&
    Number(dog.weight) > 0
  )
}
