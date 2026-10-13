/**
 * 화면 확대 — **앱에서만 막고 웹은 풀어 둔다**(2026-10-13 사장님 결정 "웹만 풀기", 규칙203). 순수 함수.
 *
 * # 무엇이 바뀌었나
 * 2026-07-12 "앱 전체 확대 축소 절대 안되게"로 루트 viewport 에 maximumScale:1 · userScalable:false 를 박았는데,
 * 루트라서 **웹(가게·매거진)까지** 잠겼다 — 저시력 손님이 글자를 키울 수 없었다(WCAG 1.4.4). 이제 루트 레이아웃의
 * generateViewport 가 요청마다 앱 문맥(lib/app-context isAppContextServer — ft_app 쿠키 · UA 표식)을 보고 앱일 때만 잠근다.
 *
 * # 왜 서버(generateViewport)로 — Next 16 문서 node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md
 *  · viewport 가 요청 정보(cookies·headers)를 읽으면 그 경로는 요청 때 그려진다. 2026-10-13 프로덕션 빌드 실측으로 이 사이트의
 *    화면은 이미 전부 요청 때 그려진다(경로표가 전부 ƒ — 정적 ○ 는 opengraph-image·robots.txt 뿐, 둘 다 레이아웃을 안 탄다).
 *    그래서 루트에서 읽어도 잃는 캐시가 없다. ⚠️ 나중에 웹 화면을 정적(○)으로 돌리려면 이 판정이 그 화면을 다시 동적으로
 *    만든다는 걸 기억할 것 — 그땐 문서의 '여러 루트 레이아웃'이나 앱 화면 묶음 쪽으로 옮긴다.
 *  · cacheComponents 는 꺼져 있다(next.config.ts) — 문서의 'With Cache Components'(Suspense·instant) 절은 해당 없다.
 *  · 서버가 첫 HTML 부터 잠그므로 스크립트·깜빡임이 없다. 네이티브 앱은 UA 표식으로 첫 요청부터 앱이고, 설치형 PWA 는
 *    쿠키를 처음 심을 때 AppContextCookieSync 가 화면을 한 번 새로 그린다(router.refresh).
 */

/** 앱에서 viewport 에 더하는 잠금 — 핀치 확대 + iOS 입력칸 자동 확대를 막는다. */
export const APP_ZOOM_LOCK = { maximumScale: 1, userScalable: false } as const

/** 기본 viewport 에 앱이면 잠금을 더한 새 값을 돌려준다(기본값은 건드리지 않는다). 웹이면 잠금 키 자체가 없다. */
export function withAppZoomLock<T extends object>(base: T, isApp: boolean): T & Partial<typeof APP_ZOOM_LOCK> {
  return isApp ? { ...base, ...APP_ZOOM_LOCK } : { ...base }
}
