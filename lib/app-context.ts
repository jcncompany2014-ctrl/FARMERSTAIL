import { cookies } from 'next/headers'

/**
 * isAppContextServer — 서버 컴포넌트 / Route Handler 에서 현재 요청이 앱
 * (PWA / Capacitor) 진입인지 판정.
 *
 * `ft_app=1` 쿠키 — `components/AppContextCookieSync.tsx` 가 client 마운트 시
 * 자동 set / unset. SSR 첫 요청에는 쿠키가 없을 수 있음 (cold install) → false.
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
  const store = await cookies()
  return store.get('ft_app')?.value === '1'
}
