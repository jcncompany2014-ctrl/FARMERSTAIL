import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { issueBillingKey } from '@/lib/payments/toss'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { tagSentryUser, tagSentryRoute } from '@/lib/sentry/trace'
import { todayKstIsoDate, addDaysKst } from '@/lib/datetime-kst'
import { nextShipDate } from '@/lib/shipping-schedule'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/payments/billing-issue
 *
 * Toss billing authKey 를 영구 billingKey 로 교환하고 subscriptions.billing_key
 * 에 저장. /subscribe/billing-success 페이지가 successUrl callback 으로 호출.
 *
 * Body:
 *   - authKey: Toss 가 successUrl 에 붙여 보낸 1회용 인증키
 *   - customerKey: 우리가 발급한 UUID (subscriptions.billing_customer_key 와
 *     일치해야 함)
 *   - subscriptionId: 어느 구독에 카드를 연결할지
 *
 * 보안:
 *   - 본인 구독인지 RLS 우회 검증 (user.id == subscriptions.user_id)
 *   - rate limit (분당 5)
 *   - billingKey 자체는 카드정보 토큰화 결과 — DB 에만 저장, 응답엔 mask 만.
 */

const zBillingIssue = z.object({
  authKey: z.string().min(8).max(200),
  customerKey: z.string().uuid('잘못된 customerKey'),
  subscriptionId: z.string().uuid('잘못된 subscription ID'),
})

export async function POST(req: Request) {
  const rl = rateLimit({
    bucket: 'billing-issue',
    key: ipFromRequest(req),
    limit: 5,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rl.headers },
    )
  }

  const parsed = await parseRequest(req, zBillingIssue)
  if (!parsed.ok) return parsed.response
  const { authKey, customerKey, subscriptionId } = parsed.data

  const supabase = await createClient()
  tagSentryRoute('subscription.billing.issue')
  await tagSentryUser(supabase)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
      { status: 401 },
    )
  }

  // 본인 구독 + customerKey 일치 확인.
  const { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .select('id, user_id, billing_customer_key, billing_key')
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (subErr || !sub) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '구독을 찾을 수 없어요' },
      { status: 404 },
    )
  }
  if (sub.billing_customer_key && sub.billing_customer_key !== customerKey) {
    return NextResponse.json(
      { code: 'CUSTOMER_KEY_MISMATCH', message: '결제 정보가 맞지 않아요' },
      { status: 400 },
    )
  }

  // billingKey 발급.
  const result = await issueBillingKey({ authKey, customerKey })
  if (!result.ok || !result.billingKey) {
    return NextResponse.json(
      {
        code: result.error?.code ?? 'BILLING_ISSUE_FAILED',
        message: result.error?.message ?? '카드 등록에 실패했어요',
      },
      { status: 502 },
    )
  }

  // last4 만 추출 — masked "536160******1234" → "1234"
  const last4 = result.cardNumber
    ? result.cardNumber.replace(/\*/g, '').slice(-4)
    : null

  // 카드 등록(또는 재등록) 시 retry/renewal 상태 reset.
  // - paused 면서 requires_billing_key_renewal=true 였던 구독은 자동 active 화
  //   (사용자가 카드 다시 등록하는 의도 = 다시 정기배송 받겠다).
  // - failed_charge_count / next_retry_at / last_failed_* 모두 clear.
  // 다음 cron 사이클에서 정상 결제 시도 → 성공 시 next_delivery_date 갱신.
  const wasInRenewal = await supabase
    .from('subscriptions')
    .select(
      'status, requires_billing_key_renewal, next_delivery_date, interval_weeks, coverage_weeks, dog_id',
    )
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .maybeSingle()
  const cur = wasInRenewal.data as {
    status?: string
    requires_billing_key_renewal?: boolean
    next_delivery_date?: string | null
    interval_weeks?: number | null
    coverage_weeks?: number | null
    dog_id?: string | null
  } | null
  const shouldResume =
    cur?.status === 'paused' && cur?.requires_billing_key_renewal === true
  // 최초 카드 등록 = 배송 일정 없음(null)이던 신규 구독 → 카드 확정 시점에 첫
  // 배송 스케줄. 이미 일정 있는 재등록(카드 갱신)은 그대로 유지. (OrderClient·
  // SubscribeClient 는 카드 등록 전엔 next_delivery_date=null 로 생성 — 홈에서
  // 결제 안 된 구독이 '활성'으로 뜨는 문제 차단, 사장님 2026-07-14.)
  //
  // 박스 구독의 **첫** 배송은 '다음 화요일'이다(발송은 화요일 하루 — 사장님
  // 2026-07-15, lib/shipping-schedule). 이전엔 오늘+14일로 잡았는데 그러면
  // ① 카드 등록하고 2주를 빈손으로 기다리고(첫 박스인데 주기를 먼저 태움)
  // ② 화면의 '첫 발송 O월 O일(화)' 과 실제 날짜가 어긋났다.
  // 이후 배송은 cron(subscription-charge)이 +14일 하는데, 14일 = 정확히 2주라
  // 첫 배송만 화요일로 맞추면 이후는 저절로 화요일로 정렬된다.
  //
  // 레거시 비박스 구독은 발송 요일 규칙 밖이라 기존 계산 유지.
  let firstDeliveryIso: string | null = null
  if (!cur?.next_delivery_date) {
    const todayIso = todayKstIsoDate()
    const isBoxSub = !!cur?.dog_id && cur?.coverage_weeks != null
    firstDeliveryIso = isBoxSub
      ? nextShipDate(todayIso)
      : addDaysKst(todayIso, (cur?.interval_weeks ?? 2) * 7)
  }

  await supabase
    .from('subscriptions')
    .update({
      billing_key: result.billingKey,
      billing_customer_key: customerKey,
      billing_card_brand: result.cardCompany ?? null,
      billing_card_last4: last4,
      requires_billing_key_renewal: false,
      failed_charge_count: 0,
      next_retry_at: null,
      last_failed_charge_at: null,
      last_failed_charge_reason: null,
      last_failed_charge_code: null,
      ...(shouldResume ? { status: 'active' } : {}),
      ...(firstDeliveryIso ? { next_delivery_date: firstDeliveryIso } : {}),
    })
    .eq('id', subscriptionId)
    .eq('user_id', user.id)

  return NextResponse.json({
    ok: true,
    cardBrand: result.cardCompany ?? null,
    last4,
    resumed: shouldResume,
  })
}
