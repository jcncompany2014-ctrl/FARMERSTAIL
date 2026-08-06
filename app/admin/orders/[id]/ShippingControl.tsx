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
 * 이미 발송한 주문(shipping/delivered)은 **운송장만** 고친다 —
 * `PATCH /api/admin/orders/[id]/tracking`. 상태 전이가 아니므로 FSM 을 타지 않고,
 * 배송 시작 푸시/메일도 다시 나가지 않는다.
 *
 * 2026-08-07 이전엔 이 자리가 `수정 기능은 곧 열려요` 였고 그 엔드포인트가 없어서,
 * 송장을 잘못 넣으면 shipping→preparing→재발송 말고는 방법이 없었다(고객에게
 * 배송 시작 알림이 두 번 갔다).
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

  // 이미 발송된 주문 — 운송장 정정만 가능.
  const isShipped =
    currentOrderStatus === 'shipping' || currentOrderStatus === 'delivered'
  const canShipNow = canTransitionOrderStatus(
    currentOrderStatus,
    'shipping',
    { payment_status: paymentStatus, actor: 'admin' },
  ).ok

  // 발송 전(전환 가능) 도, 발송 후(정정) 도 아니면 패널 노출 안 함.
  if (!isShipped && !canShipNow) return null

  const dirty =
    trackingNumber.trim() !== (currentTrackingNumber ?? '') ||
    carrier !== currentCarrier

  async function submit() {
    const trimmed = trackingNumber.trim()
    if (!trimmed) {
      setError('송장번호를 입력해 주세요')
      return
    }
    setError(null)
    setLoading(true)

    // 발송 후에는 상태 전이가 아니라 운송장 정정이다. 배송 시작 알림은 다시
    // 나가지 않는다.
    const res = isShipped
      ? await fetch(`/api/admin/orders/${orderId}/tracking`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ carrier, trackingNumber: trimmed }),
        })
      : await fetch(`/api/admin/orders/${orderId}/status`, {
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
      setError(
        data?.message ??
          (isShipped ? '운송장 수정에 실패했어요' : '발송 처리에 실패했어요'),
      )
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <section className="p-6 rounded-lg bg-white border border-zinc-200">
      <h2 className="text-sm font-bold text-zinc-900 mb-1">
        {isShipped ? '운송장 수정' : '발송 처리'}
      </h2>
      <p className="text-[11px] text-zinc-500 mb-4">
        {isShipped
          ? '잘못 입력한 송장을 고칠 수 있어요. 배송 시작 알림은 다시 가지 않고, 번호가 바뀌면 변경 안내만 한 번 갑니다.'
          : '택배사와 송장번호를 입력하면 배송 중으로 전환됩니다.'}
      </p>

      <div className="space-y-3">
        <label className="block">
          <span className="block text-[11px] text-zinc-500 mb-1">택배사</span>
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value as CarrierCode)}
            disabled={loading}
            className="w-full px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200 text-sm disabled:opacity-50"
          >
            {CARRIER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-[11px] text-zinc-500 mb-1">송장번호</span>
          <input
            type="text"
            inputMode="numeric"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            disabled={loading}
            placeholder="송장번호를 입력하세요"
            className="w-full px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200 text-sm font-mono disabled:opacity-50"
          />
        </label>

        {error && (
          <p className="text-[11px] text-sale font-semibold">{error}</p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={loading || (isShipped && !dirty)}
          className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-moss text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-moss/90 transition"
        >
          {loading
            ? '처리 중…'
            : isShipped
              ? dirty
                ? '운송장 저장'
                : '수정할 내용 없음'
              : '배송 시작'}
        </button>
      </div>
    </section>
  )
}
