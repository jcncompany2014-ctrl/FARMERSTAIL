import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { appendLedger } from '@/lib/commerce/points'
import { zAccountDelete } from '@/lib/api/schemas'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/account/delete
 *
 * Self-service account deletion (탈퇴).
 *
 * Legal constraints (KR):
 *   • 개인정보보호법: delete PII on request
 *   • 전자상거래법 제6조: retain order/transaction records for 5 years
 *   • 통신비밀보호법: retain login logs for 3 months
 *
 * So we can't hard-delete — we anonymize.
 *
 * What this does:
 *   1. Verify the user is logged in.
 *   2. Refuse if there's an unfinished order (preparing / shipping) —
 *      the customer needs to finish or cancel that first. Otherwise
 *      ops loses the ability to reach them during fulfillment.
 *   3. Wipe PII from profiles (name, phone, address, birth_year,
 *      marketing consent timestamps) and mark deleted_at = now().
 *      Email is replaced with a reversible-by-id sentinel so admin
 *      CSV reports still make sense.
 *   4. Clear ancillary personal data: dogs (hard delete — they own
 *      their pet profiles), cart_items, push_subscriptions,
 *      push_preferences, restock_alerts, cart_recovery_log,
 *      referral_codes, wishlists, health/weight logs, dog reminders,
 *      analyses, surveys. Orders / reviews / point_ledger stay —
 *      those are transaction records.
 *   5. Insert an `account_deletions` audit row with sha256(email) so
 *      we can detect "same person re-signed up" without storing the
 *      original email. See migration 20260424000006.
 *   6. auth.admin.deleteUser(id, shouldSoftDelete=true) — Supabase
 *      marks the row "deleted" without removing it, preserving FK
 *      integrity on orders.user_id.
 *   7. Sign out the current session so the browser drops the tokens.
 */

type DeleteBody = {
  // User can optionally give a reason — helps with churn analysis.
  reason?: string
  // Require the user to re-confirm by typing "탈퇴" or similar; the
  // frontend enforces this, we re-check here too.
  confirmText?: string
}

export async function POST(req: Request) {
  // 탈퇴는 destructive — 무차별 시도 방지. IP 당 분당 3회면 정상 사용엔 충분.
  const rl = rateLimit({
    bucket: 'account-delete',
    key: ipFromRequest(req),
    limit: 3,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rl.headers },
    )
  }

  // confirmText literal '탈퇴' + reason optional 을 Zod 가 검증.
  const parsed = await parseRequest(req, zAccountDelete)
  if (!parsed.ok) return parsed.response
  const body: DeleteBody = parsed.data

  // 1) Session check (RLS-gated client so we can't be tricked into
  //    deleting someone else's account).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요합니다' },
      { status: 401 }
    )
  }

  // 2) Block deletion while an order is mid-fulfillment. Cancelled
  //    and delivered orders are fine — we only care about in-flight work.
  const { data: openOrders } = await supabase
    .from('orders')
    .select('id, order_status')
    .eq('user_id', user.id)
    .in('order_status', ['preparing', 'shipping'])
    .limit(1)

  if (openOrders && openOrders.length > 0) {
    return NextResponse.json(
      {
        code: 'HAS_OPEN_ORDER',
        message:
          '진행 중인 주문이 있어 탈퇴할 수 없어요. 배송이 완료된 뒤 다시 시도해 주세요.',
      },
      { status: 400 }
    )
  }

  // 3) Switch to admin client for the destructive path — we need to
  //    bypass RLS on auxiliary tables and call auth.admin.deleteUser.
  const admin = createAdminClient()

  // Capture the original email BEFORE anonymizing — we need it to
  // compute the audit hash. user.email is the auth email; profiles.email
  // is kept in sync but auth is the source of truth.
  const originalEmail = (user.email ?? '').trim().toLowerCase()

  // Anonymize profile. Email becomes a stable sentinel so the
  // accounting team can trace which orders belonged to a deleted
  // account without exposing the original email.
  const anonEmail = `deleted-${user.id}@deleted.local`
  await admin
    .from('profiles')
    .update({
      email: anonEmail,
      name: '탈퇴회원',
      phone: null,
      address: null,
      address_detail: null,
      zip: null,
      agree_sms: false,
      agree_email: false,
      // Step 25/26: age-gate + consent audit columns — clear them so
      // no residual demographic/marketing data remains after 탈퇴.
      birth_year: null,
      agree_email_at: null,
      agree_sms_at: null,
      marketing_policy_version: null,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  // Hard-delete data that is 100% personal and has no transaction
  // record-keeping requirement. Includes Step 20/24/26 tables:
  //   • restock_alerts  — product subscription; no legal retention
  //   • cart_recovery_log — PIPA reminder audit; only needed while user exists
  //   • push_preferences — category opt-in flags
  await Promise.all([
    admin.from('dogs').delete().eq('user_id', user.id),
    admin.from('cart_items').delete().eq('user_id', user.id),
    admin.from('wishlists').delete().eq('user_id', user.id),
    admin.from('push_subscriptions').delete().eq('user_id', user.id),
    admin.from('push_preferences').delete().eq('user_id', user.id),
    admin.from('restock_alerts').delete().eq('user_id', user.id),
    admin.from('cart_recovery_log').delete().eq('user_id', user.id),
    admin.from('referral_codes').delete().eq('user_id', user.id),
    admin.from('health_logs').delete().eq('user_id', user.id),
    admin.from('weight_logs').delete().eq('user_id', user.id),
    admin.from('dog_reminders').delete().eq('user_id', user.id),
    admin.from('analyses').delete().eq('user_id', user.id),
    admin.from('surveys').delete().eq('user_id', user.id),
  ])

  // Audit row — sha256(email) only, so "did the same person sign up
  // again?" is detectable without keeping the plaintext email.
  // sha256_hex is a security-invoker sql function (public) defined in
  // migration 20260424000006.
  let emailHash: string | null = null
  if (originalEmail) {
    const { data: hashData } = await admin.rpc('sha256_hex', {
      input: originalEmail,
    })
    if (typeof hashData === 'string' && hashData.length > 0) {
      emailHash = hashData
    }
  }

  await admin.from('account_deletions').insert({
    user_id: user.id,
    reason: body.reason ? body.reason.trim().slice(0, 200) : null,
    email_hash: emailHash,
    // We already blocked 'preparing'/'shipping' above; this is always 0
    // at the point of deletion, but we keep the column for symmetry
    // with CS tooling that may loosen the block later.
    open_order_count: 0,
  })

  // 4) Log the reason for churn analysis (optional; best-effort).
  //    delta=0 인 "메모성" ledger 엔트리. appendLedger 는 balance_after 를
  //    현재 잔액 그대로 다시 적어 주므로, 탈퇴 이전 잔액이 보존된다.
  if (body.reason && body.reason.trim()) {
    try {
      await appendLedger(admin, {
        userId: user.id,
        delta: 0,
        reason: `탈퇴: ${body.reason.trim().slice(0, 200)}`,
        referenceType: 'account_deletion',
        referenceId: null,
      })
    } catch {
      /* swallow — churn 로그는 critical 아님 */
    }
  }

  // 5) Soft-delete the auth user. This keeps auth.users.id valid so
  //    orders.user_id FK doesn't break, but blocks login.
  //    shouldSoftDelete is supported in supabase-js v2.
  const { error: authErr } = await admin.auth.admin.deleteUser(user.id, true)
  if (authErr) {
    // Profile is already anonymized — we don't want to leave the
    // account half-deleted. Return 500 and let ops clean up. In
    // practice this should never fire if the service role key is
    // valid.
    return NextResponse.json(
      {
        code: 'AUTH_DELETE_FAILED',
        message: `탈퇴 처리 중 일부 오류: ${authErr.message}`,
      },
      { status: 500 }
    )
  }

  // 6) Kill the current session so the browser drops the tokens.
  //    The RLS-gated client above is fine to sign out from.
  await supabase.auth.signOut()

  return NextResponse.json({ ok: true })
}
