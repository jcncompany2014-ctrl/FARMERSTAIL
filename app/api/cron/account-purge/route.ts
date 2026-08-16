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
 * # 보안 · 실행 시각
 * Bearer CRON_SECRET.
 * 실제 스케줄: `"0 16 1 * *"` = **매월 1일 UTC 16:00 = KST 01:00**
 * (2026-07-31 정정 — "KST 04:00 (UTC 19:00) 권장" 이라고 적혀 있었으나 둘 다
 *  실제와 다르다. vercel.json 이 정본이다.)
 * 새벽 시각이어도 문제없다: 이 크론은 **알림을 보내지 않는다**(조용시간 규칙9
 * 대상 아님). 파기는 되돌릴 수 없는 작업이라 트래픽이 가장 적은 때가 낫다.
 *
 * # 잔여
 * - product_qna 는 다른 사용자에게 보이는 콘텐츠 + 익명화 표시 가능.
 *   → 보존. 명시적 삭제 요청 시 별도 처리.
 *   (reviews 는 2026-07-16 리뷰 시스템 폐기로 **테이블 자체가 없다** — 목록에서
 *    뺐다. `deleteStep` 이 "relation does not exist" 를 견디므로 남아 있어도
 *    터지진 않았지만, 없는 것을 "보존한다" 고 적어 두면 다음 사람이 찾는다.)
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
    /**
     * ★테이블별 deleteStep → 단일 RPC `purge_user` (2026-08-17 4라운드 감사 #21).
     *
     * 예전 방식은 **구조적으로 절대 성공할 수 없었다**:
     *  · point_ledger 는 no_delete/no_update 트리거가 무조건 RAISE (insert-only
     *    원장, 20260526103123) — 행이 있는 사용자는 여기서 영구 실패.
     *  · payment_events 는 같은 불변 트리거 + orders 로 FK RESTRICT — 결제한 적
     *    있는 계정의 orders 는 어떤 순서로도 삭제 불가.
     *  · 덤: payment_refund_queue 엔 user_id 컬럼 자체가 없어(order_id 뿐)
     *    deleteStep('payment_refund_queue') 는 42703 로 죽는 코드였다 —
     *    롤백 트랜잭션 카나리아가 잡아냈다.
     * deleteStep 의 예외 통과는 "does not exist" 뿐이라 전부 catch → failed →
     * 영원한 재시도 루프가 됐을 것이다(최초 발화 ≈2031, 아직 대상 0).
     *
     * purge_user(SECURITY DEFINER, service_role 전용)는 파기 전체를 **한
     * 트랜잭션**으로 하고, 불변 트리거는 함수 안에서만 내렸다 되살린다.
     * 컷오프(1825일)는 함수가 스스로 재검증한다 — 호출자 인자를 믿지 않는다.
     * 검산(2026-08-17, 롤백 트랜잭션): 합성 결제 계정 풀그래프 생성 → 보관
     * 기간 중 호출은 거부 → 5년 경과 호출은 orders·payment_events·
     * point_ledger·profiles 전부 삭제 → 불변 트리거 원복 확인.
     */
    try {
      const { error: rpcErr } = await supabase.rpc('purge_user', {
        p_user: p.id,
      })
      if (rpcErr) throw new Error(`purge_user rpc failed: ${rpcErr.message}`)

      // R83-C3 (D2): auth.users hard-delete.
      // 5년 보존 후 PIPA §21 즉시 파기 의무 — auth.users 도 익명화 아니라 hard-delete.
      // 실패해도 다른 데이터는 이미 삭제됐으므로 다음 cron 에서 재시도.
      // (RPC 가 profiles 를 지웠으므로 다음 실행의 대상 조회에는 안 잡힌다 —
      //  auth 잔재는 로그인 불가 상태의 빈 껍데기라 개인정보 위험이 없다.)
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
