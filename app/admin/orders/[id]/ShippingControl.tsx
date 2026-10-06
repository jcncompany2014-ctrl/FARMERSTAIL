'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CARRIER_OPTIONS,
  type CarrierCode,
  isCarrierCode,
  normalizeTrackingNumber,
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
/** KST 22시~08시인가 — 고객 알림 조용시간 기본값과 같은 구간. */
function isNightKst(now: Date = new Date()): boolean {
  const h = new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCHours()
  return h >= 22 || h < 8
}

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
  // ★저장된 택배사가 없으면 **빈 칸**에서 시작한다(11차 점검 B, 2026-10-06 첫 발송일). 예전엔 'cj' 로 미리 골라 둬서
  //   화면엔 CJ대한통운이 보이는데, 같은 옵션을 다시 골라도 change 이벤트가 안 나 '택배사를 골라 주세요'가 풀리지 않았다.
  const [carrier, setCarrier] = useState<CarrierCode | ''>(
    isCarrierCode(currentCarrier) ? currentCarrier : '',
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

  /**
   * 저장할 게 있나.
   *
   * ★택배사는 **사람이 실제로 고른 경우에만** 변경으로 친다 (2026-08-07 재감사).
   * 예전엔 저장된 값이 없으면 'cj' 로 미리 골라 둬서, 안 건드려도 버튼이 활성이 되고
   * **사장님이 고르지 않은 CJ** 가 저장될 수 있었다. 지금은 빈 칸('')에서 시작하므로
   * 고른 값만 변경으로 친다.
   */
  const dirty =
    trackingNumber.trim() !== (currentTrackingNumber ?? '') ||
    (carrier !== '' && carrier !== currentCarrier)

  async function submit() {
    // 송장번호는 띄어쓰기·하이픈을 뺀다(11차 점검 B) — 택배사 조회 API 가 하이픈 섞인 번호를 못 찾아
    // 배송조회 크론이 그 주문만 매일 조용히 건너뛰었다.
    const trimmed = normalizeTrackingNumber(trackingNumber)
    if (!trimmed) {
      setError('송장번호를 입력해 주세요')
      return
    }
    // 택배사는 반드시 사람이 고른다 — 고르지 않은 이름이 고객 알림에 실리면 안 된다.
    if (!carrier) {
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
            onChange={(e) => setCarrier(e.target.value as CarrierCode | '')}
            disabled={loading}
            className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm disabled:opacity-50"
          >
            {!isCarrierCode(currentCarrier) && (
              <option value="" disabled>
                택배사 선택
              </option>
            )}
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

        {/* ★밤 알림 경고(11차 점검 E) — 알림 설정을 안 건드린 고객은 조용시간이 없어, 밤에 누르면 "배송이 시작됐어요"가
            그 시각에 그대로 간다(9/30 23:29 실측). 막지는 않는다 — 사장님이 판단. */}
        {!isShipped && isNightKst() && (
          <p className="text-[11px] font-semibold text-amber-700">
            지금은 밤이에요 — 누르면 고객에게 지금 바로 &quot;배송이 시작됐어요&quot; 알림이 가요. 급하지 않으면 아침에 눌러 주세요.
          </p>
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
