/**
 * 앱 안에서 열린 웹 전용 화면(가게)을 **폰의 브라우저로** 넘기는 주소 — 순수 함수(2026-10-13, 규칙205).
 *
 * # 왜
 * 안드로이드 14 이하에선 앱 링크 제외(매니페스트 uri-relative-filter-group — 안드로이드 15 부터)가 안 먹어, 앱이 깔린
 * 폰에서 가게(/store) 링크를 누르면 앱이 열린다. 앱은 가게를 그리지 않으므로(웹/앱 분리 — 단품은 웹에서만) 예전엔
 * /dashboard 로 돌려보냈고, 손님은 가게로 갈 길이 없었다. 이제 app/store/layout 이 안내 화면을 띄우고 이 주소로 넘긴다.
 *
 * # 무엇으로 여나 — capacitor.config.ts · MainActivity · Capacitor 소스를 읽고 정한 것
 *  · 우리 주소(www.farmerstail.kr)는 capacitor allowNavigation('farmerstail.kr'·'*.farmerstail.kr')에 들어 있어
 *    WebView 가 **앱 안에서** 연다(Bridge.launchIntent·iOS WebViewDelegationHandler). 일반 링크로는 못 나간다.
 *  · 안드로이드: MainActivity 가 `intent:` 링크를 Intent.parseUri 로 직접 연다(versionCode 12+). 패키지를 크롬으로
 *    박아야 한다 — 패키지 없이 https 로 열면 안드로이드 14 이하에선 그 주소를 앱 링크로 가진 **우리 앱이 다시** 받는다.
 *    크롬이 없으면 MainActivity 가 크롬 스토어 화면으로 보낸다(대체 주소를 우리 주소로 주면 다시 앱 안에서 열려 소용없다).
 *    target="_blank" 는 안드로이드 WebView 가 새 창을 안 열어(멀티 윈도우 꺼짐) 같은 화면에서 열린다 — 안 된다.
 *  · 아이폰: target="_blank" 링크 → Capacitor 가 새 창 대신 UIApplication.open(사파리)으로 넘긴다
 *    (WebViewDelegationHandler createWebViewWith). 가게는 AASA 에서 빠져 있어(규칙175) 사파리에 그대로 머문다.
 *    `x-safari-https:` 는 우리 호스트라 allowNavigation 검사에서 앱 안으로 들어가 버려 못 쓴다.
 *  · 설치형 PWA: target="_blank" 가 브라우저를 연다.
 */

/** 가게 정본 주소(www). */
export const STORE_WEB_ORIGIN = 'https://www.farmerstail.kr'
export const STORE_WEB_HOME = `${STORE_WEB_ORIGIN}/store`

/** 크롬 패키지 — intent 링크가 우리 앱으로 되돌아오지 않게 박는다. */
export const ANDROID_CHROME_PACKAGE = 'com.android.chrome'

/**
 * 앱 안 가게 주소 → 브라우저로 열 주소. 가게 경로(/store, /store/…)면 그 화면 그대로(검색어 포함), 아니면 가게 첫 화면.
 * 경로에 다른 호스트를 끼워 넣는 형태(//, 역슬래시)는 받지 않는다.
 */
export function storeWebUrl(pathname: string, search = ''): string {
  if (typeof pathname !== 'string' || /[\\\s]|\/\//.test(pathname)) return STORE_WEB_HOME
  if (pathname !== '/store' && !pathname.startsWith('/store/')) return STORE_WEB_HOME
  const q = typeof search === 'string' && search.startsWith('?') && !/[\s#]/.test(search) ? search : ''
  return `${STORE_WEB_ORIGIN}${pathname}${q}`
}

/**
 * https 가게 주소 → 안드로이드에서 크롬으로 여는 intent 링크. 우리 가게 주소가 아니면 null(아무 데도 안 보낸다).
 * 형식: intent://호스트/경로?검색#Intent;scheme=https;action=…VIEW;category=…BROWSABLE;package=com.android.chrome;end
 */
export function androidChromeIntentUrl(httpsUrl: string): string | null {
  let u: URL
  try {
    u = new URL(httpsUrl)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' || u.origin !== STORE_WEB_ORIGIN || u.username || u.password) return null
  if (u.pathname !== '/store' && !u.pathname.startsWith('/store/')) return null
  return (
    `intent://${u.host}${u.pathname}${u.search}` +
    `#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=${ANDROID_CHROME_PACKAGE};end`
  )
}
