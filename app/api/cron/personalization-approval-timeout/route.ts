import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/personalization-approval-timeout
 *
 * 매일 1회 실행 — pending_approval 상태이면서 proposed_at 이 5일 이상 지난
 * dog_formulas row 를 자동 'declined' 로 전환. 이전 cycle 의 applied_until
 * 을 +28일 연장 (declined 시 이전 처방 유지).
 *
 * # 흐름
 *  1. pending_approval AND proposed_at < now() - 5d 인 row 조회
 *  2. 각 row 마다:
 *     a. status='declined', approved_at=now()
 *     b. cycle_number-1 의 row 의 applied_until 을 +28d 연장
 *     c. (선택) push 알림 — "이전 비율 유지하기로 결정" — 보호자 confirmation
 *  3. 결과 카운트 반환
 *
 * # 보안
 *  - Vercel cron secret (CRON_SECRET) 검증
 *  - admin client (service_role) 사용 — RLS bypass
 *
 * # 일정
 *  매일 03:00 KST — 다른 cron 과 분산.
 */
export async function GET(req: Request) {
  // Production 에선 CRON_SECRET 강제. dev 는 우회.
  if (process.env.NODE_ENV === 'production') {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  const fiveDaysAgo = new Date(
    Date.now() - 5 * 24 * 60 * 60 * 1000,
  ).toISOString()
  const now = new Date().toISOString()

  type PendingRow = {
    id: string
    dog_id: string
    user_id: string
    cycle_number: number
    proposed_at: string
  }

  const { data: pending, error: pendErr } = await supabase
    .from('dog_formulas')
    .select('id, dog_id, user_id, cycle_number, proposed_at')
    .eq('approval_status', 'pending_approval')
    .lt('proposed_at', fiveDaysAgo)
    .limit(200)

  if (pendErr) {
    console.error('[approval-timeout] fetch failed', pendErr)
    return NextResponse.json(
      { ok: false, error: pendErr.message },
      { status: 500 },
    )
  }

  const rows = (pending ?? []) as unknown as PendingRow[]
  let declined = 0
  let extended = 0
  let failed = 0

  for (const row of rows) {
    try {
      // 1) 본 row 를 declined 로 전환.
      const { error: updErr } = await supabase
        .from('dog_formulas')
        .update({
          approval_status: 'declined',
          approved_at: now,
        })
        .eq('id', row.id)
      if (updErr) throw updErr
      declined += 1

      // 2) 이전 cycle 의 applied_until 을 +28d 연장 (이전 처방 유지).
      if (row.cycle_number > 1) {
        const { data: prev } = await supabase
          .from('dog_formulas')
          .select('id, applied_until')
          .eq('dog_id', row.dog_id)
          .eq('cycle_number', row.cycle_number - 1)
          .maybeSingle()
        const prevTyped = prev as unknown as {
          id: string
          applied_until: string | null
        } | null
        if (prevTyped && prevTyped.applied_until) {
          const newUntil = new Date(prevTyped.applied_until)
          newUntil.setDate(newUntil.getDate() + 28)
          await supabase
            .from('dog_formulas')
            .update({ applied_until: newUntil.toISOString().slice(0, 10) })
            .eq('id', prevTyped.id)
          extended += 1
        }
      }

      // 3) push 알림 — "5일 무응답으로 이전 비율 유지" — 보호자 알림.
      try {
        const { pushToUser } = await import('@/lib/push')
        await pushToUser(
          row.user_id,
          {
            title: '이전 비율 그대로 유지할게요',
            body:
              '5일 동안 응답이 없어 이전 cycle 처방을 그대로 다음 박스에 적용해요. 알림 센터에서 확인.',
            url: `/dogs/${row.dog_id}/formulas`,
          },
          { category: 'order' },
        )
      } catch {
        // push 실패는 cron 흐름에 영향 X.
      }
    } catch (e) {
      console.error('[approval-timeout] row failed', row.id, e)
      failed += 1
    }
  }

  return NextResponse.json({
    ok: true,
    pending: rows.length,
    declined,
    extended,
    failed,
  })
}
