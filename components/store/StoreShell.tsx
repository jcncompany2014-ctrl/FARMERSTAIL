/**
 * 웹 가게 틀 — 머리줄 + 본문 + 법정 바닥. 모바일 폭 그대로, PC 에선 가운데 480 칸(.fts-page).
 * 웹에서만 쓴다: 상점 경로는 app/store/layout 이 앱에서 열리면 앱 홈으로 보내고, 홈(/)은 proxy 가 앱을 앱 홈으로 보낸다.
 */
import './store.css'
import StoreHeader, { type StoreHeaderProps } from './StoreHeader'
import StoreFooter from './StoreFooter'

export default function StoreShell({
  children,
  header,
  footer = true,
}: {
  children: React.ReactNode
  header?: StoreHeaderProps
  /** 결제 화면처럼 바닥을 빼는 곳. */
  footer?: boolean
}) {
  return (
    <div className="fts">
      <div className="fts-page" style={{ display: 'flex', flexDirection: 'column' }}>
        <StoreHeader {...(header ?? { variant: 'home' })} />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</main>
        {footer && <StoreFooter />}
      </div>
    </div>
  )
}
