import { isPaidStatus } from '../commerce/paid-status.ts'
import type { SubState } from '../subscription-state'

/**
 * 어드민 상태 배지 — 표 하나 (2026-10-24 어드민 2묶음, 규칙316).
 *
 * 화면마다 배지 표를 따로 만들어서, 전액 환불된 주문 하나가 홈에선 '취소', 목록에선 '결제 취소', 상세에선 '환불 완료'로
 * 나왔다. 한 번도 결제 안 된 주문이 '결제 취소'로 뜨기도 했다. 이제 주문·정기배송 배지는 여기 함수만 쓴다.
 *
 * 색 규칙(사장님 기획서 ⑥): 초록 = 돈 받음·잘 가는 중 · 주황 = 사장님이 할 일 · 빨강 = 막힘·돈 문제 ·
 * 회색 = 끝남·기다림 · 보라 = 할인·서포터즈 딱지 · 점선 = 결제 안 된 시도(진짜 주문 아님).
 *
 * 정기배송 '진행 중'은 사장님 결정(2026-10-24) — 어드민에선 '구독'이라는 말을 쓰지 않는다. 고객 화면 이름표
 * (lib/subscription-state SUB_STATE_LABEL '구독 중')는 브랜드 보이스라 그대로 둔다.
 */

export type AdminTone = 'green' | 'greenSoft' | 'orange' | 'red' | 'gray' | 'muted' | 'violet' | 'dashed'

export const ADMIN_TONE_CLASS: Record<AdminTone, string> = {
  green: 'bg-emerald-600 text-white border-transparent',
  greenSoft: 'bg-emerald-100 text-emerald-900 border-transparent',
  orange: 'bg-amber-100 text-amber-900 border-transparent',
  red: 'bg-red-100 text-red-900 border-transparent',
  gray: 'bg-secondary text-secondary-foreground border-transparent',
  muted: 'bg-transparent text-muted-foreground border-border',
  violet: 'bg-violet-100 text-violet-900 border-transparent',
  dashed: 'border-dashed border-border bg-transparent text-muted-foreground',
}

export interface AdminBadge {
  label: string
  tone: AdminTone
  /** 배지 옆 작은 회색 줄 — 왜 그런지(카드 거절·결제창 닫음·부분 환불). */
  note?: string
}

export type OrderBadgeInput = {
  payment_status: string
  order_status: string
  /** 결제 승인 시각 — 진짜 주문의 기준(규칙313). 없으면 결제 안 된 시도. */
  paid_at: string | null
}

/**
 * 주문 배지. 순서 = 결제됐나(paid_at) → 돈을 돌려줬나 → 박스가 어디 있나.
 *  · 결제 안 됨(점선) — 카드 거절 / 결제창 닫음 / 결제 기다리는 중
 *  · 환불 완료(회색) — 결제됐다가 전액 돌려줌
 *  · 취소 · 환불 확인(빨강) — 주문은 취소인데 돈이 아직 결제됨으로 남음
 *  · 발송 전(주황, 사장님 할 일) → 배송 중(초록) → 배송 완료(옅은 초록). 부분 환불은 같은 배지 + 작은 줄.
 */
export function orderBadge(o: OrderBadgeInput): AdminBadge {
  if (!o.paid_at) {
    const note =
      o.payment_status === 'failed' ? '카드 거절' : o.payment_status === 'pending' ? '결제 기다리는 중' : '결제창 닫음'
    return { label: '결제 안 됨', tone: 'dashed', note }
  }
  if (o.payment_status === 'refunded' || o.payment_status === 'cancelled') {
    return { label: '환불 완료', tone: 'gray' }
  }
  if (!isPaidStatus(o.payment_status)) {
    // 결제 승인 시각은 있는데 상태가 결제됨이 아니다(failed 등) — 사람이 봐야 한다.
    return { label: '결제 확인 필요', tone: 'red' }
  }
  const note = o.payment_status === 'partially_refunded' ? '부분 환불' : undefined
  switch (o.order_status) {
    case 'shipping':
      return { label: '배송 중', tone: 'green', note }
    case 'delivered':
      return { label: '배송 완료', tone: 'greenSoft', note }
    case 'cancelled':
      return { label: '취소 · 환불 확인', tone: 'red', note }
    default:
      // pending · preparing — 결제됐고 아직 안 나감 = 사장님이 보낼 것.
      return { label: '발송 전', tone: 'orange', note }
  }
}

/** 정기배송 배지 — 판정은 정본 subscriptionState 하나(status 칸만 보지 않는다: 카드 없음·결제 실패를 놓친다). */
export const SUB_BADGE: Record<SubState, AdminBadge> = {
  active: { label: '진행 중', tone: 'greenSoft' },
  needs_card: { label: '카드 등록 전', tone: 'gray' },
  card_failed: { label: '결제 실패', tone: 'red' },
  paused: { label: '일시정지', tone: 'gray' },
  cancelled: { label: '해지', tone: 'muted' },
}

export function subBadge(state: SubState): AdminBadge {
  return SUB_BADGE[state]
}

/**
 * status 칸만 받은 화면(서포터즈·이웃 할인 목록) — 카드·실패 정보가 없을 때만 쓴다. 이름은 SUB_BADGE 와 같다.
 * 카드·실패 정보가 있으면 subscriptionState → subBadge 를 쓴다.
 */
export function subBadgeFromStatus(status: string): AdminBadge {
  if (status === 'active') return SUB_BADGE.active
  if (status === 'paused') return SUB_BADGE.paused
  if (status === 'cancelled') return SUB_BADGE.cancelled
  return { label: status, tone: 'gray' }
}
