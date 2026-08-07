/**
 * 지금 **설치된 앱(standalone)** 안에서 도는가 — 정본 한 곳.
 * (2026-08-05, 사장님: "분석페이지 결과공유(pdf) 페이지가 작동안하는데")
 *
 * # 왜 필요한가
 * 수의사 리포트의 "인쇄 / PDF 저장" 버튼은 `window.print()` 하나였다. 그런데
 * **홈 화면에 설치한 앱(standalone)에는 브라우저 인쇄 UI 자체가 없다** — iOS
 * Safari 의 standalone 웹앱에서 `window.print()` 는 예외도 안 던지고 그냥
 * 아무 일도 일어나지 않는다. 버튼을 눌렀는데 화면이 그대로인 이유가 이것이다.
 * 코드에 실패 경로가 없으니 안내조차 못 했다.
 *
 * # 왜 파일로 뺐나
 * 같은 판정이 이미 두 곳에 따로 있었다(InstallPrompt 의 isStandalone,
 * AppSplash 의 CSS 게이트). 규칙이 여러 곳에 있으면 갈라진다는 걸 이 저장소에서
 * 여러 번 확인했다 — 전화번호 검증이 네 곳에서 네 가지로 갈라져 있던 것처럼.
 */

import { isNativeApp } from '@/lib/capacitor'

/**
 * PWA standalone(홈 화면에서 실행) 여부.
 *
 * @returns SSR·판정 불가면 `false` — 서버에서는 알 수 없으므로 브라우저로
 *   가정한다. 잘못 true 를 주면 웹 사용자에게 "앱에서는 안 돼요" 안내가 뜬다.
 */
export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false
  // ★Capacitor WebView 도 "설치된 앱"이다 (2026-08-08 네이티브 감사).
  //   display-mode 도 navigator.standalone 도 안 채워져서 false 로 판정됐고,
  //   그러면 네이티브 앱 안에서 홈화면 설치 배너가 뜨고 인쇄 버튼이
  //   아무 일도 안 하는 window.print() 를 부른다.
  if (isNativeApp()) return true
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS Safari 는 display-mode 를 안 채우던 시절이 있어 navigator.standalone 도 본다.
  const navAny = window.navigator as Navigator & { standalone?: boolean }
  return Boolean(navAny.standalone)
}
