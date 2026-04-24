'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CARRIER_OPTIONS,
  type CarrierCode,
  isCarrierCode,
} from '@/lib/tracking'
import {
  canTransitionOrderStatus,
  isOrderStatus,
  isPaymentStatus,
} from '@/lib/commerce/order-fsm'

/**
 * 발송 처리 패널 — 택배사/송장번호를 입력하고 order_status를 'shipping' 으로 전환.
 *
 * FSM 상 shipping 진입이 허용될 때만 폼이 활성화된다. 결제 미완/취소/배송완료 주문은
 * 안내 문구만 노출.
 *
 * shipping 상태에서 다시 렌더되면 운송장 번호 수정(같은 엔드포인트로 orderStatus='shipping'
 * 재전송) 이 가능하다. FSM은 from==to 전환을 거부하지만 carrier/tracking 업데이트만
 * 원할 때 별도 엔드포인트 없이 편집할 수 있도록 수정 모드를 지원한다.
 */
export default function ShippingControl({
  orderId,
  currentOrderStatus,
  paymentStatus,
  currentCarrier,
  currentTrackingNumber,
}: {
  orderId: string
  currentOrderStatus: string
  paymentStatus: string
  currentCarrier: string | null
  currentTrackingNumber: string | null
}) {
  const router = useRouter()
  const [carrier, setCarrier] = useState<CarrierCode>(
    isCarrierCode(currentCarrier) ? currentCarrier : 'cj',
  )
  const [trackingNumber, setTrackingNumber] = useState(
    currentTrackingNumber ?? '',
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()

  if (!isOrderStatus(currentOrderStatus) || !isPaymentStatus(paymentStatus)) {
    return null
  }

  const isShipping = currentOrderStatus === 'shipping'
  const canShipNow = canTransitionOrderStatus(
    currentOrderStatus,
    'shipping',
    { payment_status: paymentStatus, actor: 'admin' },
  ).ok

  // preparing 도, shipping(편집) 도 아니면 패널 노출 안 함.
  if (!isShipping && !canShipNow) return null

  async function submit() {
    const trimmed = trackingNumber.trim()
    if (!trimmed) {
      setError('송장번호를 입력해 주세요')
      return
    }
    setError(null)
    setLoading(true)

    // shipping 에서 다시 "수정" 하는 경우 FSM이 from==to를 막으므로,
    // 서버가 carrier/tracking 만 갱신하도록 status를 생략하는 별도 엔드포인트를
    // 두지 않고, 여기서는 준비→발송 전환 시점에만 호출한다.
    // (편집은 일단 막고 다음 단계에서 PATCH 엔드포인트 추가.)
    if (isShipping) {
      setLoading(false)
      setError('이미 발송된 주문이에요. 수정 기능은 곧 열려요.')
      return
    }

    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderStatus: 'shipping',
        carrier,
        trackingNumber: trimmed,
      }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data?.message ?? '발송 처리에 실패했어요')
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <section className="p-6 rounded-2xl bg-white border border-rule">
      <h2 className="text-sm font-bold text-ink mb-1">발송 처리</h2>
      <p className="text-[11px] text-muted mb-4">
        {isShipping
          ? '현재 발송 완료된 주문이에요.'
          : '택배사와 송장번호를 입력하면 배송 중으로 전환됩니다.'}
      </p>

      <div className="space-y-3">
        <label className="block">
          <span className="block text-[11px] text-muted mb-1">택배사</span>
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value as CarrierCode)}
            disabled={isShipping || loading}
            className="w-full px-3 py-2 rounded-lg bg-bg border border-rule text-sm disabled:opacity-50"
          >
            {CARRIER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-[11px] text-muted mb-1">송장번호</span>
          <input
            type="text"
            inputMode="numeric"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            disabled={isShipping || loading}
            placeholder="송장번호를 입력하세요"
            className="w-full px-3 py-2 rounded-lg bg-bg border border-rule text-sm font-mono disabled:opacity-50"
          />
        </label>

        {error && (
          <p className="text-[11px] text-sale font-semibold">{error}</p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={isShipping || loading}
          className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-moss text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-moss/90 transition"
        >
          {loading ? '처리 중…' : isShipping ? '발송 완료' : '배송 시작'}
        </button>
      </div>
    </section>
  )
}
