import AppNotFoundScreen from '@/components/v3/system/AppNotFoundScreen'

/**
 * 앱(AppChrome) 안에서의 404.
 *
 * # 왜 따로 필요한가 (2026-08-07 예외 UX 감사)
 * 이 파일이 없으면 `(main)` 안에서 `notFound()` 가 루트 `app/not-found.tsx` 로
 * 떨어진다. 그러면 두 가지가 동시에 깨진다:
 *   ① `(main)/layout.tsx` 의 AppChrome 이 **통째로 사라진다** — 앱을 쓰던
 *      사람에게 갑자기 웹 톤 화면이 뜬다(웹/앱 분리 규칙 위반).
 *   ② 그 화면의 CTA 가 **"2분 설문 시작하기 → /start"** 다. /start 는
 *      **비로그인 설문→가입** 퍼널이라, 로그인한 구독자에게 가입을 권하는
 *      셈이 된다. mypage/orders 가 주석으로 "★로그인 상태라 /start 금지"라고
 *      못 박아 둔 바로 그 실수다.
 *
 * 여기서는 앱 사용자가 실제로 갈 만한 곳만 준다.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 시안 B05) — 화면은 components/v3/system/AppNotFoundScreen
 * 한 곳에서 그린다. 루트 not-found 의 앱 갈래(앱 요청인데 어떤 라우트에도 안 맞는 주소)도 같은 화면을
 * 쓴다 — 두 벌이면 한쪽만 고쳐진다. 큰 '404' 머리말은 뺐다(결정: 고객에게 오류 번호를 보이지 않는다).
 */
export default function AppNotFound() {
  return <AppNotFoundScreen />
}
