import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/subscription-cleanup
 *
 * 매일 1회 실행 — billing_key 미등록 (NULL) + 7일 이상 경과한 subscriptions
 * 를 자동 'cancelled' 로 전환. 사용자가 정기배송 신청 후 카드 등록 페이지에서
 * 이탈한 abandoned 구독 정리.
 *
 * # 배경
 *  /dogs/[id]/order 에서 신청 시 subscriptions row 가 먼저 생성되고, 그 다음
 *  Toss billing-auth 페이지로 redirect 된다. 사용자가 카드 등록 안 하고 닫으면
 *  billing_key NULL 상태로 남음. cron 청구는 알아서 skip 하지만:
 *   - 마이페이지에 "카드 등록 필요" 카드 영원히 노출 (사용자 혼란)
 *   - 같은 강아지에 새 구독 신청 시 "중복" 차단 (audit fix 22)
 *   - admin 통계 노이즈
 *
 * # 정책
 *  · billing_key IS NULL AND created_at < now() - 7d → status='cancelled'
 *  · 사용자가 7일 안에 카드 등록 시도 안 했으면 의도적 abandon 으로 간주.
 *  · 카드 등록은 "다시 시작" 으로 새 구독 신청 가능 (마이페이지 가이드).
 *
 * # 보안
 *  · CRON_SECRET 검증 (timing-safe).
 *  · admin client (service_role) — RLS bypass.
 *
 * # 일정
 *  매일 03:30 KST. subscription-charge (04:00) 보다 먼저 실행.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }
  // R83-E3 (D3): trackCron 으로 wrap — cron_health 기록 + 실패 시 Sentry alert.
  return trackCron('subscription-cleanup', async () => {
    const supabase = createAdminClient()
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString()

  // billing_key NULL + 7일+ + active 상태인 row 만 정리. paused/cancelled
  // 는 손대지 않음 (사용자/운영자가 의도적으로 일시정지/해지 처리한 상태).
  const { data: targets, error: fetchErr } = await supabase
    .from('subscriptions')
    .select('id, user_id, dog_id, created_at')
    .is('billing_key', null)
    .eq('status', 'active')
    .lt('created_at', sevenDaysAgo)
    .limit(200)

  if (fetchErr) {
    return NextResponse.json(
      { ok: false, error: fetchErr.message },
      { status: 500 },
    )
  }

  const rows = (targets ?? []) as Array<{
    id: string
    user_id: string
    dog_id: string | null
    created_at: string
  }>

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, cleaned: 0 })
  }

  const ids = rows.map((r) => r.id)
  const nowIso = new Date().toISOString()

  // R84-D5: next_delivery_date 는 NOT NULL 제약. 이전 코드는 null 박아서 update
  // 자체가 fail → cron 실패. status='cancelled' 만 set 하면 cron loop 가 그 row
  // 를 skip 하므로 next_delivery_date 는 그대로 둬도 부하 영향 없음.
  const { error: upErr } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      last_failed_charge_reason: 'abandoned-billing-not-registered-7d',
      cancelled_at: nowIso,
    })
    .in('id', ids)

  if (upErr) {
    return NextResponse.json(
      { ok: false, error: upErr.message },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    cleaned: rows.length,
    cleanedAt: nowIso,
  })
  })
}
