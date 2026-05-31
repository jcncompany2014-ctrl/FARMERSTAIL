import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { appendLedger } from '@/lib/commerce/points'
import { zAccountDelete } from '@/lib/api/schemas'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { tagSentryUser, tagSentryRoute } from '@/lib/sentry/trace'

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
  tagSentryRoute('account.delete')
  await tagSentryUser(supabase)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
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
  //   • dog_formulas / dog_checkins — pet personalization data (펫 정보)
  //   • native_push_tokens / newsletter_subscribers — 통신 채널, 즉시 해제
  //   • addresses — 배송지 저장본 (orders 행에 snapshot 이 별도)
  //   • push_log — 발송 이력 audit 가 user 떠나면 의미 없음
  const deletionOps = await Promise.allSettled([
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
    admin.from('dog_formulas').delete().eq('user_id', user.id),
    admin.from('dog_checkins').delete().eq('user_id', user.id),
    admin.from('native_push_tokens').delete().eq('user_id', user.id),
    admin.from('newsletter_subscribers').delete().eq('user_id', user.id),
    admin.from('addresses').delete().eq('user_id', user.id),
    admin.from('push_log').delete().eq('user_id', user.id),
  ])
  // R101-E: 부분 실패 가시화. Supabase 쿼리는 보통 reject 대신 {error} 를 resolve
  // 하므로 rejected(네트워크)와 fulfilled 의 error 를 모두 검사. 이전엔 Promise.all
  // 결과를 안 봐서 일부 테이블 삭제 실패가 침묵 유실 → PII 잔존(deleted_at 만 찍힘).
  // PIPA 즉시파기 관점에서 로깅해 운영자가 인지/수동 정리하도록.
  const deletionFailures = deletionOps.filter(
    (r) =>
      r.status === 'rejected' ||
      (r.status === 'fulfilled' &&
        (r.value as { error?: unknown } | null)?.error),
  )
  if (deletionFailures.length > 0) {
    console.error(
      `[account/delete] ${deletionFailures.length}/${deletionOps.length} table deletions failed for user ${user.id}`,
    )
  }

  // 정기배송 — billing_key 카드 토큰 즉시 해제 + cancel 처리. 전자상거래법
  // 보관 의무 (subscription_charges) 와 별개로 토큰은 결제수단 정보라 즉시
  // 삭제. 카드사에 알리는 별도 절차는 필요 없음 (Toss 측에서 토큰 invalidation
  // 은 미사용 기간 자동 만료).
  // audit #79: subscriptions 익명화 payload — generated types 가 NOT NULL 로
  // 추론하는 컬럼들이 있어 cast (의도는 NULL 로 익명화).
  const anonymizePayload: Record<string, unknown> = {
    status: 'cancelled',
    billing_key: null,
    billing_customer_key: null,
    billing_card_brand: null,
    billing_card_last4: null,
    requires_billing_key_renewal: false,
    next_retry_at: null,
    next_delivery_date: null,
    // audit launch-fix: subscriptions 에는 recipient_name / recipient_zip /
    // recipient_address / recipient_address_detail 컬럼이 없음.
    // recipient_phone 만 존재 — 그것만 null 처리. 나머지 PII anonymize 는
    // profiles / addresses 에서 별도 처리됨.
    recipient_phone: null,
  }
  await (admin as unknown as {
    from: (t: string) => {
      update: (r: Record<string, unknown>) => {
        eq: (c: string, v: string) => Promise<unknown>
      }
    }
  })
    .from('subscriptions')
    .update(anonymizePayload)
    .eq('user_id', user.id)

  // product_qna / reviews — 작성자 user_id 는 보존 (다른 사용자에게 도움이
  // 되는 컨텐츠). profile.name 이 익명화 ("탈퇴회원") 됐으니 join 결과는
  // 자동으로 탈퇴회원 표시. 별도 author_name 캐시 컬럼은 현재 스키마에 없음.

  // R83-C2 (D1): orders.recipient_* PII 익명화.
  // 전자상거래법 §6 = 거래기록 5년 보존 의무. 하지만 PII (이름/전화/주소) 는
  // PIPA §21 즉시 파기 (수집 목적 달성). recipient_phone/zip/address/address_detail
  // 익명화 + recipient_name "탈퇴회원" 으로 set. 회계 audit 필요 column (총액/
  // 결제수단/결제일/refunded_amount 등) 은 보존.
  await (admin as unknown as {
    from: (t: string) => {
      update: (r: Record<string, unknown>) => {
        eq: (c: string, v: string) => Promise<unknown>
      }
    }
  })
    .from('orders')
    .update({
      recipient_name: '탈퇴회원',
      recipient_phone: '000-0000-0000',
      zip: '00000',
      address: '(주소 익명화 처리됨)',
      address_detail: null,
      delivery_memo: null,
      // cash_receipt_number 도 PII (전화번호) 라 익명화.
      cash_receipt_number: null,
    })
    .eq('user_id', user.id)

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
