import { cookies, headers } from 'next/headers'
import { isAppRequest } from './app-context-request'

/**
 * isAppContextServer — 서버 컴포넌트 / Route Handler 에서 현재 요청이 앱
 * (PWA / Capacitor) 진입인지 판정.
 *
 * 신호 2개 (`lib/app-context-request.ts` 의 `isAppRequest` 가 정본):
 *   1. `ft_app=1` 쿠키 — `components/AppContextCookieSync.tsx` 가 client 마운트
 *      시 자동 set / unset. PWA 설치본을 커버한다.
 *   2. User-Agent 표식 — Capacitor 가 붙인다. **네이티브 앱의 첫 요청부터**
 *      잡히므로 쿠키가 아직 없는 콜드 스타트에서도 앱으로 렌더된다.
 *
 * ★2026-08-22 — 예전엔 쿠키만 봤다. 그래서 네이티브 앱을 처음 켜면 첫 화면이
 * **웹으로 렌더**됐고(쿠키가 없으니), 클라이언트가 쿠키를 심어도 이미 그려진
 * 화면은 그대로였다. 사장님이 "지금 그냥 웹으로 들어가지는데?" 로 잡아냈다.
 *
 * 활용:
 *   • AuthAwareShell 의 chrome dispatch
 *   • 페이지 단에서 마케팅 모듈 (banner / breadcrumb 등) 분기 렌더
 *   • API route 의 응답 분기 (예: 푸시 토큰 등록 정책)
 *
 * 호출 컨벤션: 항상 `await isAppContextServer()`. Next 16 의 cookies() 는
 * Promise 반환이라 sync API 가 없음.
 */
export async function isAppContextServer(): Promise<boolean> {
  const [store, headerList] = await Promise.all([cookies(), headers()])
  return isAppRequest({
    appCookie: store.get('ft_app')?.value,
    userAgent: headerList.get('user-agent'),
  })
}
