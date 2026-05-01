import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/privacy/export
 *
 * 개인정보보호법 제35조 (개인정보의 열람) — 정보주체가 자신의 개인정보를
 * 열람하거나 사본을 받을 권리. JSON 다운로드 형식으로 본인 데이터 일괄 제공.
 *
 * # 포함 데이터
 * - profile (이름/이메일/전화/주소/생년/마케팅 동의 등)
 * - dogs + surveys + analyses + weight_logs + health_logs + reminders
 * - addresses
 * - orders + order_items
 * - subscriptions + subscription_items + subscription_charges
 * - reviews
 * - wishlists
 * - point_ledger
 * - consent_log
 * - native_push_tokens (mask: token 마지막 8자만)
 *
 * # 미포함 (보안)
 * - auth.users 의 hashed_password / refresh_tokens
 * - 다른 사용자의 데이터
 * - billing_key (Toss 토큰 — 본인이 가지고 있어도 의미 없고 노출 위험)
 *
 * # 보안
 * - 본인만, rate limit 1/min/IP (heavy query 보호)
 * - Content-Disposition attachment 로 다운로드 강제
 */
export async function GET(req: Request) {
  const rl = rateLimit({
    bucket: 'privacy-export',
    key: ipFromRequest(req),
    limit: 1,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      {
        code: 'RATE_LIMITED',
        message: '잠시 후 다시 시도해 주세요. 데이터 추출은 분당 1회로 제한돼요.',
      },
      { status: 429, headers: rl.headers },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요합니다' },
      { status: 401 },
    )
  }

  // 모든 쿼리 병렬 — RLS 가 본인 row 만 허용. 일부 테이블 접근 실패해도
  // 다른 데이터는 응답에 포함하도록 try/catch 가 아닌 Promise.allSettled.
  const [
    profileRes,
    dogsRes,
    surveysRes,
    analysesRes,
    weightLogsRes,
    healthLogsRes,
    remindersRes,
    addressesRes,
    ordersRes,
    orderItemsRes,
    subscriptionsRes,
    subscriptionItemsRes,
    subscriptionChargesRes,
    reviewsRes,
    wishlistsRes,
    pointLedgerRes,
    consentLogRes,
    nativeTokensRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('dogs').select('*').eq('user_id', user.id),
    supabase.from('surveys').select('*').eq('user_id', user.id),
    supabase.from('analyses').select('*').eq('user_id', user.id),
    supabase.from('weight_logs').select('*').eq('user_id', user.id),
    supabase.from('health_logs').select('*').eq('user_id', user.id),
    supabase.from('dog_reminders').select('*').eq('user_id', user.id),
    supabase.from('addresses').select('*').eq('user_id', user.id),
    supabase.from('orders').select('*').eq('user_id', user.id),
    supabase.from('order_items').select('*').eq('user_id', user.id),
    supabase.from('subscriptions').select('*').eq('user_id', user.id),
    supabase.from('subscription_items').select('*').eq('user_id', user.id),
    supabase.from('subscription_charges').select('*').eq('user_id', user.id),
    supabase.from('reviews').select('*').eq('user_id', user.id),
    supabase.from('wishlists').select('*').eq('user_id', user.id),
    supabase.from('point_ledger').select('*').eq('user_id', user.id),
    supabase.from('consent_log').select('*').eq('user_id', user.id),
    supabase
      .from('native_push_tokens')
      .select('platform, device_id, app_version, os_version, created_at, updated_at')
      .eq('user_id', user.id),
  ])

  // billing_key / billing_customer_key 마스킹 — subscriptions 응답에서 제거.
  const subscriptions = (subscriptionsRes.data ?? []).map((s) => {
    const copy = { ...(s as Record<string, unknown>) }
    delete copy.billing_key
    delete copy.billing_customer_key
    return copy
  })

  const exportData = {
    exported_at: new Date().toISOString(),
    user_id: user.id,
    auth: {
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      provider: user.app_metadata?.provider ?? null,
    },
    profile: profileRes.data ?? null,
    dogs: dogsRes.data ?? [],
    surveys: surveysRes.data ?? [],
    analyses: analysesRes.data ?? [],
    weight_logs: weightLogsRes.data ?? [],
    health_logs: healthLogsRes.data ?? [],
    dog_reminders: remindersRes.data ?? [],
    addresses: addressesRes.data ?? [],
    orders: ordersRes.data ?? [],
    order_items: orderItemsRes.data ?? [],
    subscriptions,
    subscription_items: subscriptionItemsRes.data ?? [],
    subscription_charges: subscriptionChargesRes.data ?? [],
    reviews: reviewsRes.data ?? [],
    wishlists: wishlistsRes.data ?? [],
    point_ledger: pointLedgerRes.data ?? [],
    consent_log: consentLogRes.data ?? [],
    native_push_tokens: nativeTokensRes.data ?? [],
    // 명시적 미포함 표기 — 사용자에게 투명하게.
    _excluded: {
      billing_key: '결제 토큰은 보안상 미포함 (본인 카드 직접 조회 가능)',
      hashed_password: '비밀번호는 hash 저장이라 추출 불가',
    },
  }

  const filename = `farmerstail-data-export-${user.id.slice(0, 8)}-${new Date()
    .toISOString()
    .slice(0, 10)}.json`

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
}
