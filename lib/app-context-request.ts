/**
 * "이 요청이 앱에서 왔는가" — **정본 한 곳**. 순수 함수라 테스트 가능.
 *
 * # 왜 생겼나 (2026-08-22 — 사장님: "지금 그냥 웹으로 들어가지는데?")
 *
 * 네이티브 앱을 처음 켜면 WebView 가 www.farmerstail.kr 를 **쿠키 하나 없이**
 * 요청한다. 서버는 `ft_app` 쿠키로만 앱/웹을 갈랐기 때문에 첫 화면을 **웹으로
 * 렌더**했다. 그 뒤에야 클라이언트가 Capacitor 를 감지해 쿠키를 심지만,
 * **화면은 이미 웹으로 그려진 뒤**라 다시 그리는 것이 없다.
 *
 * PWA 시절엔 "다음 navigation 부터 정상"으로 넘어갔지만(AppContextCookieSync
 * 주석이 그렇게 적혀 있다), **네이티브 앱은 첫 화면이 곧 앱의 전부**다.
 * 사용자가 그 화면에 머물면 앱은 영원히 웹으로 보인다.
 *
 * 같은 뿌리로 함께 깨져 있던 것들(proxy.ts 가 이 쿠키를 3곳에서 본다):
 *  · `/` → `/dashboard` 이동이 안 된다. 로그인돼 있어도 마케팅 랜딩에 선다.
 *  · 앱 전용 라우트(/dashboard, /dogs/*)로 콜드 스타트하면 `/app-required`
 *    "앱을 설치하세요" 벽으로 튕긴다 — **앱 안에서** 그 화면이 뜬다.
 *
 * # 해법: User-Agent 표식
 *
 * Capacitor 의 `appendUserAgent` 로 WebView UA 끝에 표식을 붙인다. 그러면
 * **첫 요청의 헤더**에 이미 들어 있어 서버가 쿠키 없이도 안다 — 깜빡임도,
 * 왕복도 없다. 쿠키는 그대로 두어 PWA 설치본(UA 표식이 없다)을 계속 커버한다.
 *
 * # 위조 가능성 — 보안 등급이 내려가지 않는가
 *
 * UA 는 위조할 수 있다. 그런데 **쿠키도 똑같이 위조할 수 있다**
 * (`document.cookie = 'ft_app=1'` 한 줄). 이 판정이 지키는 것은 보안이 아니라
 * **화면 일관성**이다 — 데이터 격리는 RLS 가 한다(proxy.ts 의 주석도 "RLS 가
 * 데이터 격리하지만 UX 일관성" 이라고 적고 있다). 따라서 신뢰 등급 변화는
 * 없다. 돈·데이터 판정에 이 함수를 쓰면 안 된다.
 */

/**
 * WebView UA 끝에 붙는 표식.
 *
 * ⚠️ `capacitor.config.ts` 의 `appendUserAgent` 와 **같은 문자열이어야 한다.**
 * 그 파일은 Capacitor CLI 가 별도로 로드해서 `@/` 별칭을 못 쓰므로 값을
 * 복제해 둔다 — 대신 `lib/audit-rules.test.ts` 규칙58 이 두 값의 일치를
 * 강제한다(복제는 갈라지기 때문이다).
 */
export const APP_USER_AGENT_MARKER = 'FarmerstailApp'

export type AppRequestSignals = {
  /** `ft_app` 쿠키 값 (없으면 undefined/null). */
  appCookie?: string | null
  /** 요청의 User-Agent 헤더. */
  userAgent?: string | null
}

/**
 * 앱(네이티브 또는 설치된 PWA)에서 온 요청인가.
 *
 * 두 신호 중 **하나라도** 맞으면 앱으로 본다:
 *  1. `ft_app=1` 쿠키 — PWA 설치본 + 두 번째 요청 이후의 네이티브
 *  2. UA 표식 — 네이티브의 **첫 요청부터** (쿠키가 아직 없을 때)
 */
export function isAppRequest(signals: AppRequestSignals): boolean {
  if (signals.appCookie === '1') return true
  const ua = signals.userAgent
  if (ua && ua.includes(APP_USER_AGENT_MARKER)) return true
  return false
}
