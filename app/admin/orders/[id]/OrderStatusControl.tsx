'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ORDER_STATUSES = [
  { key: 'preparing', label: '준비 중', color: 'bg-terracotta' },
  { key: 'shipping', label: '배송 중', color: 'bg-moss' },
  { key: 'delivered', label: '배송 완료', color: 'bg-[#8BA05A]' },
  { key: 'cancelled', label: '취소', color: 'bg-sale' },
]

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

  async function updateStatus(next: string) {
    if (paymentStatus !== 'paid') {
      alert('결제가 완료되지 않은 주문은 상태를 변경할 수 없어요.')
      return
    }
    if (next === currentOrderStatus) return
    if (!confirm(`상태를 "${next}"(으)로 변경할까요?`)) return

    setLoading(true)
    const { error } = await supabase
      .from('orders')
      .update({ order_status: next })
      .eq('id', orderId)

    setLoading(false)

    if (error) {
      alert('변경 실패: ' + error.message)
      return
    }
    startTransition(() => router.refresh())
  }

  const disabled = paymentStatus !== 'paid' || loading

  return (
    <section className="p-6 rounded-2xl bg-white border border-rule">
      <h2 className="text-sm font-bold text-ink mb-1">주문 상태 관리</h2>
      <p className="text-[11px] text-muted mb-4">
        {paymentStatus !== 'paid'
          ? '결제 완료 후 변경 가능'
          : '클릭해서 상태를 변경하세요'}
      </p>

      <div className="space-y-2">
        {ORDER_STATUSES.map((s) => {
          const active = s.key === currentOrderStatus
          return (
            <button
              key={s.key}
              onClick={() => updateStatus(s.key)}
              disabled={disabled}
              className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition text-left flex items-center justify-between ${
                active
                  ? `${s.color} text-white`
                  : 'bg-bg text-text hover:bg-rule'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <span>{s.label}</span>
              {active && <span className="text-xs">✓ 현재</span>}
            </button>
          )
        })}
      </div>
    </section>
  )
}