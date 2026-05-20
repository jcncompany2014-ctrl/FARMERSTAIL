/**
 * Farmer's Tail — Feeding Outcomes 자동 추적 (Phase 1-4, 2026-05-20)
 *
 * 사용자 부담 최소 (80% 자동 수집 + 20% 자발 입력) outcome 데이터 누적.
 *
 * # source 분류
 *   first_order          — 첫 박스 시점 baseline (cron/order confirm 자동)
 *   first_box_checkin    — 도착 7일 후 1문항 응답 (강제 X)
 *   box_rating           — 정기구독 박스 별점 (강제 X)
 *   reorder              — 재주문 시 자동 (LTV 추적)
 *   subscription_pause   — 정기구독 일시정지 (사유 동반)
 *   subscription_cancel  — 정기구독 해지 (사유 동반)
 *   refund               — 환불 (사유 동반)
 *   self_log             — 자발 입력 (체중·변·사진)
 *
 * # cohort_id
 *   - 'closed_beta_2026_q3' — 출시 전 30두 베타
 *   - 'launch_2026_10'      — 정식 출시 첫 100건
 *   - 'rolling'             — 그 이후 default
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type OutcomeSource =
  | 'first_order'
  | 'first_box_checkin'
  | 'box_rating'
  | 'reorder'
  | 'subscription_pause'
  | 'subscription_cancel'
  | 'refund'
  | 'self_log'

export type Palatability = 'great' | 'ok' | 'poor'

export type ReasonCategory =
  | 'not_eating'        // palatability 신호
  | 'digestion_issue'   // digestibility 신호
  | 'weight_change'     // outcome 신호
  | 'price'
  | 'lifestyle'
  | 'other'

export interface FeedingOutcomeInput {
  dog_id: string
  user_id: string
  cohort_id?: string
  source: OutcomeSource
  week_no?: number | null
  palatability?: Palatability | null
  rating_stars?: number | null
  bristol_score?: number | null
  weight_kg?: number | null
  bcs_score?: number | null
  reason_category?: ReasonCategory | null
  sku_code?: string | null
  comment?: string | null
  photo_url?: string | null
  order_id?: string | null
  subscription_id?: string | null
}

/**
 * 현재 cohort id 결정.
 *
 * - 2026.10 이전: 'closed_beta_2026_q3'
 * - 2026.10 ~ 2027.1: 'launch_2026_10'
 * - 그 이후: 'rolling'
 *
 * 운영 정책 변경 시 본 함수만 수정.
 */
export function getCurrentCohort(now: Date = new Date()): string {
  if (now < new Date('2026-10-01')) return 'closed_beta_2026_q3'
  if (now < new Date('2027-02-01')) return 'launch_2026_10'
  return 'rolling'
}

/**
 * Outcome row 기록. service_role 호출 가정 (cron / admin).
 * 사용자 client 도 RLS 통과 (본인 데이터만).
 */
export async function recordOutcome(
  supabase: SupabaseClient,
  input: FeedingOutcomeInput,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const cohort_id = input.cohort_id ?? getCurrentCohort()
  // generated types 에 feeding_outcomes 없음 (방금 migration) → cast 우회
  const { error } = await (
    supabase.from('feeding_outcomes' as never) as unknown as {
      insert: (v: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
    }
  ).insert({ ...input, cohort_id })

  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}

/**
 * 첫 박스인지 확인. paid orders 카운트 1 이하면 첫 박스.
 */
export async function isFirstBoxForDog(
  supabase: SupabaseClient,
  dogId: string,
): Promise<boolean> {
  // dogs 가 직접 order 와 연결되지 않으므로 user_id 기준 첫 결제 확인.
  // 정확히는 정기구독 row count 또는 user 첫 paid order. 단순화: user의 paid order 가 1건이면 첫 박스.
  const { data: dog } = await supabase
    .from('dogs')
    .select('user_id')
    .eq('id', dogId)
    .maybeSingle()
  if (!dog) return false

  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', dog.user_id)
    .eq('payment_status', 'paid')

  return (count ?? 0) <= 1
}
