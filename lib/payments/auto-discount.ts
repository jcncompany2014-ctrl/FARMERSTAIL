import { createAdminClient } from '@/lib/supabase/admin'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import { tierMeta } from '@/lib/tiers'
import {
  computeAutoDiscount,
  applyDiscount,
  type DiscountReason,
} from '@/lib/discount'
import { pickBetterDiscount } from '@/lib/promotions'
import { trialPricing } from '@/lib/payments/trial'
import { getTrialState } from '@/lib/payments/trial-state'

/**
 * 자동 할인 계산 — **청구와 화면이 같은 함수를 쓴다.**
 *
 * # 왜 옮겼나 (2026-07-30 감사 4차)
 * 이 계산이 청구 크론 **안에만** 있었다. 그래서 `subscriptions.total_amount` 는
 * 할인 **전** 금액이고, 할인은 카드를 긁는 순간에만 적용됐다. 결과:
 *
 *   나무 등급 고객: 모든 화면이 "다음 결제 153,100원" → 실제 출금 137,790원
 *
 * 고객에게 불리한 방향은 아니지만 **화면에 적힌 금액이 실제 청구액이 아니었다.**
 * 등급 화면은 "매 주문 10% 할인"을 약속하는데 정작 결제 정보 화면에는 그 흔적이
 * 없어서, 혜택을 받고 있는지 확인할 방법이 영수증뿐이었다.
 *
 * 이제 화면이 이 함수로 **미리보기**를 만든다 — 청구가 쓰는 그 함수라 값이
 * 갈라질 수 없다.
 *
 * # 축이 둘이다 — 등급 · 프로모션
 *  · **등급**: 나무(스탬프 50개) 매 주문 10%. 그게 전부다(lib/discount.ts).
 *  · **프로모션**: 오프라인·인스타 이벤트 가입 계정의 첫 주문 할인
 *    (lib/promotions.ts + promotion_claims). 등급과 무관한 별도 축.
 *
 * **절대 더하지 않는다** — `pickBetterDiscount` 로 더 큰 쪽 하나만.
 * 두 축을 한 파일에 섞지 않은 이유: 섞는 순간 "무엇이 우선인가·겹치면·슬롯은"
 * 같은 규칙이 자란다(2026-07-16 에 150→80줄로 걷어낸 게 정확히 그것).
 *
 * # 안전 폴백
 * 조회가 실패하면 **정가**. 실패를 "할인 대상"으로 오해하는 것보다 안전하다
 * (과할인은 환불이 필요하고, 미할인은 사과 후 보정하면 된다).
 * 화면 미리보기에서도 같다 — 실제보다 **덜 할인된** 금액을 보여주는 쪽이,
 * 못 받을 할인을 약속하는 쪽보다 낫다.
 *
 * # 왜 service_role 인가
 * `pending_promotion_rate` 는 SECURITY DEFINER 이고 authenticated 에는 실행
 * 권한이 없다(2026-07 보안 감사에서 PUBLIC GRANT 를 회수한 결과 — 그대로 둔다).
 * 그래서 이 함수는 스스로 admin 클라이언트를 만들고, 범위는 인자로 받은
 * `userId` 로 좁힌다. **호출부가 사용자 소유를 먼저 확인해야 한다.**
 */

export type AutoDiscount = {
  reason: DiscountReason | 'promotion' | 'trial_cheap' | 'trial_half'
  /** 할인 금액(원). */
  discountAmount: number
  /** 실제 청구액 = subtotal − discountAmount. */
  chargeAmount: number
  /** 프로모션을 실제로 **쓴** 경우만 true — 소진 표시 대상. */
  promoClaimed: boolean
  /** 화면에 쓸 이름. 할인이 없으면 null. */
  label: string | null
}

export async function resolveAutoDiscount(input: {
  userId: string
  /** 할인 전 금액 — `subscriptions.total_amount`. */
  subtotal: number
}): Promise<AutoDiscount> {
  const { userId, subtotal } = input
  const fullCharge: AutoDiscount = {
    reason: 'none',
    discountAmount: 0,
    chargeAmount: subtotal,
    promoClaimed: false,
    label: null,
  }

  // 체험단이면 그것만 쓴다 — 등급·프로모션과 절대 겹치지 않고, 프로모션 claim 은
  // 남겨 둔다(체험 뒤 첫 정상 결제에 쓸 수 있게). docs/TRIAL_PROGRAM_2026_10.md v2.
  const trial = trialPricing(await getTrialState(userId), subtotal)
  if (trial) {
    return {
      reason: trial.phase === 'cheap' ? 'trial_cheap' : 'trial_half',
      discountAmount: trial.discountAmount,
      chargeAmount: trial.chargeAmount,
      promoClaimed: false,
      label: trial.label,
    }
  }

  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch {
    return fullCharge
  }

  const { data: prof, error } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    // ★조용히 정가로 접으면 등급(나무 10%) 고객이 **모르는 채 더 낸다**(2026-09-16 점검).
    //   청구는 막지 않되(다음날 재시도보다 오늘 정가가 낫다는 기존 판단 유지) 반드시
    //   남긴다 — 운영자가 차액을 돌려줄 수 있어야 한다.
    captureBusinessEvent('error', 'billing.auto_discount.profile_lookup_failed', {
      userId,
      dbError: error.message,
    })
    return fullCharge
  }

  // tierMeta 는 모르는 값/없음이면 null — 등급 없음(스탬프 10개 미만)이 그대로 전달된다.
  const tier = tierMeta((prof as { tier?: string | null } | null)?.tier)?.key ?? null
  const tierDiscount = computeAutoDiscount({ tier })

  // 아직 안 쓴 프로모션이 있나. 조회 실패는 '없음'으로 — 프로모션이 없어서 정가를
  // 내는 건 회복 가능하지만, 있지도 않은 할인을 주면 마진이 샌다.
  let promoRate = 0
  try {
    const { data: r } = await (
      supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown }>
      }
    ).rpc('pending_promotion_rate', { p_user_id: userId })
    const n = Number(r)
    if (Number.isFinite(n) && n > 0) promoRate = Math.min(1, n)
  } catch (e) {
    // 없음으로 간주하되 남긴다 — 약속한 이벤트 할인이 조용히 사라지면 고객이 먼저 안다.
    captureBusinessEvent('warning', 'billing.auto_discount.promotion_lookup_failed', {
      userId,
      error: e instanceof Error ? e.message : String(e),
    })
  }

  const picked = pickBetterDiscount(
    { rate: tierDiscount.rate, label: tierDiscount.label },
    promoRate > 0 ? { rate: promoRate, label: '이벤트 할인' } : null,
  )
  const discountAmount = applyDiscount(subtotal, picked.rate)
  return {
    reason: picked.reason === 'promotion' ? 'promotion' : tierDiscount.reason,
    discountAmount,
    chargeAmount: subtotal - discountAmount,
    // 프로모션을 실제로 **쓴** 경우에만 소진 표시 대상. 등급이 더 커서 안 쓴
    // 프로모션은 남겨 둔다 — 다음 기회에 쓸 수 있어야 한다.
    promoClaimed: picked.reason === 'promotion',
    label: discountAmount > 0 ? picked.label : null,
  }
}
