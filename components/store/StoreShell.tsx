/**
 * 웹 가게 틀 — 머리줄 + 본문 + 법정 바닥. 모바일 폭 그대로, 600~1023px 에선 가운데 480 칸(.fts-page).
 * 2026-10-18 PC(폭 1024 이상, 사장님 "가게형 ㄱㄱ"): 머리줄은 가로 메뉴, 바닥은 두 단으로 화면 끝까지. 본문은
 *  - wide: 넓게 다시 짠 화면(홈·스토어·상품 상세·후기) — 구획마다 최대 1200(store.css .fts-sec 등)
 *  - 그 밖: 예전처럼 가운데 480 칸(장바구니·주문·글·약관 등은 아직 폰 모양 그대로)
 * 웹에서만 쓴다: 상점 경로는 app/store/layout 이 앱에서 열리면 앱 홈으로 보내고, 홈(/)은 proxy 가 앱을 앱 홈으로 보낸다.
 */
import './store.css'
import StoreHeader, { type StoreHeaderProps } from './StoreHeader'
import StoreFooter from './StoreFooter'

export default function StoreShell({
  children,
  header,
  footer = true,
  wide = false,
}: {
  children: React.ReactNode
  header?: StoreHeaderProps
  /** 결제 화면처럼 바닥을 빼는 곳. */
  footer?: boolean
  /** PC 에서 본문을 넓게 쓰는 화면(구획마다 .fts-sec 로 1200 안에 맞춘다). */
  wide?: boolean
}) {
  return (
    <div className="fts">
      <div className="fts-page" style={{ display: 'flex', flexDirection: 'column' }}>
        <StoreHeader {...(header ?? { variant: 'home' })} />
        <main className="fts-main" data-wide={wide ? 'true' : undefined} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
        {footer && <StoreFooter />}
      </div>
    </div>
  )
}
