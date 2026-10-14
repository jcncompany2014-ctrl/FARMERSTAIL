/**
 * 앞으로의 결제 회차 — 서버 전용 읽기(service_role). 펼치기 순수함수는 lib/payments/charge-projection.ts.
 *
 * 어드민 체험단 일정표·다가오는 결제·포장 목록 '결제 예정액'이 이 함수 하나를 쓴다(2026-10-14 A1·A2).
 * 금액은 전부 청구와 같은 함수 — 체험 구간 = trialPricing, 정가 구간 = resolveAutoDiscount(청구 크론이 부르는 그 함수).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveAutoDiscount } from '@/lib/payments/auto-discount'
import { loadPriceRiseContext, type PriceRiseContext } from './price-rise-context'
import {
  projectUserRounds,
  type FullPrices,
  type ProjectedRound,
  type ProjectionSub,
} from './charge-projection'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>

export type ProjectionSubInput = ProjectionSub & { user_id: string }

export async function loadChargeProjection(
  admin: AnyClient,
  subs: readonly ProjectionSubInput[],
  opts: {
    /** 다음 청구 크론이 도는 날(lib/shipping-schedule nextChargeRunDate). */
    fromIso: string
    untilChargeIso: string
    stopAtHold: boolean
    /** 사람당 펼칠 최대 회차 — 체험 상태를 보고 정할 수 있게 함수로도 받는다. */
    maxRounds?: number | ((ctx: PriceRiseContext) => number)
  },
): Promise<
  | { ok: true; roundsByUser: Map<string, ProjectedRound[]>; contextByUser: Map<string, PriceRiseContext> }
  | { ok: false; error: string }
> {
  const live = subs.filter((s) => !!s.next_delivery_date)
  const userIds = [...new Set(live.map((s) => s.user_id))]
  const ctx = await loadPriceRiseContext(admin, userIds)
  if (!ctx.ok) return { ok: false, error: ctx.error }

  // 정가 구간 금액 — 청구와 같은 함수(resolveAutoDiscount). 첫 정가 회차(한 번만 붙는 할인 포함)와 그 뒤 반복 금액.
  //   체험 중인 사람: 첫 정가 = afterTrial(체험만 빼고 나머지는 청구 규칙 그대로).
  //   정상가 고객: 첫 회 = 이 구독의 다음 결제 미리보기(subscriptionId — 여러 구독이면 앞선 구독이 1회성 할인을 먼저 쓴다).
  const fullPriceBySub = new Map<string, FullPrices>()
  await Promise.all(
    live.map(async (s) => {
      const isTrial = ctx.byUser.get(s.user_id)?.trial != null
      const [first, recurring] = await Promise.all([
        isTrial
          ? resolveAutoDiscount({ userId: s.user_id, subtotal: s.total_amount, afterTrial: true })
          : resolveAutoDiscount({ userId: s.user_id, subtotal: s.total_amount, subscriptionId: s.id }),
        resolveAutoDiscount({ userId: s.user_id, subtotal: s.total_amount, recurringOnly: true }),
      ])
      fullPriceBySub.set(s.id, {
        first: { amount: first.chargeAmount, label: first.label },
        recurring: { amount: recurring.chargeAmount, label: recurring.label },
      })
    }),
  )

  const roundsByUser = new Map<string, ProjectedRound[]>()
  for (const userId of userIds) {
    const c = ctx.byUser.get(userId) ?? { trial: null, lastPaidPhase: null, consents: [] }
    const max = typeof opts.maxRounds === 'function' ? opts.maxRounds(c) : opts.maxRounds
    roundsByUser.set(
      userId,
      projectUserRounds({
        subs: live.filter((s) => s.user_id === userId),
        trial: c.trial,
        lastPaidPhase: c.lastPaidPhase,
        consents: c.consents,
        fullPriceBySub,
        fromIso: opts.fromIso,
        untilChargeIso: opts.untilChargeIso,
        stopAtHold: opts.stopAtHold,
        maxRounds: max,
      }),
    )
  }
  return { ok: true, roundsByUser, contextByUser: ctx.byUser }
}
