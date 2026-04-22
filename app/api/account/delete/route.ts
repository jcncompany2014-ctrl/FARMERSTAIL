import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
 *   3. Wipe PII from profiles (name, phone, address) and mark
 *      deleted_at = now(). Email is replaced with a reversible-by-id
 *      sentinel so admin CSV reports still make sense.
 *   4. Clear ancillary personal data: dogs (hard delete — they own
 *      their pet profiles), cart_items, push_subscriptions,
 *      referral_codes. Orders / reviews / point_ledger stay — those
 *      are transaction records.
 *   5. auth.admin.deleteUser(id, shouldSoftDelete=true) — Supabase
 *      marks the row "deleted" without removing it, preserving FK
 *      integrity on orders.user_id.
 *   6. Sign out the current session so the browser drops the tokens.
 */

type DeleteBody = {
  // User can optionally give a reason — helps with churn analysis.
  reason?: string
  // Require the user to re-confirm by typing "탈퇴" or similar; the
  // frontend enforces this, we re-check here too.
  confirmText?: string
}

export async function POST(req: Request) {
  let body: DeleteBody = {}
  try {
    body = await req.json()
  } catch {
    /* allow empty body */
  }

  if ((body.confirmText ?? '').trim() !== '탈퇴') {
    return NextResponse.json(
      { code: 'CONFIRM_REQUIRED', message: '확인 문구가 일치하지 않아요' },
      { status: 400 }
    )
  }

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
      deleted_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  // Hard-delete data that is 100% personal and has no transaction
  // record-keeping requirement.
  await Promise.all([
    admin.from('dogs').delete().eq('user_id', user.id),
    admin.from('cart_items').delete().eq('user_id', user.id),
    admin.from('wishlists').delete().eq('user_id', user.id),
    admin.from('push_subscriptions').delete().eq('user_id', user.id),
    admin.from('referral_codes').delete().eq('user_id', user.id),
    admin.from('health_logs').delete().eq('user_id', user.id),
    admin.from('weight_logs').delete().eq('user_id', user.id),
    admin.from('dog_reminders').delete().eq('user_id', user.id),
    admin.from('analyses').delete().eq('user_id', user.id),
    admin.from('surveys').delete().eq('user_id', user.id),
  ])

  // 4) Log the reason for churn analysis (optional; best-effort).
  if (body.reason && body.reason.trim()) {
    await admin.from('point_ledger').insert({
      user_id: user.id,
      delta: 0,
      balance_after: 0,
      reason: `탈퇴: ${body.reason.trim().slice(0, 200)}`,
      reference_type: 'account_deletion',
      reference_id: null,
    }).then(() => {/* noop */}, () => {/* swallow — not critical */})
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
