/**
 * 고객 결제·구독 이력 요약 — 어드민 도장(서포터즈·이웃 할인) 전 확인과 청구 판정용.
 *
 * "결제한 박스" = PAID_STATUSES(paid·partially_refunded — 박스가 실제로 나간 결제, 규칙42 정본).
 * 전액 환불·취소(refunded·cancelled)는 박스가 안 나간 것이라 세지 않는다 — 첫 박스가 환불돼
 * 이웃 할인이 되돌아온 고객은 다시 "첫 박스" 대상이어야 한다(되돌림 트리거와 같은 뜻).
 *
 * service_role 클라이언트를 받는다(AGENTS.md 8번). 조회 실패는 ok:false — 호출부가 막는 쪽으로 판단.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { PAID_STATUSES } from '@/lib/commerce/paid-status'

export type CustomerHistory = {
  paidBoxes: number
  /** 활성 구독이 있으면 'active', 아니면 가장 최근 구독 상태, 없으면 null. */
  subscriptionStatus: string | null
}

export async function customerHistories(
  admin: SupabaseClient,
  userIds: string[],
): Promise<{ ok: true; byUser: Map<string, CustomerHistory> } | { ok: false; error: string }> {
  const byUser = new Map<string, CustomerHistory>()
  for (const id of userIds) byUser.set(id, { paidBoxes: 0, subscriptionStatus: null })
  if (userIds.length === 0) return { ok: true, byUser }

  const [ordersRes, subsRes] = await Promise.all([
    admin.from('orders').select('user_id').in('user_id', userIds).in('payment_status', [...PAID_STATUSES]),
    admin
      .from('subscriptions')
      .select('user_id, status, created_at')
      .in('user_id', userIds)
      .order('created_at', { ascending: false }),
  ])
  if (ordersRes.error) return { ok: false, error: ordersRes.error.message }
  if (subsRes.error) return { ok: false, error: subsRes.error.message }

  for (const o of (ordersRes.data ?? []) as { user_id: string }[]) {
    const h = byUser.get(o.user_id)
    if (h) h.paidBoxes += 1
  }
  for (const s of (subsRes.data ?? []) as { user_id: string; status: string }[]) {
    const h = byUser.get(s.user_id)
    if (!h) continue
    if (h.subscriptionStatus === null || s.status === 'active') h.subscriptionStatus = s.status
  }
  return { ok: true, byUser }
}

/** 한 사람 — 결제한 박스가 있는가. 조회 실패는 null(호출부가 막는 쪽으로). */
export async function hasPaidBox(admin: SupabaseClient, userId: string): Promise<boolean | null> {
  const { data, error } = await admin
    .from('orders')
    .select('id')
    .eq('user_id', userId)
    .in('payment_status', [...PAID_STATUSES])
    .limit(1)
  if (error) return null
  return (data?.length ?? 0) > 0
}
