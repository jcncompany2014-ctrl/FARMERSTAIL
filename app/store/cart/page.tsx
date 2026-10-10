import type { Metadata } from 'next'
import StoreShell from '@/components/store/StoreShell'
import CartView from '@/components/store/CartView'

/** 장바구니 — 웹 시안 Cart. 담은 것은 브라우저에 있고, 금액은 상품표에서 다시 계산한다. */
export const metadata: Metadata = {
  title: '장바구니',
  robots: { index: false, follow: false },
}

export default function CartPage() {
  return (
    <StoreShell header={{ variant: 'title', title: '장바구니', backHref: '/store' }} footer={false}>
      <CartView />
    </StoreShell>
  )
}
