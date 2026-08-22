import WebChrome from '@/components/WebChrome'
import AppChrome from '@/components/AppChrome'
import { isAppContextServer } from '@/lib/app-context'

/**
 * AuthAwareShell — 컨텍스트 기반 chrome dispatcher.
 *
 * # Web/App 분리 (옵션 B)
 *
 * 같은 라우트 (/products, /cart, /checkout, /blog 등) 라도 진입 컨텍스트가
 * 다르면 다른 chrome 으로 감싼다:
 *
 *   • 웹 (브라우저)        → WebChrome — 풀와이드 파머스독(FD) 톤
 *   • 앱 (PWA/Capacitor)   → AppChrome — 폰 프레임 + 하단 탭바
 *
 * 컨텍스트 감지: `isAppContextServer()` **정본** (쿠키 + UA 표식).
 *
 * ★2026-08-22 — 예전엔 여기서 `ft_app` 쿠키를 **직접** 읽고 "첫 요청에는
 * 쿠키가 없어 WebChrome 으로 fallback, 두 번째 요청부터 정확" 이라고 적어
 * 두었다. 네이티브 앱에서는 그 "fallback" 이 **앱의 첫인상 전체**다 —
 * 스토어에서 받은 앱을 켰는데 웹 화면이 떴다(사장님이 v2 에서도 재현).
 * proxy.ts 는 UA 표식을 보도록 고쳐졌는데 이 파일이 남아 있었다 — 판정이
 * 두 벌이면 반드시 이렇게 갈라진다. 지금은 정본 한 곳만 쓴다(규칙58 이
 * 직접 읽기 재발을 저장소 전체에서 막는다).
 *
 * # 어디 쓰이나
 *
 * 그룹 외부의 commerce / marketing 라우트:
 *   /products, /products/[slug], /cart, /checkout/*, /mypage/orders/*,
 *   /blog/*, /events/*, /collections/*, /brand, /about, /business
 *
 * `(main)` 그룹 내부는 자체 layout.tsx 가 항상 AppChrome (auth gate 포함).
 *
 * # 호환성 props
 *
 * `publicBackHref`, `publicBackLabel` — 호출처 시그니처 호환. 사용 안 함.
 */
export default async function AuthAwareShell({
  children,
}: {
  children: React.ReactNode
  /** @deprecated 사용 안 함. */
  publicBackHref?: string
  /** @deprecated 사용 안 함. */
  publicBackLabel?: string
}) {
  const isApp = await isAppContextServer()

  if (isApp) {
    return <AppChrome>{children}</AppChrome>
  }
  return <WebChrome>{children}</WebChrome>
}
