'use client'

/**
 * 결제창에서 돌아온 곳(successUrl) — 승인(/api/payments/confirm)을 부르고, 되면 주문 완료 화면으로.
 * 토스는 승인을 부르기 전까지 돈을 가져가지 않는다(10분 안에 승인 안 하면 결제가 취소된다).
 * 장바구니 주문이었으면 장바구니를 비운다(바로 구매는 장바구니를 건드리지 않았다 — CHECKOUT_MODE_KEY).
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { clearStoreCart } from './useStoreCart'
import { CHECKOUT_MODE_KEY } from './CheckoutClient'
import { business } from '@/lib/business'

export default function ConfirmPayment() {
  const router = useRouter()
  const sp = useSearchParams()
  const started = useRef(false)
  const [error, setError] = useState<string | null>(null)

  const paymentKey = sp.get('paymentKey')
  const orderId = sp.get('orderId')
  const amount = Number(sp.get('amount'))
  const missing = !paymentKey || !orderId || !Number.isFinite(amount) || amount <= 0

  useEffect(() => {
    if (missing || started.current) return
    started.current = true
    ;(async () => {
      try {
        const res = await fetch('/api/payments/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentKey, orderId, amount }),
        })
        const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null
        if (!res.ok || !data?.ok) {
          setError(data?.message ?? '결제를 마무리하지 못했어요. 돈이 나갔다면 자동으로 취소돼요.')
          return
        }
        try {
          if (window.sessionStorage.getItem(CHECKOUT_MODE_KEY) === 'cart') clearStoreCart()
          window.sessionStorage.removeItem(CHECKOUT_MODE_KEY)
        } catch {
          /* 무시 */
        }
        router.replace(`/store/order/${encodeURIComponent(orderId ?? '')}`)
      } catch {
        setError('인터넷 연결이 끊겨 결제를 마무리하지 못했어요. 새로고침해 주세요.')
      }
    })()
  }, [router, missing, paymentKey, orderId, amount])

  const shownError = missing ? '결제 정보가 없어요. 주문 내역에서 결제가 됐는지 확인해 주세요.' : error
  if (shownError) {
    return (
      <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <strong className="d" style={{ fontSize: 26 }}>
          결제를 마무리하지 못했어요
        </strong>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: '#3D3D3D' }}>{shownError}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Link href="/mypage/orders" style={{ height: 56, borderRadius: 4, border: '1.5px solid #141414', color: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, textDecoration: 'none' }}>
            주문 내역 보기
          </Link>
          <Link href="/store/cart" style={{ height: 56, borderRadius: 4, background: '#141414', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, textDecoration: 'none' }}>
            장바구니로
          </Link>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: '#595959' }}>도움이 필요하면 {business.phone}로 전화 주세요.</p>
      </div>
    )
  }
  return (
    <div role="status" style={{ padding: '80px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-stamp.png" alt="" width={72} height={72} style={{ width: 72, height: 72 }} />
      <strong className="d" style={{ fontSize: 24 }}>
        결제를 마무리하고 있어요
      </strong>
      <span style={{ fontSize: 15, color: '#595959' }}>창을 닫지 말고 잠깐만 기다려 주세요</span>
    </div>
  )
}
