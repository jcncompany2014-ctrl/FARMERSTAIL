'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import {
  ORDER_STATUS_LABEL,
  isOrderStatus,
  isPaymentStatus,
  nextOrderStatuses,
  type OrderStatus,
} from '@/lib/commerce/order-fsm'

// 활성(현재) 상태 버튼 색 — orders 목록 배지와 같은 토큰 팔레트.
const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: 'bg-stone-500',
  preparing: 'bg-primary',
  shipping: 'bg-emerald-600',
  delivered: 'bg-emerald-700',
  cancelled: 'bg-destructive',
}

/**
 * 주문 상세(admin) 에서 상태를 바꾸는 버튼 패널.
 *
 * FSM에서 허용된 다음 상태만 활성 렌더. 나머지는 disabled 로 노출 — 관리자에게
 * "왜 못 바꾸나" 가 보이도록.
 */
export default function OrderStatusControl({
  orderId,
  currentOrderStatus,
  paymentStatus,
}: {
  orderId: string
  currentOrderStatus: string
  paymentStatus: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()

  // DB에서 읽어온 문자열이 FSM enum에서 벗어난 경우 방어.
  if (!isOrderStatus(currentOrderStatus) || !isPaymentStatus(paymentStatus)) {
    return (
      <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-bold text-destructive">
          주문 상태에 문제가 있어요
        </h2>
        <p className="text-[11px] text-muted-foreground">
          이 주문의 상태 값이 정상 범위를 벗어났어요. 개발 담당에게 이
          주문번호를 알려주세요.
        </p>
      </section>
    )
  }

  const allowed = nextOrderStatuses(currentOrderStatus, {
    payment_status: paymentStatus,
    actor: 'admin',
  })
  // 렌더는 terminal 포함 전체 5개 — disabled 표시로 어떤 전환이 불가한지 시각화.
  const allStates: OrderStatus[] = [
    'pending',
    'preparing',
    'shipping',
    'delivered',
    'cancelled',
  ]

  async function updateStatus(next: OrderStatus) {
    if (next === currentOrderStatus) return
    if (!allowed.includes(next)) return
    if (!confirm(`상태를 "${ORDER_STATUS_LABEL[next]}"(으)로 변경할까요?`)) return

    setLoading(true)
    // POST via admin route — FSM 재검증 + 푸시 알림 포함. 직접 table update 하지 않음.
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderStatus: next }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error('변경 실패: ' + (data?.message ?? '알 수 없는 오류'))
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-bold">주문 상태 관리</h2>
      <p className="mb-4 text-[11px] text-muted-foreground">
        {allowed.length === 0
          ? '이 주문은 더 이상 상태를 변경할 수 없어요'
          : '클릭해서 상태를 변경하세요'}
      </p>

      <div className="space-y-2">
        {allStates.map((s) => {
          const active = s === currentOrderStatus
          const enabled = active || allowed.includes(s)
          return (
            <button
              key={s}
              onClick={() => updateStatus(s)}
              disabled={!enabled || loading}
              className={`flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left text-sm font-semibold transition ${
                active
                  ? `${STATUS_COLOR[s]} text-white`
                  : 'bg-secondary hover:bg-accent'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <span>{ORDER_STATUS_LABEL[s]}</span>
              {active && <span className="text-xs">✓ 현재</span>}
            </button>
          )
        })}
      </div>
    </section>
  )
}
