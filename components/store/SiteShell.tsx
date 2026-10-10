import AppChrome from '@/components/AppChrome'
import StoreShell from './StoreShell'
import type { StoreHeaderProps } from './StoreHeader'
import { isAppContextServer } from '@/lib/app-context'

/**
 * 웹·앱이 같이 쓰는 주소(법정 문서·사업자 정보 등)의 바깥 틀 — AuthAwareShell 의 새 웹 판(2026-10-10 웹 리뉴얼).
 * 앱이면 AppChrome(그대로), 웹이면 새 웹 가게 틀(StoreShell). 새 디자인으로 다시 지은 화면만 이걸로 옮긴다 —
 * 예전 화면(넓은 PC 배치)을 가운데 480 칸에 넣으면 깨지므로 AuthAwareShell 자체는 바꾸지 않는다.
 */
export default async function SiteShell({ children, header }: { children: React.ReactNode; header?: StoreHeaderProps }) {
  if (await isAppContextServer()) return <AppChrome>{children}</AppChrome>
  return <StoreShell header={header}>{children}</StoreShell>
}
