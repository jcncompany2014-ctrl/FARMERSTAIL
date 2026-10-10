/**
 * 가입 직후 설문 첫 질문의 '가입 완료' 띠(2026-10-09 앱 새 디자인, 캔버스 Y7).
 *
 * 가입하자마자 강아지가 만들어지는 두 길 — 카카오·애플(/start/onboard) · 이메일(인증 뒤 첫 로그인) — 이 설문 주소에
 * `?welcome=1` 을 붙이면, 설문이 첫 질문 위 줄 자리에 "가입 완료! 이제 ○○ 설문을 시작해요"를 잠깐 띄운다.
 * 오래된 계정(기존 회원이 새 첫 화면을 채운 뒤 로그인한 경우 등)에는 붙이지 않는다 — 가입한 게 아니니까.
 */

export const WELCOME_PARAM = 'welcome'

/** 강아지 정보 초안 수명(7일)과 같다 — 가입 메일 인증을 며칠 뒤에 해도 '방금 가입'으로 본다. */
const FRESH_MS = 7 * 86_400_000

/** 계정이 방금(7일 안) 만들어졌나. 시각을 못 읽으면 아니라고 본다(띠를 안 띄울 뿐이다). */
export function isFreshAccount(createdAt: string | null | undefined, now: number = Date.now()): boolean {
  const t = Date.parse(createdAt ?? '')
  if (!Number.isFinite(t)) return false
  const age = now - t
  // 기기 시계가 조금 느려 '미래에 만든 계정'으로 보일 수 있다 — 1분까지는 방금으로 친다.
  return age >= -60_000 && age < FRESH_MS
}

/** 설문 첫 주소 — welcome 이면 '가입 완료' 띠 표식을 붙인다. */
export function surveyStartHref(dogId: string, welcome: boolean): string {
  return `/dogs/${dogId}/survey${welcome ? `?${WELCOME_PARAM}=1` : ''}`
}
