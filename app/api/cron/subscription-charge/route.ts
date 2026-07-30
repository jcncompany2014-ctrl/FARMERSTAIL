import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { nextCycleDateAligned } from '@/lib/shipping-schedule'
import { chargeBillingKey, cancelPayment } from '@/lib/payments/toss'
import {
  classifyBillingError,
  describeBillingError,
  isDefinitiveDecline,
  RETRY_COOLDOWN_MS,
} from '@/lib/payments/billing-error-classify'
import { notifySubscriptionChargeFailed } from '@/lib/email'
import { pushToUser } from '@/lib/push'
import { traceBusiness, captureBusinessEvent } from '@/lib/sentry/trace'
import { trackCron } from '@/lib/cron-tracking'
import {
  computeAutoDiscount,
  applyDiscount,
  type DiscountReason,
} from '@/lib/discount'
import { pickBetterDiscount } from '@/lib/promotions'
import { tierMeta } from '@/lib/tiers'
import {
  priceForFormula,
  type BoxProduct,
} from '@/lib/personalization/boxPricing'
import {
  LINE_TO_SLUG as PRICE_LINE_TO_SLUG,
  TOPPER_TO_SLUG as PRICE_TOPPER_TO_SLUG,
} from '@/lib/personalization/skuMap'
import { checkChargeAmount } from '@/lib/payments/charge-amount-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/subscription-charge
 *
 * 매일 오전 (KST 09:10) 실행. 다음 조건의 구독을 자동 결제:
 *   - status = 'active'
 *   - next_delivery_date = 오늘 (KST)
 *   - billing_key IS NOT NULL
 *   - 같은 (subscription_id, today) 로 subscription_charges 에 row 가 없음
 *     (멱등 — 같은 날 두 번 결제 안 됨)
 *
 * 처리 흐름:
 *   1) 대상 구독 select
 *   2) 각 구독에 대해 charge attempt:
 *      a. subscription_charges row insert (status='pending', UNIQUE 충돌 시 skip)
 *      b. orders row insert (status='pending', payment_status='pending')
 *      c. Toss billingKey 청구
 *      d. 성공 → orders/charge update + subscriptions.next_delivery_date 갱신
 *      e. 실패 → failed_charge_count += 1, 3회 누적 시 status='paused'
 *   3) 결과 집계 반환
 *
 * 보안: CRON_SECRET bearer.
 *
 * # 시간대 — 왜 새벽이 아니라 업무 시작 시각인가 (2026-07-30 이동)
 * vercel.json cron 은 UTC. KST 09:10 = UTC 00:10 → "10 0 * * *"
 * (이전: KST 04:00 = "0 19 * * *")
 *
 * 새벽 4시를 쓸 이유가 없었다. 청구는 우리가 부르는 시점에 토스가 처리하므로
 * (빌링키는 가맹점이 호출하는 방식 — 토스에 예약 기능이 없다) 시각은 순수하게
 * **우리 운영 편의**의 문제다. 새벽에 두면 두 가지가 나빴다:
 *  · 실패했을 때 아무도 안 깨어 있다. 카드 한도 초과·해지 카드는 사람이 손을
 *    써야 하는데, 발견이 5~6시간 늦어지고 그만큼 화요일 발송에 가까워진다.
 *  · 고객도 새벽에 결제 실패 알림을 받는다. 조용시간(기본 22–08)을 켠 고객에게는
 *    **아예 안 나갔다** — 돈은 빠지고 통지는 없는 조합.
 *
 * 09:10 은 조용시간 밖이고(08시 종료), 포장 시작 전이며, 실패를 당일 안에 처리할
 * 시간이 남는다. 대상 조회는 `lte(next_delivery_date, today)` 라 놓친 건은 다음
 * 실행에서 따라잡는다 — 시각 이동으로 건너뛰는 구독은 없다.
 *
 * # 가드레일
 * - 한 번에 100건 까지만 처리 (대량 큐 폭주 방지). 다음 cron 에서 계속.
 * - 결제 호출 사이에 100ms 딜레이 (Toss QPS 한도 보호).
 */

type SubscriptionRow = {
  id: string
  user_id: string
  next_delivery_date: string
  total_amount: number
  billing_key: string
  billing_customer_key: string
  failed_charge_count: number
  // audit launch-fix: subscriptions 테이블에 recipient_name/zip/address/
  // address_detail 컬럼이 없음 (recipient_phone 만 존재). 신청 시 snapshot
  // 안 잡혀 있어 cron 이 매번 select 실패하던 버그 → 그 컬럼들 제거.
  // 주소는 addresses.is_default=true row 또는 profiles.* fallback 으로
  // 매 결제 시점에 가져옴.
  recipient_phone: string | null
  interval_weeks: number
  coverage_weeks: number | null
  dog_id: string | null
  total_deliveries: number
  next_retry_at: string | null
  last_failed_charge_code: string | null
  fresh_ratio: number | null
  requires_billing_key_renewal: boolean | null
}

type ShippingTarget = {
  name: string
  phone: string
  zip: string
  address: string
  addressDetail: string | null
}

/**
 * 정기배송 결제 시점의 배송 주소 결정.
 *
 * 우선순위:
 *   1) addresses 테이블의 is_default=true row (사용자가 명시 선택)
 *   2) profiles 테이블 (legacy / 가입 시 기본값)
 *   3) 둘 다 없거나 필수 값 누락이면 null → cron 이 그 결제 skip + 알림
 *
 * audit launch-fix: 정기배송 신청 시 subscriptions 에 주소 snapshot 안
 * 잡힘. 출시 후 첫 정기구독 가입자 결제 100% 실패 사태를 막기 위해 매
 * 결제 시점에 lookup. 장기 개선: subscribe 라우트가 신청 시 address_id
 * 를 subscriptions 에 저장하게 (이사 등으로 자동 따라가는 문제 방지).
 */
async function resolveShippingTarget(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<ShippingTarget | null> {
  const { data: addr } = await supabase
    .from('addresses')
    .select('recipient_name, phone, zip, address, address_detail')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle()

  if (addr && addr.zip && addr.address && addr.recipient_name && addr.phone) {
    return {
      name: addr.recipient_name,
      phone: addr.phone,
      zip: addr.zip,
      address: addr.address,
      addressDetail: addr.address_detail ?? null,
    }
  }

  // fallback to profiles
  const { data: prof } = await supabase
    .from('profiles')
    .select('name, phone, zip, address, address_detail')
    .eq('id', userId)
    .maybeSingle()

  if (prof && prof.zip && prof.address && prof.name && prof.phone) {
    return {
      name: prof.name,
      phone: prof.phone,
      zip: prof.zip,
      address: prof.address,
      addressDetail: prof.address_detail ?? null,
    }
  }

  return null
}

/**
 * ★청구액 서버 재계산 (2026-07-29 결제 감사 critical).
 *
 * `subscriptions.total_amount` 는 고객이 REST 로 직접 쓸 수 있다(RLS 가 소유자
 * UPDATE 를 컬럼 제한 없이 허용 + authenticated 에 UPDATE 권한 실측). 그래서
 * 청구 전에 **신뢰할 수 있는 원천**으로 다시 계산해 대조한다.
 * `subscription_items.unit_price` 도 고객이 쓸 수 있으므로 items 합은 근거가
 * 못 되고, 관리자만 쓰는 `products` 만 신뢰한다 — 승인 라우트(priceForApproved)
 * 와 정확히 같은 경로(처방 + products → priceForFormula).
 *
 * 계산 근거가 없으면 null — 호출부가 검사를 건너뛴다(돈을 추측하지 않는다).
 */
async function recomputeChargeBase(
  supabase: ReturnType<typeof createAdminClient>,
  sub: SubscriptionRow,
): Promise<number | null> {
  if (!sub.dog_id || sub.fresh_ratio == null || !(sub.fresh_ratio > 0)) return null

  // 현재 적용 중인 처방 — 대조 기준. 없으면 대조 불가.
  //
  // ★ 정렬을 `cycle_number DESC` → `created_at DESC` 로 고쳤다 (2026-07-30 감사).
  //   회차 번호가 큰 것이 항상 최신이 아니다 — 프로덕션 실측:
  //     cycle 2 = 2026-07-10 생성 (관절 0.8 + 체중 0.2, 568kcal)
  //     cycle 1 = 2026-07-15 생성 (프리미엄 1.0, 745kcal)  ← 이게 최신
  //   회차 번호로 고르면 **5일 오래된 처방**을 집어 8/4 청구가 153,100원 대신
  //   90,900원(−40.6%)이 될 예정이었다.
  //
  //   그리고 금액을 만든 주문 화면은 **cycle 1 고정**이다. 그 파일 주석이 이유를
  //   적어놨다 — "여기만 최신 cycle 을 읽어서 진행 cron 이 만든 옛 cycle 2 를
  //   보여줬다 → 같은 강아지인데 화면마다 레시피가 달랐다"(사장님 제보).
  //   즉 그 화면이 일부러 피한 함정을 돈 경로가 다시 밟고 있었다.
  //   `created_at` 기준이면 정상 케이스(회차가 시간순)와 이 이상 케이스가 모두
  //   "가장 최근에 적용된 처방"으로 일치한다.
  const { data: fRow } = await supabase
    .from('dog_formulas')
    .select('formula, daily_kcal, approval_status, cycle_number')
    .eq('dog_id', sub.dog_id)
    .neq('approval_status', 'pending_approval')
    .neq('approval_status', 'declined')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const formulaRow = fRow as unknown as {
    formula: { lineRatios: Record<string, number>; toppers: Record<string, number> }
    daily_kcal: number
  } | null
  if (!formulaRow?.formula || !(formulaRow.daily_kcal > 0)) return null

  const slugs = [
    ...Object.values(PRICE_LINE_TO_SLUG).filter((s): s is string => s !== null),
    ...Object.values(PRICE_TOPPER_TO_SLUG),
  ]
  const { data: prodList } = await supabase
    .from('products')
    .select('slug, price, sale_price, stock, is_subscribable, nutrition_facts')
    .in('slug', slugs)
    .eq('is_active', true)
  const products: Record<string, BoxProduct> = {}
  for (const pr of ((prodList ?? []) as unknown) as BoxProduct[]) {
    products[pr.slug] = pr
  }
  if (Object.keys(products).length === 0) return null

  const { total } = priceForFormula({
    formula: {
      lineRatios: formulaRow.formula.lineRatios as never,
      toppers: formulaRow.formula.toppers as never,
      dailyKcal: formulaRow.daily_kcal,
    },
    freshRatio: sub.fresh_ratio,
    products,
  })
  return total > 0 ? total : null
}

/**
 * 정기결제 1건의 자동 할인 계산.
 *
 * # 축이 둘이다 — 등급 · 프로모션
 *  · **등급**: 나무(스탬프 50개) 매 주문 10%. 그게 전부다(lib/discount.ts).
 *  · **프로모션**: 오프라인·인스타 이벤트로 가입한 계정의 첫 주문 할인
 *    (lib/promotions.ts + promotion_claims). 등급과 무관한 별도 축.
 *
 * **절대 더하지 않는다** — `pickBetterDiscount` 로 더 큰 쪽 하나만.
 * 두 축을 한 파일에 섞지 않은 이유: 섞는 순간 "무엇이 우선인가·겹치면·슬롯은" 같은
 * 규칙이 자란다(2026-07-16 에 150→80줄로 걷어낸 게 정확히 그것).
 *
 * # 안전 폴백
 * 조회가 실패하면 **정가 청구**. 실패를 "할인 대상"으로 오해하는 것보다 안전하다
 * (과할인은 환불이 필요하고, 미할인은 사과 후 보정하면 된다).
 */
async function resolveAutoDiscount(
  supabase: ReturnType<typeof createAdminClient>,
  sub: SubscriptionRow,
): Promise<{
  reason: DiscountReason | 'promotion'
  discountAmount: number
  chargeAmount: number
  promoClaimed: boolean
}> {
  const subtotal = sub.total_amount
  const fullCharge = {
    reason: 'none' as const,
    discountAmount: 0,
    chargeAmount: subtotal,
    promoClaimed: false,
  }

  const { data: prof, error } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', sub.user_id)
    .maybeSingle()
  if (error) return fullCharge

  // tierMeta 는 모르는 값/없음이면 null — 등급 없음(스탬프 10개 미만)이 그대로 전달된다.
  const tier = tierMeta((prof as { tier?: string | null } | null)?.tier)?.key ?? null
  const tierDiscount = computeAutoDiscount({ tier })

  // 아직 안 쓴 프로모션이 있나. 조회 실패는 '없음'으로 — 프로모션이 없어서 정가를
  // 내는 건 회복 가능하지만, 있지도 않은 할인을 주면 마진이 샌다.
  let promoRate = 0
  try {
    const { data: r } = await (
      supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>
      }
    ).rpc('pending_promotion_rate', { p_user_id: sub.user_id })
    const n = Number(r)
    if (Number.isFinite(n) && n > 0) promoRate = Math.min(1, n)
  } catch {
    /* 없음으로 간주 */
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
  }
}

const MAX_PER_RUN = 100
const MAX_FAILED = 3

function todayKstIsoDate(): string {
  // KST = UTC+9. 단순 계산: 현재 UTC 에 9h 더해서 date 부분만.
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

/**
 * 다음 배송일 — **2주(14일) 뒤, 언제나**.
 *
 * 2026-07-16: 예전엔 3갈래였다 — 박스 2주 / 레거시 4주치는 캘린더 월 / 단일 SKU
 * /subscribe 흐름은 interval_weeks(1·2·4)주. 그런데 배송 주기는 2주 하나로
 * 고정됐고(사장님 2026-07-13, 박스가 14일치라 다른 주기는 물리적으로 성립 안 함),
 * /subscribe 흐름은 도달 불가라 삭제했다. 분기가 남아 있으면 옛 데이터나 손으로
 * 넣은 값이 다른 주기를 되살린다.
 *
 * ★최종감사 #3 (2026-07-29): 예전엔 `nextCycleDate(today)` — "청구일은 항상
 * 화요일"이라는 전제였다. 그런데 대상 조회는 `.lte('next_delivery_date', today)`
 * 로 **밀린 날 따라잡기**를 허용하고, cron_health 실측상 크론이 화요일에 안 돈
 * 날이 실제로 있었다(07-07 화 미실행 → 07-09 목 실행). 그 순간 목요일 청구가
 * next_delivery_date 를 목요일로 박고, 이후 +14 씩만 밀려 **화요일 정렬이 영구
 * 이탈**했다 — 피킹 리스트는 화요일만 조회하므로 그 고객의 박스는 리스트에서
 * 영영 사라진다(결제만 되고 박스는 안 나감).
 *
 * 해법: 실행일이 아니라 **원래 예정일(dueIso — 귀납적으로 항상 화요일)** 에서
 * +14 를 앵커한다. 늦게 청구돼도 주기는 화요일에 남는다. 여기에 두 겹 자가치유:
 *   ① 과거 데이터·수동 입력으로 앵커가 이탈했어도 다음 화요일로 스냅
 *   ② 여러 주 밀렸어도 결과가 반드시 미래가 되도록 전진 (과거로 잡히면
 *      다음날 크론이 곧바로 또 청구한다)
 */
function nextDeliveryDate(dueIso: string, todayIso: string): string {
  return nextCycleDateAligned(dueIso, todayIso)
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }
  return trackCron('subscription-charge', () => runSubscriptionCharge())
}

async function runSubscriptionCharge(): Promise<Response> {
  const supabase = createAdminClient()
  const today = todayKstIsoDate()

  // 1) 오늘 결제 대상 구독 fetch.
  //    제외 조건:
  //      - status != active
  //      - billing_key NULL (등록 안 됨)
  //      - requires_billing_key_renewal=true (영구 거절 — 사용자가 카드 다시
  //        등록할 때까지 대기)
  //      - next_retry_at > NOW() (transient 실패 후 24h 쿨다운 중)
  const nowIso = new Date().toISOString()
  const { data: subs, error: fetchErr } = await supabase
    .from('subscriptions')
    .select(
      `id, user_id, next_delivery_date, total_amount,
       billing_key, billing_customer_key, failed_charge_count,
       recipient_phone, interval_weeks, coverage_weeks, dog_id,
       total_deliveries, next_retry_at, requires_billing_key_renewal,
       last_failed_charge_code, fresh_ratio`,
    )
    .eq('status', 'active')
    .eq('requires_billing_key_renewal', false)
    .not('billing_key', 'is', null)
    .lte('next_delivery_date', today)
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .limit(MAX_PER_RUN)

  if (fetchErr) {
    return NextResponse.json(
      { ok: false, error: fetchErr.message },
      { status: 500 },
    )
  }

  // audit #79: SubscriptionRow 가 generated types schema 와 다름 (recipient_zip 등).
  const targets = ((subs ?? []) as unknown) as SubscriptionRow[]
  let succeeded = 0
  let failed = 0
  let skipped = 0

  for (const sub of targets) {
    // 2-0) 이중청구 가드(점검 high): 이미 Toss 청구됐으나 후속 update 실패로
    //      미확정(status='pending' + payment_key 존재)인 charge 가 있으면 새 청구를
    //      하지 않는다. 재청구 가드가 next_delivery_date 한 곳에만 의존하면, 후속
    //      update 실패로 날짜가 안 밀릴 때 다음날 cron 이 다른 scheduled_for/
    //      idempotencyKey 로 카드를 2회 청구하는 사고가 난다.
    const { data: pendingCharges } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (col: string, v: string) => {
              eq: (col2: string, v2: string) => {
                limit: (n: number) => Promise<{
                  data: Array<{ id: string; payment_key: string | null }> | null
                }>
              }
            }
          }
        }
      }
    )
      .from('subscription_charges')
      .select('id, payment_key')
      .eq('subscription_id', sub.id)
      .eq('status', 'pending')
      .limit(5)
    const unresolved = (pendingCharges ?? []).find((c) => c.payment_key)
    if (unresolved) {
      // 돈은 청구됐는데 주문/구독 미확정 → 재청구 금지 + 알림(수동/reconcile 처리).
      captureBusinessEvent('error', 'subscription.charge.unresolved_skip', {
        subscriptionId: sub.id,
        chargeId: unresolved.id,
      })
      skipped++
      continue
    }

    // 2-0b) 자동 할인 계산 — subtotal(구독 단가)에서 할인 차감한 실제 청구액 결정.
    //       쿠폰 없음(lib/discount). 첫주문/등급(슬롯)/생일 자동 판정. charge·order·
    //       billing 전부 이 chargeAmount 로 일관 기록(subtotal 은 정가 유지).
    // ★청구액 대조 (2026-07-30 재설계) — **항상 저장된 금액으로 청구**하고,
    //   서버 재계산과 어긋나면 알린다. 청구를 막지도, 금액을 낮추지도 않는다.
    //
    //   왜 자동 차단·자동 하향을 뺐나 (최종감사):
    //    · 하향(min)이 실제로 저청구를 만들었다 — 8/4 건 153,100 → 90,900원
    //    · 차단(refuse)은 정상 고객을 막았다 — 품절 중 주문 후 재입고하면
    //      재계산이 커져 "조작"으로 분류되고, 박스는 계속 나가면서 청구만 멈춘다
    //    · 재계산이 정당하게 어긋나는 경우(재고 변동·플랜화면 레시피 선택 미저장·
    //      회차 기준)의 크기가 조작과 구분되지 않는다(실측 40%)
    //   조작 자체는 이제 **DB 권한**으로 막는다 —
    //   20260730000000_subscriptions_lock_money_columns.sql 이 고객의
    //   total_amount·fresh_ratio·billing_key UPDATE 권한을 회수했다.
    //   (남은 경로는 구독 생성 시점 뿐이고, 그건 서버 라우트 이관이 정답 — 후속.)
    const recomputed = await recomputeChargeBase(supabase, sub)
    const amountCheck = checkChargeAmount(sub.total_amount, recomputed)
    if (amountCheck.mismatch) {
      captureBusinessEvent('warning', 'subscription.charge.amount_mismatch', {
        subscriptionId: sub.id,
        userId: sub.user_id,
        storedAmount: sub.total_amount,
        recomputedAmount: String(amountCheck.recomputed),
        direction: String(amountCheck.direction),
        note: '저장 금액으로 청구했다. 재고 변동·처방 회차 차이면 정상, 아니면 확인 필요.',
      })
    }
    // 청구 기준은 **항상** 저장 금액 = 고객이 동의하고 모든 화면이 보여주는 값.
    const trustedSubtotal = amountCheck.chargeBase

    const { reason: discountReason, discountAmount, chargeAmount, promoClaimed } =
      await resolveAutoDiscount(supabase, { ...sub, total_amount: trustedSubtotal })

    // ★결제 감사 #7 (2026-07-29): 0원 이하 청구 금지. 100% 프로모션이 허용돼
    //   있어(pct <= 100) chargeAmount 가 0 이 될 수 있는데, 카드 결제는 최소
    //   금액 미달로 **거절**된다 → unknown 분류로 3-strike 카운트가 쌓여 구독이
    //   정지되고 프로모션까지 소진된다. "첫 박스 무료"는 0원 청구가 아니라 별도
    //   기획으로 풀어야 하는 일이므로, 여기서는 청구를 건너뛰고 알린다.
    if (!(chargeAmount > 0)) {
      captureBusinessEvent('error', 'subscription.charge.zero_amount', {
        subscriptionId: sub.id,
        subtotal: trustedSubtotal,
        discountAmount,
        discountReason,
      })
      skipped += 1
      continue
    }

    // 2-a) charge row insert. UNIQUE (subscription_id, scheduled_for) 충돌 시
    //      이미 처리됨 — skip.
    // audit #79: subscription_charges schema-drift cast.
    const { data: chargeRow, error: chargeErr } = await (
      supabase as unknown as {
        from: (t: string) => {
          insert: (r: Record<string, unknown>) => {
            select: (cols: string) => {
              single: () => Promise<{
                data: { id: string } | null
                error: { code?: string; message?: string } | null
              }>
            }
          }
        }
      }
    )
      .from('subscription_charges')
      .insert({
        subscription_id: sub.id,
        user_id: sub.user_id,
        scheduled_for: today,
        status: 'pending',
        amount: chargeAmount,
      })
      .select('id')
      .single()

    if (chargeErr) {
      // 23505 = unique violation = 이미 같은 날 시도함. 정상 skip.
      if (
        (chargeErr as unknown as { code?: string }).code === '23505'
      ) {
        skipped += 1
        continue
      }
      failed += 1
      continue
    }

    // 2-b) order row 먼저 만든다 (payment_status='pending'). orderId 가 Toss
    //      청구 요청에 필요. user 가 직접 결제한 주문과 구분되도록 source 컬럼
    //      이 있다면 'subscription' 마킹 권장 (없으면 일반 주문과 동일 처리).
    const orderName = `Farmer's Tail 정기배송 #${sub.total_deliveries + 1}`

    // audit launch-fix: 배송 주소를 addresses/profiles 에서 lookup. 신청
    // 시점 snapshot 이 없으면 매번 lookup. 둘 다 없으면 결제 자체 skip.
    const ship = await resolveShippingTarget(supabase, sub.user_id)
    if (!ship) {
      await supabase
        .from('subscription_charges')
        .update({
          status: 'failed',
          error_code: 'NO_SHIPPING_ADDRESS',
          error_message:
            '배송지가 등록되지 않아 결제를 진행할 수 없어요. 마이페이지에서 기본 배송지를 추가해 주세요.',
        })
        .eq('id', chargeRow!.id)
      // 운영자 알림 — 정기구독이 무한 정지되는 것을 막기 위해.
      captureBusinessEvent('warning', 'subscription.no_shipping_address', {
        subscriptionId: sub.id,
        userId: sub.user_id,
      })
      failed += 1
      continue
    }

    // orders 의 실제 컬럼명은 zip / address / address_detail (recipient_ 접두사 X).
    // recipient_name 과 recipient_phone 만 recipient_ prefix 사용.
    // 데이터정합 감사(CRITICAL): orders.order_number / subtotal 은 NOT NULL +
    // DB 기본값 없음(prod 확인). 누락 시 정기결제가 주문 생성 단계에서 NOT NULL
    // 위반으로 전부 실패한다(체크아웃·admin 경로는 둘 다 채워서 베타에 안 드러남).
    // order_number 는 CheckoutForm.generateOrderNumber 와 동일 포맷(FT-YYYYMMDD-RAND),
    // subtotal 은 구독 total_amount(구독 단가에 배송비 포함, 별도 분리 없음).
    const orderNow = new Date()
    const orderNumber = `FT-${orderNow.getFullYear()}${String(
      orderNow.getMonth() + 1,
    ).padStart(2, '0')}${String(orderNow.getDate()).padStart(2, '0')}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`
    const orderInsertPayload: Record<string, unknown> = {
      user_id: sub.user_id,
      // ★최종감사 #1 (2026-07-29, critical): 이 한 줄이 빠져 있었다.
      //   orders.subscription_id 를 전제하는 소비자가 둘인데 —
      //   ① 재제안 크론의 배송 회차 카운트(.eq('subscription_id', subId))가
      //      항상 0 → isCycleDue 영원히 false → cycle 2+ 재제안·체크인·
      //      알레르기 게이트 전체가 한 번도 실행되지 못함
      //   ② 도장판 트리거 tg_orders_stamp 가 subscription_id null 이면
      //      즉시 return → 결제를 아무리 해도 도장 0개
      //   컬럼은 DB·types.ts 에 이미 존재. 채우기만 하면 둘 다 살아난다.
      subscription_id: sub.id,
      order_number: orderNumber,
      order_status: 'pending',
      payment_status: 'pending',
      // 검문소를 통과한 신뢰 금액 — 조작된 total_amount 가 주문에 남지 않게.
      subtotal: trustedSubtotal,
      total_amount: chargeAmount,
      discount_amount: discountAmount,
      discount_reason: discountReason,
      recipient_name: ship.name,
      recipient_phone: sub.recipient_phone ?? ship.phone,
      zip: ship.zip,
      address: ship.address,
      address_detail: ship.addressDetail,
    }
    const { data: orderRow, error: orderErr } = await (
      supabase as unknown as {
        from: (t: string) => {
          insert: (r: Record<string, unknown>) => {
            select: (cols: string) => {
              single: () => Promise<{
                data: { id: string; order_number: string } | null
                error: { message?: string } | null
              }>
            }
          }
        }
      }
    )
      .from('orders')
      .insert(orderInsertPayload)
      .select('id, order_number')
      .single()

    if (orderErr || !orderRow) {
      await supabase
        .from('subscription_charges')
        .update({
          status: 'failed',
          error_code: 'ORDER_INSERT_FAILED',
          error_message: orderErr?.message ?? 'unknown',
          completed_at: new Date().toISOString(),
        })
        .eq('id', chargeRow!.id)
      failed += 1
      continue
    }

    // 2-b-2) subscription_items → order_items 복사 (audit fix).
    // 이전: order row 만 만들고 items 누락 → 사용자/admin 이 주문 상세에서
    // 상품 안 보임 + 발송 운영 시 어떤 상품 보낼지 모름.
    const { data: subItems } = await supabase
      .from('subscription_items')
      .select('product_id, product_name, product_image_url, quantity, unit_price')
      .eq('subscription_id', sub.id)
    const subItemsArr = (subItems ?? []) as Array<{
      product_id: string | null
      product_name: string
      product_image_url: string | null
      quantity: number
      unit_price: number
    }>
    // 데이터정합 감사: order_items.product_id 는 NOT NULL. subItemsArr 타입은
    // product_id: string|null(캐스트로 추론 완화)이라 null 이 섞이면 insert 가
    // NOT NULL 위반 → 품목 없는 orphan 주문. null product_id 는 skip.
    const validItems = subItemsArr.filter((it) => it.product_id != null)
    if (validItems.length > 0) {
      // audit #79: order_items insert payload cast (product_id nullable 등 추론 차이).
      await (supabase as unknown as {
        from: (t: string) => {
          insert: (r: Record<string, unknown>[]) => Promise<unknown>
        }
      })
        .from('order_items')
        .insert(
          validItems.map((it) => ({
            order_id: orderRow!.id,
            product_id: it.product_id,
            product_name: it.product_name,
            product_image_url: it.product_image_url,
            quantity: it.quantity,
            unit_price: it.unit_price,
            line_total: it.unit_price * it.quantity,
          })),
        )
    }

    // ★청구 윈도우 원자적 선점 (2026-07-30 — 주석만 있고 구현이 없던 것을 실제로 구현)
    //
    //   이전 코드는 여기서 `select('status')` 로 **읽기만** 했다. 그런데 위 주석은
    //   "UPDATE-with-RETURNING 으로 atomically 진입 (last_charge_lock_at 마킹)" 이라고
    //   적혀 있었고, 그 컬럼 이름은 저장소 전체에서 **그 주석 한 줄이 유일한 등장**
    //   이었다. 없는 방어를 있다고 믿게 만드는 주석이었다(최종감사 critical).
    //
    //   읽기만으로는 배치 조회(:346~) 시점과 여기 사이의 변화만 잡고, 여러 run 이
    //   겹쳤을 때 둘 다 통과할 수 있다. UPDATE 는 행 잠금을 잡으므로 하나만 통과한다.
    //   0행 = 그 사이 status 가 바뀌었거나 다른 run 이 선점 → 청구하지 않는다.
    const { data: claimed, error: claimErr } = await supabase
      .from('subscriptions')
      .update({ last_charge_lock_at: new Date().toISOString() })
      .eq('id', sub.id)
      .eq('status', 'active')
      .select('id')
    if (claimErr || !claimed || claimed.length === 0) {
      skipped++
      continue
    }

    // 멱등키 — **주기(next_delivery_date) 기준**, 실행일(today) 아님(2026-07-24 점검).
    //   왜: transient 실패(PAY_PROCESS_TIMEOUT 등 — Toss가 카드는 긁었는데 응답이
    //   유실된 경우 포함)는 24h 뒤 재시도된다. 키가 `{today}` 면 재시도날 키가
    //   바뀌어 Toss가 새 청구로 처리 → **이중청구**. next_delivery_date 는 성공
    //   전까지 안 밀리므로 같은 주기의 모든 재시도가 같은 키를 공유 → Toss가
    //   원결제 결과를 그대로 돌려줘 재청구가 없다(캡처된 결제는 자동 회복).
    //   confirm/cancel 키가 트랜잭션 기반으로 안정적인 것과 같은 원리.
    // ★최종감사 #2 (2026-07-29): 주기 고정 키의 부작용 보정.
    //   토스는 멱등키 응답을 15일간 저장·재생한다. 첫 시도가 **잔액부족 같은
    //   확정 거절**(돈이 절대 안 나간 게 보장되는 코드)이었으면, 고객이 잔액을
    //   채워도 같은 키의 재시도는 저장된 거절만 돌려받아 결제가 15일간 멈춘다.
    //   직전 실패가 확정 거절일 때만 날짜를 붙여 새 키로 — 돈이 안 나갔음이
    //   보장되므로 이중청구 위험 0. 타임아웃·네트워크류(결과 불명)는 종전대로
    //   같은 키 유지(원결제 결과 재생 = 이중청구 방지가 우선).
    const retrySuffix = isDefinitiveDecline(sub.last_failed_charge_code)
      ? `:r${today}`
      : ''
    const idempotencyKey = `sub-charge:${sub.id}:${sub.next_delivery_date}${retrySuffix}`

    // 2-c) Toss 청구. 비즈니스 span 으로 wrap — Sentry 트랜잭션에서 실패율 +
    //      latency 추적.
    const result = await traceBusiness(
      'subscription.charge',
      {
        'subscription.id': sub.id,
        'subscription.amount': chargeAmount,
        'subscription.failed_count': sub.failed_charge_count,
        'subscription.scheduled_for': today,
      },
      () =>
        chargeBillingKey({
          billingKey: sub.billing_key,
          customerKey: sub.billing_customer_key,
          // ★결제 감사 #2 (2026-07-29): 토스에 보내는 orderId 는 **주문번호**여야
          //   한다. 예전엔 orders.id(UUID)를 보내서 ① 웹훅이 order_number 로
          //   조회하므로 **모든 정기결제 웹훅이 주문을 못 찾고 조용히 버려졌다**
          //   (토스 대시보드 환불이 우리 DB 에 반영 안 됨 → 환불한 고객에게 박스
          //   발송) ② 토스 대시보드 주문번호가 UUID 로 찍혀 CS 대조가 불가능했다.
          orderId: orderRow.order_number,
          orderName,
          amount: chargeAmount,
          idempotencyKey,
        }),
    )

    if (result.ok) {
      // ★결제 감사 #3 (2026-07-29): 프로모션 소진을 **청구 성공 후로** 옮겼다.
      //   예전엔 주문 row 생성 직후 소진 표시를 했는데, 그 뒤 청구가 실패하면
      //   주문은 취소되지만 claim 은 그 취소된 주문에 묶인 채 남았다.
      //   pending_promotion_rate 는 redeemed_order_id IS NULL 만 보므로 재시도는
      //   **정가 청구** — 50% 이벤트로 가입한 고객이 잔액부족 한 번에 할인을
      //   영구히 잃고 다음날 100% 결제되는 경로였다. '썼다'는 실제로 그 할인으로
      //   결제가 됐을 때만 참이다.
      if (promoClaimed) {
        try {
          await (
            supabase as unknown as {
              from: (t: string) => {
                update: (r: Record<string, unknown>) => {
                  eq: (c: string, v: string) => {
                    is: (c: string, v: null) => Promise<unknown>
                  }
                }
              }
            }
          )
            .from('promotion_claims')
            .update({
              redeemed_order_id: orderRow!.id,
              redeemed_at: new Date().toISOString(),
            })
            .eq('user_id', sub.user_id)
            .is('redeemed_order_id', null)
        } catch {
          /* 소진 표시 실패 — 결제는 이미 성공. admin 보정 대상. */
        }
      }

      // 2-d) 성공 → orders / charge / subscription 업데이트.
      // 성공하면 모든 retry/renewal 플래그를 0/false 로 reset (이전에 실패해서
      // 카드 재등록 받은 후 정상화 케이스 포함).
      const successIso = new Date().toISOString()
      const nextDate = nextDeliveryDate(sub.next_delivery_date, today)

      // R61 — 결제 원장 event (정기구독 자동 결제).
      {
        const { recordPaymentEvent } = await import('@/lib/payment-events')
        await recordPaymentEvent(supabase, {
          orderId: orderRow.id,
          paymentKey: result.paymentKey,
          eventType: 'paid',
          amount: chargeAmount,
          prevStatus: 'pending',
          newStatus: 'paid',
          source: 'cron_subscription_charge',
          metadata: {
            subscriptionId: sub.id,
            idempotencyKey,
          },
        })
      }

      // ★청구 후 상태 재확인 (2026-07-30 최종감사) — 토스 응답을 최대 30초
      //   기다리는 사이에 고객이 해지·정지했을 수 있다. 선점(위 last_charge_lock_at)은
      //   "긁기 시작할 때 active 였음"만 보장하고, 긁는 **동안**의 해지는 못 막는다.
      //
      //   그때 일어나는 일: 돈은 나갔는데 피킹 리스트는 구독 status='active' 만
      //   뽑으므로(admin/personalization/picking-list) 박스가 자동 발송 목록에서
      //   빠진다 → **고객은 결제만 되고 아무것도 못 받는다.** 게다가 주문이
      //   'preparing' 으로 남아 관리자 주문 목록에 뜨니 사람이 보고 보낼 수도 있다.
      //
      //   그래서 해지가 감지되면 ① 주문을 발송 대기로 올리지 않고 ② 즉시 환불하고
      //   ③ 실패하면 환불 큐에 넣는다(confirm 라우트의 race 처리와 같은 패턴).
      const { data: afterCharge } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('id', sub.id)
        .maybeSingle()
      const stillActiveAfterCharge =
        (afterCharge as { status?: string } | null)?.status === 'active'

      if (!stillActiveAfterCharge) {
        captureBusinessEvent('error', 'subscription.charge.cancelled_mid_charge', {
          subscriptionId: sub.id,
          userId: sub.user_id,
          orderId: orderRow.id,
          paymentKey: String(result.paymentKey),
          amount: chargeAmount,
          statusAfter: String((afterCharge as { status?: string } | null)?.status),
          note: '카드 청구 도중 고객이 해지·정지했다. 환불 시도 후 주문은 발송 대기로 올리지 않는다.',
        })
        const refund = await cancelPayment({
          paymentKey: result.paymentKey!,
          cancelReason: '청구 도중 고객 해지 — 자동 환불',
        })
        if (!refund.ok) {
          // 즉시 환불 실패 → 큐로. refund-retry 크론이 이어받는다.
          await (supabase as unknown as {
            from: (t: string) => {
              insert: (r: Record<string, unknown>) => Promise<{ error: unknown }>
            }
          })
            .from('payment_refund_queue')
            .insert({
              order_id: orderRow.id,
              payment_key: result.paymentKey,
              amount: chargeAmount,
              reason: 'cancelled_mid_charge',
            })
        }
        // 주문은 결제됨으로 기록하되 발송 대기로 올리지 않는다(order_status 유지).
        await supabase
          .from('orders')
          .update({
            payment_status: refund.ok ? 'cancelled' : 'paid',
            payment_key: result.paymentKey,
            paid_at: successIso,
            cancel_reason: refund.ok ? '청구 도중 고객 해지 — 자동 환불' : null,
          })
          .eq('id', orderRow.id)
        skipped += 1
        continue
      }

      // 2-d) orders / subscription 업데이트 — 결과(error)를 검사한다. 돈은 이미
      //   Toss 에서 청구(capture)됐으므로 후속 update 실패를 silent 통과시키면
      //   '결제됐는데 payment_status=pending' 불일치가 남는다(점검 high). 실패 시
      //   charge 를 'succeeded' 로 마킹하지 않고 즉시 알림 → 수동/cron 재정산.
      const ordersUpd = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          order_status: 'preparing',
          payment_key: result.paymentKey,
          paid_at: successIso,
        })
        .eq('id', orderRow.id)
      const subUpd = await supabase
        .from('subscriptions')
        .update({
          next_delivery_date: nextDate,
          last_charged_at: successIso,
          failed_charge_count: 0,
          next_retry_at: null,
          last_failed_charge_at: null,
          last_failed_charge_reason: null,
          last_failed_charge_code: null,
          requires_billing_key_renewal: false,
          total_deliveries: sub.total_deliveries + 1,
        })
        .eq('id', sub.id)
      const postOk = !ordersUpd.error && !subUpd.error
      // audit #79: subscription_charges schema-drift cast.
      await (supabase as unknown as {
        from: (t: string) => {
          update: (r: Record<string, unknown>) => {
            eq: (c: string, v: string) => Promise<unknown>
          }
        }
      })
        .from('subscription_charges')
        .update({
          // 후속 update 실패 시 'succeeded' 금지 → 'pending' 유지(payment_key 존재 =
          // '청구됐으나 미확정' reconcile 신호). payment_events 엔 이미 paid 기록.
          status: postOk ? 'succeeded' : 'pending',
          payment_key: result.paymentKey,
          order_id: orderRow!.id,
          completed_at: postOk ? successIso : null,
        })
        .eq('id', chargeRow!.id)
      if (postOk) {
        captureBusinessEvent('info', 'subscription.charge.succeeded', {
          subscriptionId: sub.id,
          amount: chargeAmount,
          attemptCount: sub.failed_charge_count + 1,
        })
      } else {
        // 돈은 청구됐는데 주문/구독 갱신 실패 → 즉시 알림(수동 재정산 필요).
        captureBusinessEvent('error', 'subscription.charge.post_update_failed', {
          subscriptionId: sub.id,
          orderId: orderRow!.id,
          paymentKey: result.paymentKey,
          ordersError: ordersUpd.error?.message ?? null,
          subError: subUpd.error?.message ?? null,
        })
      }
      succeeded += 1
    } else {
      // 2-e) 실패 → 에러 코드 분류해서 분기.
      //
      // permanent (카드 만료/유효 X): 즉시 paused + requires_billing_key_renewal.
      //   재시도 의미 없음. 사용자가 카드 다시 등록할 때까지 대기.
      // transient (잔액부족/네트워크): count 증가 안 함, next_retry_at +24h.
      //   같은 카드로 시간 지나면 풀릴 가능성.
      // unknown: 기존 3-strike 정책 — count++, 3회면 paused.
      const errorCode = result.error?.code ?? null
      const errorClass = classifyBillingError(errorCode)
      const nowIso2 = new Date().toISOString()

      let shouldPause = false
      let shouldMarkRenewal = false
      let nextFailedCount = sub.failed_charge_count
      let nextRetryAt: string | null = null
      const reasonShort = describeBillingError(errorCode).short

      if (errorClass === 'permanent') {
        shouldPause = true
        shouldMarkRenewal = true
        // permanent 는 count 증가 의미 없음 — 1회 카운트만 찍어 history 보전.
        nextFailedCount = sub.failed_charge_count + 1
      } else if (errorClass === 'transient') {
        // count 증가 안 함 — 사용자가 같은 카드로 시간 지나면 결제 가능.
        nextRetryAt = new Date(Date.now() + RETRY_COOLDOWN_MS).toISOString()
      } else {
        // unknown: 기존 3-strike.
        nextFailedCount = sub.failed_charge_count + 1
        shouldPause = nextFailedCount >= MAX_FAILED
      }

      const subUpdate: Record<string, unknown> = {
        failed_charge_count: nextFailedCount,
        last_failed_charge_at: nowIso2,
        last_failed_charge_code: errorCode,
        last_failed_charge_reason: result.error?.message ?? reasonShort,
        next_retry_at: nextRetryAt,
      }
      if (shouldPause) subUpdate.status = 'paused'
      if (shouldMarkRenewal) subUpdate.requires_billing_key_renewal = true

      // audit #79: orders/subscriptions/subscription_charges schema-drift cast.
      const untyped = supabase as unknown as {
        from: (t: string) => {
          update: (r: Record<string, unknown>) => {
            eq: (c: string, v: string) => Promise<unknown>
          }
        }
      }
      await Promise.all([
        untyped
          .from('orders')
          .update({
            payment_status: 'failed',
            order_status: 'cancelled',
            cancel_reason: result.error?.message ?? '결제 실패',
            cancelled_at: nowIso2,
          })
          .eq('id', orderRow!.id),
        untyped
          .from('subscription_charges')
          .update({
            status: 'failed',
            error_code: errorCode,
            error_message: result.error?.message,
            completed_at: nowIso2,
          })
          .eq('id', chargeRow!.id),
        untyped.from('subscriptions').update(subUpdate).eq('id', sub.id),
      ])

      // 매출 영향 이벤트 — Sentry breadcrumb 분류 가능하게 errorClass 같이 기록.
      captureBusinessEvent(
        shouldPause ? 'warning' : 'info',
        shouldMarkRenewal
          ? 'subscription.charge.renewal_required'
          : shouldPause
            ? 'subscription.charge.paused'
            : errorClass === 'transient'
              ? 'subscription.charge.transient'
              : 'subscription.charge.failed',
        {
          subscriptionId: sub.id,
          amount: chargeAmount,
          attemptCount: nextFailedCount,
          errorCode,
          errorClass,
        },
      )
      failed += 1

      // 푸시 알림 — order 카테고리 (push_preferences + quiet hours 자동 검사).
      // 이메일과 별개로 push ON 사용자에게도 닿게. permanent / transient /
      // unknown 별로 톤 다르게.
      const pushTitle = shouldMarkRenewal
        ? '카드 정보를 다시 등록해 주세요 💳'
        : shouldPause
          ? '정기배송이 일시중단됐어요'
          : errorClass === 'transient'
            ? '결제가 잠시 실패 — 내일 다시 시도할게요'
            : '정기배송 결제 실패'
      const pushBody = shouldMarkRenewal
        ? `${reasonShort} · 마이페이지에서 새 카드 등록`
        : shouldPause
          ? '연속 3회 실패. 마이페이지에서 카드 확인'
          : reasonShort
      // R83-6: 이전엔 `.catch(() => {})` + `void (async () => ...)` 로 fire-and-forget.
      // Vercel function 은 handler return 시 background promise 를 절단하므로 push/email
      // 이 실제로 발송 안 될 가능성 존재. cron 은 사용자 응답 latency 압박 없음 →
      // 안전하게 await. push/email 실패가 결제 전체를 막진 않게 try/catch 로 격리.
      try {
        await pushToUser(
          sub.user_id,
          {
            title: pushTitle,
            body: pushBody,
            url: '/mypage/subscriptions',
            tag: `sub-charge-failed-${sub.id}-${today}`,
            requireInteraction: shouldMarkRenewal,
          },
          { category: 'order' },
        )
      } catch {
        /* push 실패 — 다음 cycle 에 retry 됨 */
      }

      // 사용자에게 결제 실패 이메일 발송.
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, name')
          .eq('id', sub.user_id)
          .maybeSingle()
        if (profile?.email) {
          const { data: items } = await supabase
            .from('subscription_items')
            .select('product_name, quantity')
            .eq('subscription_id', sub.id)
            .limit(2)
          const itemsArr = (items ?? []) as { product_name: string; quantity: number }[]
          const productLabel =
            itemsArr.length === 0
              ? '정기배송 상품'
              : itemsArr.length === 1
                ? itemsArr[0]!.product_name
                : `${itemsArr[0]!.product_name} 외 ${itemsArr.length - 1}개`
          await notifySubscriptionChargeFailed({
            email: profile.email,
            name: profile.name ?? null,
            subscriptionId: sub.id,
            productLabel,
            amount: chargeAmount,
            attemptCount: nextFailedCount,
            paused: shouldPause,
            reason: result.error?.message ?? reasonShort,
            scheduledFor: today,
            errorClass,
            nextRetryAt,
          })
        }
      } catch {
        /* email 발송 실패 — 다음 cron 시 재발송 idempotencyKey 가 차단 */
      }
    }

    // QPS 보호 — Toss 분당 제한 안 넘게 100ms 간격.
    await new Promise((r) => setTimeout(r, 100))
  }

  return NextResponse.json({
    ok: true,
    today,
    checked: targets.length,
    succeeded,
    failed,
    skipped,
  })
}
