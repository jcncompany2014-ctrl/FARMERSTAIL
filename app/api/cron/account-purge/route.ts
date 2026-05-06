import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/account-purge
 *
 * 전자상거래법 §6 — 계약/청약철회/대금결제/재화공급 기록 5년 보관 후 폐기.
 *
 * 처리 대상:
 *   - profiles.deleted_at <= 5년 전 (1825일+) 인 사용자
 *
 * 폐기 작업:
 *   1. orders + order_items + refunds + subscription_charges + point_ledger 등
 *      transaction 테이블에서 user_id 행을 hard-delete
 *   2. account_deletions audit row 의 purged_at 마킹 (재가입 detect 만 유지)
 *   3. profiles row 도 삭제 (이미 익명화 상태라 hash 만 audit 에 남음)
 *
 * # 보안
 * Bearer CRON_SECRET. 매월 1일 새벽 KST 04:00 (UTC 19:00) 실행 권장.
 *
 * # 잔여
 * - reviews / product_qna 는 다른 사용자에게 보이는 콘텐츠 + 익명화 표시 가능.
 *   → 보존. 명시적 삭제 요청 시 별도 처리.
 * - subscription_charges 는 결제 기록이라 5년 보관 필수 — orders 와 함께 삭제.
 */

const RETENTION_DAYS = 5 * 365 // 1825일
const MAX_PER_RUN = 50

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }

  const supabase = createAdminClient()
  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  // 1) 5년 + 탈퇴 누적된 profile select.
  const { data: profiles, error: fetchErr } = await supabase
    .from('profiles')
    .select('id, deleted_at')
    .not('deleted_at', 'is', null)
    .lte('deleted_at', cutoff)
    .limit(MAX_PER_RUN)

  if (fetchErr) {
    return NextResponse.json(
      { ok: false, error: fetchErr.message },
      { status: 500 },
    )
  }

  const targets = (profiles ?? []) as Array<{
    id: string
    deleted_at: string
  }>

  let purged = 0
  for (const p of targets) {
    // Transactional 데이터 hard-delete. ON DELETE CASCADE 로 묶여 있는 표는
    // orders 만 지워도 자동 정리되지만 일부는 user_id 직접 보유.
    await Promise.all([
      supabase.from('refunds').delete().eq('user_id', p.id),
      supabase.from('subscription_charges').delete().eq('user_id', p.id),
      supabase.from('coupon_redemptions').delete().eq('user_id', p.id),
      supabase.from('birthday_coupon_log').delete().eq('user_id', p.id),
      supabase.from('point_ledger').delete().eq('user_id', p.id),
      // orders ON DELETE CASCADE 로 order_items / refunds(다시) 도 정리.
      supabase.from('orders').delete().eq('user_id', p.id),
      supabase.from('subscriptions').delete().eq('user_id', p.id),
    ])

    // consent_log 는 동의 입증 용 → 5년 + α 보존이라 보수적으로 함께 삭제.
    await supabase.from('consent_log').delete().eq('user_id', p.id)

    // profile row 도 삭제 (이미 익명화 상태). account_deletions 의 email_hash
    // 만 남아 재가입 detect 가능.
    await supabase.from('profiles').delete().eq('id', p.id)

    // account_deletions 에 purged_at 마킹 (있으면).
    await supabase
      .from('account_deletions')
      .update({ purged_at: new Date().toISOString() })
      .eq('user_id', p.id)

    purged += 1
  }

  return NextResponse.json({
    ok: true,
    cutoff,
    checked: targets.length,
    purged,
  })
}
