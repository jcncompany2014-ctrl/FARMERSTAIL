/**
 * 다가오는 결제 — 서버 전용(service_role). 어드민 배송 캘린더 '다가오는 결제'·월 합계가 쓴다(2026-10-14 A2).
 *
 * # 왜
 * 캘린더 합계가 '할인 전 구독가'라 서포터즈 100원 결제가 51,500원으로 잡히고, 사장님 시험 계정의 11/7 32,700원 같은
 * 원치 않는 결제를 미리 볼 곳이 없었다. 이제 결제일별로 **실제 나갈 금액**(청구와 같은 함수 — 체험 구간 trialPricing,
 * 정가 구간 resolveAutoDiscount)과 정가를 같이 보이고, 합계는 실제 금액이다.
 * 인상 동의가 없어 청구 크론이 보류할 회차는 '보류 예정'으로 따로 보이고 합계에서 뺀다(나가지 않는 돈).
 *
 * 대상 = 청구 크론과 같은 조건: active · 카드 있음(billing_key) · 카드 재등록 불필요 · 발송일 있음.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { selectInChunks } from '@/lib/supabase/in-chunks'
import { loadChargeProjection } from '@/lib/payments/charge-projection-load'
import type { ProjectedRound } from '@/lib/payments/charge-projection'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>

export type UpcomingRound = ProjectedRound & {
  userId: string
  customerName: string | null
  dogName: string | null
}

export async function loadUpcomingCharges(
  admin: AnyClient,
  opts: { fromIso: string; untilChargeIso: string },
): Promise<{ ok: true; rounds: UpcomingRound[] } | { ok: false; error: string }> {
  // 청구 크론의 대상 조건과 같다(app/api/cron/subscription-charge — status·재등록·billing_key).
  const { data: subsRaw, error: subsErr } = await admin
    .from('subscriptions')
    .select('id, user_id, dog_id, next_delivery_date, total_amount')
    .eq('status', 'active')
    .eq('requires_billing_key_renewal', false)
    .not('billing_key', 'is', null)
    .not('next_delivery_date', 'is', null)
    .order('next_delivery_date', { ascending: true })
    .order('id', { ascending: true })
  if (subsErr) return { ok: false, error: `정기배송: ${subsErr.message}` }
  const subs = (subsRaw ?? []) as Array<{
    id: string
    user_id: string
    dog_id: string | null
    next_delivery_date: string | null
    total_amount: number
  }>
  if (subs.length === 0) return { ok: true, rounds: [] }

  const userIds = [...new Set(subs.map((s) => s.user_id))]
  const dogIds = [...new Set(subs.map((s) => s.dog_id).filter((x): x is string => !!x))]
  const [profRes, dogRes, proj] = await Promise.all([
    selectInChunks(userIds, (chunk) => admin.from('profiles').select('id, name').in('id', chunk)),
    selectInChunks(dogIds, (chunk) => admin.from('dogs').select('id, name').in('id', chunk)),
    loadChargeProjection(admin, subs, {
      fromIso: opts.fromIso,
      untilChargeIso: opts.untilChargeIso,
      // 실제로 나갈 돈 — 보류될 회차에서 그 구독을 멈춘다(동의 전엔 다음 회차도 없다).
      stopAtHold: true,
    }),
  ])
  if (profRes.error) return { ok: false, error: `프로필: ${profRes.error.message}` }
  if (dogRes.error) return { ok: false, error: `강아지: ${dogRes.error.message}` }
  if (!proj.ok) return { ok: false, error: proj.error }

  const nameByUser = new Map((profRes.data as Array<{ id: string; name: string | null }>).map((p) => [p.id, p.name]))
  const nameByDog = new Map((dogRes.data as Array<{ id: string; name: string | null }>).map((d) => [d.id, d.name]))
  const dogBySub = new Map(subs.map((s) => [s.id, s.dog_id]))
  const rounds: UpcomingRound[] = []
  for (const [userId, rs] of proj.roundsByUser) {
    for (const r of rs) {
      const dogId = dogBySub.get(r.subId) ?? null
      rounds.push({
        ...r,
        userId,
        customerName: nameByUser.get(userId) ?? null,
        dogName: dogId ? (nameByDog.get(dogId) ?? null) : null,
      })
    }
  }
  rounds.sort((a, b) => (a.chargeIso === b.chargeIso ? (a.subId < b.subId ? -1 : 1) : a.chargeIso < b.chargeIso ? -1 : 1))
  return { ok: true, rounds }
}
