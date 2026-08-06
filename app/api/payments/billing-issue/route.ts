import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import { issueBillingKey } from '@/lib/payments/toss'
import { billingBrandLabel } from '@/lib/payments/billing-methods'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { tagSentryUser, tagSentryRoute } from '@/lib/sentry/trace'
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
 *   - method: 무엇으로 등록했는지 (card | tosspay, 생략 가능) — 표시 라벨 전용
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
  /**
   * 무엇으로 등록했는지 (card | tosspay). billing-auth 가 successUrl 에 실어
   * 보낸 값이라 **클라이언트 제공값**이다 — 그래서 화면 표시 라벨로만 쓴다.
   * 실제 결제 능력은 토스가 발급한 billingKey 가 결정하므로 이 값이 틀려도
   * 돈에는 영향이 없다. 없으면 카드로 낙하(기존 호출 무손상).
   */
  method: z.enum(['card', 'tosspay']).optional(),
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
  const method = parsed.data.method ?? 'card'

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
  // 토스페이로 등록하면 카드사명이 안 올 수 있다(고객이 토스 안에서 고른 수단이
  // 카드가 아닐 수도 있다). 그때 이름이 비면 화면에 아무것도 안 뜨므로 수단
  // 이름('토스페이')으로 대체한다. 카드는 토스가 늘 카드사를 주므로 그대로.
  const brand = billingBrandLabel(method, result.cardCompany)

  /**
   * ★ 빌링키는 받았는데 카드 정보가 하나도 없으면 남긴다 (2026-07-31).
   *
   * 사장님 실기기 테스트에서 "카드 등록 완료" 는 떴는데 **카드사·끝4자리가
   * 아무것도 안 보였다.** 등록 자체는 `billing_key` 로 판정하므로 결제엔 지장이
   * 없지만, 고객도 사장님도 **어떤 카드가 걸렸는지 알 수 없는** 상태가 된다.
   *
   * 토스 응답의 카드 정보는 최상위(`cardCompany`/`cardNumber`)로 오기도 하고
   * `card` 객체 안에만 오기도 해서 둘 다 읽게 고쳤다(lib/payments/toss.ts).
   * 그래도 비면 **토스가 정말 안 주는 것**이므로, 추측 대신 기록을 남겨
   * 다음 테스트 한 번으로 판별한다.
   * (카드 번호·키 값은 절대 안 남긴다 — 유무만.)
   */
  if (!brand && !last4) {
    captureBusinessEvent('warning', 'billing.issue.card_meta_missing', {
      userId: user.id,
      subscriptionId,
      method,
      hasCardCompany: Boolean(result.cardCompany),
      hasCardNumber: Boolean(result.cardNumber),
    })
  }

  // 카드 등록(또는 재등록) 시 retry/renewal 상태 reset.
  // - paused 면서 requires_billing_key_renewal=true 였던 구독은 자동 active 화
  //   (사용자가 카드 다시 등록하는 의도 = 다시 정기배송 받겠다).
  // - failed_charge_count / next_retry_at / last_failed_* 모두 clear.
  // 다음 cron 사이클에서 정상 결제 시도 → 성공 시 next_delivery_date 갱신.
  const wasInRenewal = await supabase
    .from('subscriptions')
    .select(
      'status, requires_billing_key_renewal, next_delivery_date, dog_id',
    )
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .maybeSingle()
  // ★조회 실패를 "해당 없음"으로 읽으면 두 갈래가 동시에 틀어진다(2026-08-07):
  //   ① shouldResume=false → 카드를 다시 등록해도 **paused 그대로 = 영구 정지**
  //      (응답은 ok:true 라 고객은 성공한 줄 안다. 화면 안내는 "다시 등록하면
  //       자동으로 다시 시작돼요"라고 말한다.)
  //   ② !cur?.next_delivery_date 가 참 → **기존 배송일을 다음 화요일로 덮어씀**
  //      (주기가 최대 12일 당겨진다).
  //   규칙32 정규식은 `const { data } = await supabase` 형태만 봐서 이
  //   `const x = await …; x.data` 패턴을 구조적으로 못 잡았다.
  if (wasInRenewal.error) {
    console.error('[billing-issue] 구독 상태 조회 실패:', wasInRenewal.error.message)
    return NextResponse.json(
      {
        ok: false,
        code: 'LOOKUP_FAILED',
        message: '등록 상태를 확인하지 못했어요. 정기배송 화면에서 확인해 주세요.',
      },
      { status: 500 },
    )
  }
  const cur = wasInRenewal.data as {
    status?: string
    requires_billing_key_renewal?: boolean
    next_delivery_date?: string | null
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
  // 구독은 박스 하나뿐이고 주기도 2주 하나다(2026-07-13 확정) — '비박스/다른 주기'
  // 분기는 옛 낱개 커머스 잔재라 제거(2026-07-16). 첫 배송은 언제나 다음 화요일.
  let firstDeliveryIso: string | null = null
  if (!cur?.next_delivery_date) {
    firstDeliveryIso = nextShipDate()
  }

  /**
   * ★★ service_role 로 쓴다 — 로그인 클라이언트로는 **저장이 안 된다** (2026-07-31).
   *
   * 20260730000000 이 `subscriptions` UPDATE 를 4칸 화이트리스트로 잠갔는데
   * (status · next_delivery_date · reminder_enabled · last_failed_charge_reason)
   * 이 블록이 쓰는 12칸 중 **9칸이 그 밖**이다 — billing_key · billing_customer_key ·
   * billing_card_brand · billing_card_last4 · requires_billing_key_renewal ·
   * failed_charge_count · next_retry_at · last_failed_charge_at ·
   * last_failed_charge_code (실측: has_column_privilege 전부 false).
   *
   * 그래서 이 UPDATE 는 권한 오류로 **통째로 실패**했고, 아래 응답은 그걸 모른 채
   * `ok: true` 를 돌려줬다(예전엔 `await supabase...` 로 error 를 아예 안 받았다).
   * 결과: 고객은 "카드 등록 완료"를 보는데 billing_key 가 안 남아 **영원히 청구되지
   * 않는다.** 토스에는 빌링키가 발급돼 있고 우리만 모르는 상태 — 최악의 조합이다.
   *
   * 이 라우트는 위(:80~:97)에서 **본인 구독 + customerKey 일치**를 이미 확인했다.
   * 범위는 그 검증이 책임지고, 쓰기는 서버 권한으로 한다. `.eq('user_id')` 는
   * 이중 안전장치로 남긴다.
   */
  const admin = createAdminClient()
  const { error: saveErr } = await admin
    .from('subscriptions')
    .update({
      billing_key: result.billingKey,
      billing_customer_key: customerKey,
      billing_card_brand: brand,
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

  if (saveErr) {
    /**
     * 저장 실패를 **성공으로 말하지 않는다.** 토스에는 이미 빌링키가 있는데
     * 우리 DB 에 없으면, 고객은 등록됐다고 믿고 우리는 청구하지 못한다 —
     * 아무도 모르는 채 배송만 멈춘다. 반드시 사람이 봐야 하고, 고객에겐
     * 다시 시도할 수 있다고 말해야 한다.
     */
    captureBusinessEvent('error', 'billing.issue.save_failed', {
      userId: user.id,
      subscriptionId,
      method,
      dbError: saveErr.message,
    })
    return NextResponse.json(
      {
        code: 'SAVE_FAILED',
        message:
          '카드 확인은 됐는데 저장에 실패했어요. 잠시 후 다시 등록해 주세요 — 지금은 결제되지 않아요.',
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    cardBrand: brand,
    last4,
    resumed: shouldResume,
  })
}
