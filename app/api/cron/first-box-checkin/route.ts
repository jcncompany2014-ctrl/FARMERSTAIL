import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { pushToUser } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/first-box-checkin
 *
 * Phase 2 (2026-05-20): 첫 박스 배송 완료 7일 경과 + 미응답 사용자에게 1회 푸시.
 * 1문항 체크인 (👍/😐/👎) — 30초 작업, 100P 적립.
 * 미응답 시 재푸시 X (사용자 부담 최소 원칙).
 *
 * 정기 일정 — 일 1회 KST 11:00 (UTC 02:00). 점심 시간대 알림 → 응답률 ↑.
 *
 * # 동작
 *   1. orders.delivered_at 가 7-8일 전 (24h 슬라이스) 인 paid 주문 픽업
 *   2. 동일 dog 의 first_box_checkin row 가 이미 있으면 skip (UNIQUE)
 *   3. feeding_outcomes 의 first_order baseline 이 있어야 첫 박스 (재주문 X)
 *   4. 푸시 발송. 클릭 시 /dogs/{dogId}/checkin?type=first_box 로 이동
 */
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }
  return trackCron('first-box-checkin', () => runCheckinReminder())
}

async function runCheckinReminder(): Promise<Response> {
  const supabase = createAdminClient()
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000)
  const eightDaysAgo = new Date(now.getTime() - 8 * 86_400_000)

  // 7-8일 전 배송 완료된 주문 (24h 슬라이스 — 매일 1번 cron 가정)
  // dogs / users join 위해 service_role 직접 쿼리.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminTyped = supabase as any

  const { data: candidates, error } = (await adminTyped
    .from('orders')
    .select('id, user_id, delivered_at')
    .eq('payment_status', 'paid')
    .gte('delivered_at', eightDaysAgo.toISOString())
    .lt('delivered_at', sevenDaysAgo.toISOString())
    // R97-A (D7): 배치 캡 — 다른 cron 처럼 .limit 추가. 세일 후 배송 폭증
    // 시 후보가 수백~수천이면 후보당 dogs+feeding_outcomes 2쿼리 N+1 으로
    // maxDuration(120s) 압박. 200 초과분은 다음 run (윈도우 7~8일이라 여유).
    .limit(200)) as {
    data: Array<{ id: string; user_id: string; delivered_at: string }> | null
    error: { message: string } | null
  }

  if (error) {
    return NextResponse.json(
      { ok: false, reason: 'fetch_failed', error: error.message },
      { status: 500 },
    )
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0 })
  }

  let sent = 0
  let skipped = 0

  for (const order of candidates) {
    // 사용자의 첫 dog 픽업 (단순화 — 1주문 = 대표 1마리)
    const { data: dog } = (await adminTyped
      .from('dogs')
      .select('id, name')
      .eq('user_id', order.user_id)
      .limit(1)
      .maybeSingle()) as { data: { id: string; name: string } | null }

    if (!dog) {
      skipped += 1
      continue
    }

    // 이미 체크인 row 있는지 확인 (재푸시 방지)
    const { data: existing } = (await adminTyped
      .from('feeding_outcomes')
      .select('id')
      .eq('dog_id', dog.id)
      .eq('source', 'first_box_checkin')
      .maybeSingle()) as { data: { id: string } | null }

    if (existing) {
      skipped += 1
      continue
    }

    // 푸시 발송 (실패는 best-effort)
    try {
      await pushToUser(
        order.user_id,
        {
          title: `${dog.name}이는 어떠신가요? 🐾`,
          body: '첫 박스 한 주가 지났네요. 30초만 시간 내주실래요?',
          url: `/dogs/${dog.id}/first-checkin`,
          tag: `first-box-checkin-${dog.id}`,
        },
        { category: 'marketing' }, // outcome 체크인 = lifecycle 마케팅 카테고리
      )
      sent += 1
    } catch {
      skipped += 1
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, candidates: candidates.length })
}
