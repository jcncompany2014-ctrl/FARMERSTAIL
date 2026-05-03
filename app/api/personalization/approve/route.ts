import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/personalization/approve
 *
 * 보호자가 cron 이 만든 pending_approval formula 에 응답. push/email 의 deep
 * link 가 이 화면으로 데려옴.
 *
 *  - approve: status=approved, approved_at=now, applied_from=오늘, applied_until=+28일
 *  - decline: status=declined. 이전 cycle 의 applied_until 을 +28일 연장 (현행 유지).
 *
 * 만 5일 응답 없으면 별도 cron 이 declined 로 timeout.
 */

const zApprove = z.object({
  dogId: z.string().uuid(),
  cycleNumber: z.number().int().min(1).max(120),
  decision: z.enum(['approve', 'decline']),
})

export async function POST(req: Request) {
  const rl = rateLimit({
    bucket: 'personalization-approve',
    key: ipFromRequest(req),
    limit: 10,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rl.headers },
    )
  }

  const parsed = await parseRequest(req, zApprove)
  if (!parsed.ok) return parsed.response
  const { dogId, cycleNumber, decision } = parsed.data

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

  // pending formula 확인.
  const { data: pending, error: fetchErr } = await supabase
    .from('dog_formulas')
    .select('id, approval_status')
    .eq('dog_id', dogId)
    .eq('user_id', user.id)
    .eq('cycle_number', cycleNumber)
    .maybeSingle()
  if (fetchErr || !pending) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '해당 cycle 처방을 찾을 수 없어요' },
      { status: 404 },
    )
  }

  const status = (pending as { approval_status: string }).approval_status
  if (status !== 'pending_approval') {
    return NextResponse.json(
      {
        code: 'NOT_PENDING',
        message: `이미 ${status} 상태입니다`,
      },
      { status: 409 },
    )
  }

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const plus28 = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  if (decision === 'approve') {
    const { error } = await supabase
      .from('dog_formulas')
      .update({
        approval_status: 'approved',
        approved_at: now.toISOString(),
        applied_from: today,
        applied_until: plus28,
      })
      .eq('id', (pending as { id: string }).id)

    if (error) {
      return NextResponse.json(
        { code: 'DB_ERROR', message: error.message },
        { status: 500 },
      )
    }
    return NextResponse.json({ ok: true, decision: 'approved' })
  }

  // decline — 이전 cycle 처방의 applied_until 을 +28일 연장.
  const { error: declineErr } = await supabase
    .from('dog_formulas')
    .update({
      approval_status: 'declined',
      approved_at: null,
    })
    .eq('id', (pending as { id: string }).id)
  if (declineErr) {
    return NextResponse.json(
      { code: 'DB_ERROR', message: declineErr.message },
      { status: 500 },
    )
  }

  // 이전 cycle (cycleNumber - 1) 의 applied_until 연장.
  if (cycleNumber > 1) {
    const { data: prev } = await supabase
      .from('dog_formulas')
      .select('id, applied_until')
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      .eq('cycle_number', cycleNumber - 1)
      .maybeSingle()
    if (prev) {
      const prevUntil =
        (prev as { applied_until: string | null }).applied_until ?? today
      const extended = new Date(
        new Date(prevUntil).getTime() + 28 * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .slice(0, 10)
      await supabase
        .from('dog_formulas')
        .update({ applied_until: extended })
        .eq('id', (prev as { id: string }).id)
    }
  }

  return NextResponse.json({ ok: true, decision: 'declined' })
}
