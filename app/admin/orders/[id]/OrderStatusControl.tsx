'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ORDER_STATUS_LABEL,
  isOrderStatus,
  isPaymentStatus,
  nextOrderStatuses,
  type OrderStatus,
} from '@/lib/commerce/order-fsm'

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: 'bg-muted',
  preparing: 'bg-terracotta',
  shipping: 'bg-moss',
  delivered: 'bg-[#8BA05A]',
  cancelled: 'bg-sale',
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
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()

  // DB에서 읽어온 문자열이 FSM enum에서 벗어난 경우 방어.
  if (!isOrderStatus(currentOrderStatus) || !isPaymentStatus(paymentStatus)) {
    return (
      <section className="p-6 rounded-2xl bg-white border border-rule">
        <h2 className="text-sm font-bold text-sale mb-1">주문 상태 손상</h2>
        <p className="text-[11px] text-muted">
          DB의 상태 값이 FSM 정의 바깥이에요. 데이터 확인이 필요합니다.
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
      alert('변경 실패: ' + (data?.message ?? '알 수 없는 오류'))
      return
    }
    startTransition(() => router.refresh())
  }

  // 미사용 변수 방어 — createClient 는 이 파일의 다른 훅에서 향후 확장 여지. 린터는
  // 사용 없음 경고를 낼 테니 바로 제거.
  void supabase

  return (
    <section className="p-6 rounded-2xl bg-white border border-rule">
      <h2 className="text-sm font-bold text-ink mb-1">주문 상태 관리</h2>
      <p className="text-[11px] text-muted mb-4">
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
              className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition text-left flex items-center justify-between ${
                active
                  ? `${STATUS_COLOR[s]} text-white`
                  : 'bg-bg text-text hover:bg-rule'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
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
