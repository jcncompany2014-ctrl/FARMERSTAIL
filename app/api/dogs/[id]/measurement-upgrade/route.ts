import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseRequest } from '@/lib/api/parseRequest'
import { dbError } from '@/lib/api/errors'
import {
  UPGRADE_REWARD_AMOUNT,
  isUpgrade,
  makeReferenceId,
  rewardReason,
  type MethodKind,
} from '@/lib/rewards/measurement-upgrade'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/dogs/[id]/measurement-upgrade
 *
 * 입력: { kind: 'weight'|'activity'|'feed', prev, next }
 * 동작: isUpgrade 확인 → apply_point_delta RPC 로 1,000P 적립.
 *      멱등 — partial unique index (user_id, reference_type, reference_id)
 *      가 같은 dog 의 같은 kind 재적립 차단.
 *
 * 응답: { ok, balanceAfter?, reason }
 */

const zUpgrade = z.object({
  kind: z.enum(['weight', 'activity', 'feed']),
  prev: z.string().max(40).nullable().optional(),
  next: z.string().min(1).max(40),
})

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const { id: dogId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
      { status: 401 },
    )
  }

  const parsed = await parseRequest(req, zUpgrade)
  if (!parsed.ok) return parsed.response
  const { kind, prev, next } = parsed.data

  // dog 소유 검증
  const { data: dog } = await supabase
    .from('dogs')
    .select('id')
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!dog) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '강아지를 찾을 수 없어요' },
      { status: 404 },
    )
  }

  if (!isUpgrade(kind as MethodKind, prev, next)) {
    return NextResponse.json({
      ok: false,
      reason: 'NOT_UPGRADE',
      message: '보상 대상이 아니에요',
    })
  }

  const { data, error } = await supabase.rpc('apply_point_delta', {
    p_user_id: user.id,
    p_delta: UPGRADE_REWARD_AMOUNT,
    p_reason: rewardReason(kind as MethodKind),
    p_reference_type: 'measurement_upgrade',
    p_reference_id: makeReferenceId(dogId, kind as MethodKind),
  })
  if (error) {
    return dbError(error, 'measurement_upgrade', '측정 도구 업그레이드 처리에 실패했어요')
  }
  type Row = { ok: boolean; balance_after: number; message: string }
  const row = (Array.isArray(data) ? data[0] : data) as Row | null
  if (!row || !row.ok) {
    return NextResponse.json({
      ok: false,
      reason: 'RPC_FAIL',
      message: row?.message ?? '적립 실패',
    })
  }
  if (row.message === 'already_applied') {
    return NextResponse.json({
      ok: false,
      reason: 'ALREADY_APPLIED',
      message: '이미 받은 보상이에요',
      balanceAfter: row.balance_after,
    })
  }
  return NextResponse.json({
    ok: true,
    amount: UPGRADE_REWARD_AMOUNT,
    balanceAfter: row.balance_after,
  })
}
