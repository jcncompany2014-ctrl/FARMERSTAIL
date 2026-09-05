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
  // 택배사를 사람이 직접 골랐나 — 초기 폴백('cj')과 구분한다.
  const [carrierTouched, setCarrierTouched] = useState(false)
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

  /**
   * 저장할 게 있나.
   *
   * ★택배사는 **사람이 실제로 고른 경우에만** 변경으로 친다 (2026-08-07 재감사).
   * `carrier` 초기값은 저장된 값이 없으면 'cj' 로 떨어지는데, 그걸 그대로
   * 비교하면 아무것도 안 건드렸는데 버튼이 활성이 된다. 그 상태로 누르면
   * **사장님이 고르지 않은 CJ** 가 저장되고, 고객에게 "운송장 정보가
   * 업데이트됐어요 · CJ대한통운" 이 나간다.
   */
  const dirty =
    trackingNumber.trim() !== (currentTrackingNumber ?? '') ||
    (carrierTouched && carrier !== currentCarrier)

  async function submit() {
    const trimmed = trackingNumber.trim()
    if (!trimmed) {
      setError('송장번호를 입력해 주세요')
      return
    }
    // 저장된 택배사가 없는데 고르지도 않았으면, 폴백('cj')이 조용히 저장되고
    // 그 이름이 고객 알림에 실린다. 명시적으로 고르게 한다.
    if (!currentCarrier && !carrierTouched) {
      setError('택배사를 골라 주세요')
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
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-bold">
        {isShipped ? '운송장 수정' : '발송 처리'}
      </h2>
      <p className="mb-4 text-[11px] text-muted-foreground">
        {isShipped
          ? '잘못 입력한 송장을 고칠 수 있어요. 배송 시작 알림은 다시 가지 않고, 번호가 바뀌면 변경 안내만 한 번 갑니다.'
          : '택배사와 송장번호를 입력하면 배송 중으로 전환됩니다.'}
      </p>
      {isShipped && !currentCarrier && (
        <p className="mb-3 text-[11px] font-semibold text-amber-700">
          이 주문에는 택배사가 저장돼 있지 않아요. 아래에서 실제 택배사를 골라
          주세요 — 기본값이 그대로 저장되지 않습니다.
        </p>
      )}

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">
            택배사
          </span>
          <select
            value={carrier}
            onChange={(e) => {
              setCarrier(e.target.value as CarrierCode)
              setCarrierTouched(true)
            }}
            disabled={loading}
            className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm disabled:opacity-50"
          >
            {CARRIER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">
            송장번호
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            disabled={loading}
            placeholder="송장번호를 입력하세요"
            className="w-full rounded-lg border border-input bg-secondary px-3 py-2 font-mono text-sm disabled:opacity-50"
          />
        </label>

        {error && (
          <p className="text-[11px] font-semibold text-destructive">{error}</p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={loading || (isShipped && !dirty)}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
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
