import type { Metadata } from 'next'
import { Suspense } from 'react'
import StoreShell from '@/components/store/StoreShell'
import ConfirmPayment from '@/components/store/ConfirmPayment'

/** 결제창 successUrl — 승인 후 주문 완료(/store/order/[주문번호])로. */
export const metadata: Metadata = { title: '결제 마무리', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default function OrderCompletePage() {
  return (
    <StoreShell header={{ variant: 'title', title: '결제', backHref: '/store/cart' }} footer={false}>
      <Suspense fallback={null}>
        <ConfirmPayment />
      </Suspense>
    </StoreShell>
  )
}
