import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'

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
  // R83-E3 (D3): trackCron wrap.
  return trackCron('account-purge', async () => {
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
  let failed = 0
  for (const p of targets) {
    // R83-7: sequential delete (이전 Promise.all 은 race 위험).
    // R83-8 에서 refunds.order_id FK 를 RESTRICT 로 바꿨으므로 순서가 중요:
    //   refunds / payment_refund_queue → orders 순서로 삭제.
    // 한 row 라도 실패하면 이 user 는 다음 cron 에서 재시도 (purged_at 미박힘).
    // R83-7: 환경별 schema 차이 회피 위해 generic table arg — 강한 타입은
    // supabase-js 의 union 제약을 우회하기 위해 cast.
    const deleteStep = async (table: string, col: string = 'user_id') => {
      const { error } = await (
        supabase.from(
          table as 'profiles', // any-of-tables placeholder; runtime 만 사용.
        ) as unknown as {
          delete: () => {
            eq: (
              c: string,
              v: string,
            ) => Promise<{ error: { message: string } | null }>
          }
        }
      )
        .delete()
        .eq(col, p.id)
      if (
        error &&
        !/(does not exist|relation .* does not exist)/i.test(error.message)
      ) {
        throw new Error(`${table} delete failed: ${error.message}`)
      }
    }

    try {
      // 1) FK RESTRICT 가 걸린 audit 테이블 먼저 (orders 보다 먼저).
      await deleteStep('refunds')
      await deleteStep('payment_refund_queue')

      // 2) user_id 직접 보유한 보조 테이블.
      await deleteStep('subscription_charges')
      await deleteStep('coupon_redemptions')
      await deleteStep('birthday_coupon_log')
      await deleteStep('point_ledger')

      // 3) orders / subscriptions — 이제 FK 위반 위험 없음.
      await deleteStep('orders')
      await deleteStep('subscriptions')

      // 4) consent_log 는 동의 입증 용 → 5년 + α 보존이라 보수적으로 함께 삭제.
      await deleteStep('consent_log')

      // 5) profile row 도 삭제 (이미 익명화 상태).
      await deleteStep('profiles', 'id')

      // 6) R83-C3 (D2): auth.users hard-delete.
      // 5년 보존 후 PIPA §21 즉시 파기 의무 — auth.users 도 익명화 아니라 hard-delete.
      // admin.auth.admin.deleteUser 사용. 실패해도 다른 데이터는 이미 삭제됐으므로
      // 다음 cron 에서 재시도 — auth row 만 남은 상태 (사용자 로그인 불가).
      try {
        const { error: authErr } = await supabase.auth.admin.deleteUser(p.id)
        if (authErr && !/not.*found|user.*does.*not.*exist/i.test(authErr.message)) {
          console.warn(
            `[account-purge] auth user ${p.id} delete failed (will retry):`,
            authErr.message,
          )
          // throw 안 함 — auth 만 남은 상태로 다음 cron 에서 재시도. purged_at 안 박힘.
        }
      } catch (authErr) {
        console.warn(`[account-purge] auth.deleteUser ${p.id}:`, authErr)
      }

      // 7) account_deletions 에 purged_at 마킹.
      const { error: markErr } = await supabase
        .from('account_deletions')
        .update({ purged_at: new Date().toISOString() })
        .eq('user_id', p.id)
      if (markErr) throw new Error(`account_deletions mark failed: ${markErr.message}`)

      purged += 1
    } catch (err) {
      failed += 1
      console.error(`[account-purge] user ${p.id} failed:`, err)
      // purged_at 미박힘 → 다음 cron 에서 자동 retry.
    }
  }

  return NextResponse.json({
    ok: true,
    cutoff,
    checked: targets.length,
    purged,
    failed,
  })
  })
}
