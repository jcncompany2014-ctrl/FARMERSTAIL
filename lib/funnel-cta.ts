/**
 * 웹 마케팅 화면의 "플랜 보기 / 설문 시작" CTA 목적지 — 정본 한 곳.
 *
 * # 왜 필요한가 (2026-08-08 웹 퍼널 감사)
 * 2026-08-05 에 홈(`app/page.tsx`)에서 이 버그를 고쳤다:
 *   로그인 상태면 `/dogs/new` 로 보냈는데 그건 **앱 전용 경로**다
 *   (proxy 의 APP_ONLY_PREFIXES). 웹으로 가입한 고객이 그 버튼을 누르면
 *   `/app-required` **앱 설치 벽**으로 튕겼다 — 버튼엔 "2분 설문 시작하기"
 *   라고 써 있는데 설문이 안 열린다.
 *
 * 그런데 **홈만 고쳤다.** 같은 삼항이 남아 있던 곳:
 *   · `components/WebChrome.tsx` — 헤더 CTA · 스크롤 pill · 모바일 메뉴 · 푸터
 *     (= **모든 웹 페이지**에 붙는다. `/start` 퍼널 안에서도 보인다)
 *   · `app/about` · `app/faq` · `app/blog` · `app/our-food` · `app/partners`
 *     · `app/reviews` · `app/brand`
 *
 * 규칙21 이 이 부류를 잡으라고 있는 테스트인데 스캔 범위가 `app/account`
 * 한 폴더뿐이라 못 봤다. 고칠 때 **규칙 범위도 같이** 넓혔다.
 *
 * 한 곳에 두는 이유는 단순하다 — 홈만 고치고 나머지를 놓친 게 이 사고다.
 */
export function planHref(isAuthed: boolean, isApp: boolean): string {
  // 비로그인은 익명 퍼널로. 여기가 획득의 입구다.
  if (!isAuthed) return '/start'
  // 로그인했으면 강아지를 고르거나 등록하는 화면으로 —
  // **웹은 웹 경로로**. `/dogs/*` 는 앱 전용이라 웹에서 열면 설치 벽이다.
  return isApp ? '/dogs/new' : '/account/dogs'
}
