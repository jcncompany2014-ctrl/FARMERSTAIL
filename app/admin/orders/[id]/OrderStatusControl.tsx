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
import { DUPLICATE_TRACKING, DUPLICATE_TRACKING_CHECK_FAILED } from '@/lib/admin/tracking-duplicates'
import { askNightPushChoice, NIGHT_PUSH_CONFIRM, type NightPushChoice } from '@/lib/admin/night-push'

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
    // ★결과를 말하는 확인창(11차 점검 B, 2026-10-06 첫 발송일) — '배송 완료'는 고객에게 "잘 도착했어요" 알림이 바로
    //   가고 되돌릴 수 없는데, '발송 완료'로 착각해 누르기 쉬웠다(9/30 실측: 발송 7초 뒤 배송 완료). '준비 중'으로
    //   되돌리면 그 박스가 피킹 리스트·라벨에 다시 뜬다.
    const consequence =
      next === 'delivered'
        ? '\n\n⚠ 고객에게 "배송이 완료됐어요" 알림이 바로 가고, 되돌릴 수 없어요.\n고객이 실제로 받은 게 확인됐을 때만 누르세요.\n(택배에 넘긴 건 오른쪽 "발송 처리"의 "배송 시작"이에요.)'
        : next === 'preparing' && currentOrderStatus === 'shipping'
          ? '\n\n⚠ 이 박스가 피킹 리스트·라벨에 다시 떠요. 송장을 잘못 넣은 거라면 "운송장 수정"을 쓰세요.'
          : ''
    if (!confirm(`상태를 "${ORDER_STATUS_LABEL[next]}"(으)로 변경할까요?${consequence}`)) return

    setLoading(true)
    // POST via admin route — FSM 재검증 + 푸시 알림 포함. 직접 table update 하지 않음.
    // 밤 알림 확인(규칙239)에서 사장님이 고른 값 — 고르기 전엔 undefined 라 본문에서 빠진다(JSON 은 undefined 칸을 지운다).
    let nightPush: NightPushChoice | undefined
    let duplicateConfirmed = false
    const send = (confirmDuplicate: boolean) =>
      fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: next, confirmDuplicate, nightPush }),
      })
    // 확인 창에서 멈추면(취소·다른 409) 버튼을 풀고 이유를 알린다.
    const stop = (message: string) => {
      setLoading(false)
      toast.error(message)
    }
    let res = await send(false)
    // 서버가 409 로 묻는 확인은 둘이다 — 하나씩 답하고 다시 보낸다(둘 다 물을 수 있어 두 번까지).
    //  · ★송장 중복(2026-10-14 점검 O7 — 발송 처리 패널 ShippingControl 과 같은 방식, 규칙198). 저장된 송장으로
    //    '배송 중'을 다시 누르면 같은 택배사·번호가 다른 주문에 있는지 묻는다. 예전엔 이 409 를 그냥 '변경 실패'로 띄웠다.
    //  · ★밤 알림(2026-10-14 메일 점검 M5, 규칙239) — 22~8시엔 손님 휴대폰 알림이 가기 전에 묻는다(10/08 22:43 실제로 나갔다).
    for (let round = 0; round < 2; round++) {
      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as { code?: string; message?: string }
        if ((data.code === DUPLICATE_TRACKING || data.code === DUPLICATE_TRACKING_CHECK_FAILED) && !duplicateConfirmed) {
          const ok = window.confirm(`${data.message ?? '같은 송장번호가 다른 주문에 있어요.'}\n\n그래도 저장할까요?`)
          if (!ok) return stop('바꾸지 않았어요 — 송장번호를 확인해 주세요')
          res = await send(true)
          duplicateConfirmed = true
        } else if (data.code === NIGHT_PUSH_CONFIRM && !nightPush) {
          const choice = askNightPushChoice(data.message ?? '지금은 밤이에요. 손님에게 알림이 바로 가요.')
          if (!choice) return stop('바꾸지 않았어요 — 아침 8시 이후에 다시 눌러 주세요')
          nightPush = choice
          res = await send(duplicateConfirmed)
        } else {
          // 다른 409 — 본문을 이미 읽었으니 여기서 안내하고 끝낸다.
          return stop('변경 실패: ' + (data.message ?? '알 수 없는 오류'))
        }
      }
    }
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error('변경 실패: ' + (data?.message ?? '알 수 없는 오류'))
      return
    }
    if (nightPush === 'skip') toast.success('바꿨어요 — 앱 알림은 보내지 않았어요(메일은 갔어요)')
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
