import { cookies } from 'next/headers'
import WebChrome from '@/components/WebChrome'
import AppChrome from '@/components/AppChrome'

/**
 * AuthAwareShell — 컨텍스트 기반 chrome dispatcher.
 *
 * # Web/App 분리 (옵션 B)
 *
 * 같은 라우트 (/products, /cart, /checkout, /blog 등) 라도 진입 컨텍스트가
 * 다르면 다른 chrome 으로 감싼다:
 *
 *   • 웹 (브라우저)        → WebChrome — 풀와이드 마켓컬리 톤
 *   • 앱 (PWA/Capacitor)   → AppChrome — 폰 프레임 + 하단 탭바
 *
 * 컨텍스트 감지: `ft_app` 쿠키.
 *   • `components/AppContextCookieSync.tsx` 가 PWA standalone / Capacitor
 *     네이티브 감지 시 client-side 에서 set.
 *   • SSR 첫 요청에는 쿠키가 없을 수 있어 (cold install) WebChrome 으로
 *     fallback. 두 번째 요청부터는 정확.
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
  const cookieStore = await cookies()
  const isApp = cookieStore.get('ft_app')?.value === '1'

  if (isApp) {
    return <AppChrome>{children}</AppChrome>
  }
  return <WebChrome>{children}</WebChrome>
}
