import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseRequest } from '@/lib/api/parseRequest'
import { dbError } from '@/lib/api/errors'
import {
  upgradeTier,
  rewardAmount,
  makeReferenceId,
  rewardReason,
  type MethodKind,
} from '@/lib/rewards/measurement-upgrade'
import { capAllowance, annualCapFor } from '@/lib/rewards/cap'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/dogs/[id]/measurement-upgrade
 *
 * 입력: { kind: 'weight'|'activity'|'feed', prev, next }
 * 동작:
 *   1. upgradeTier 로 LOW→MID(500P) / MID→HIGH(500P) / LOW→HIGH(1000P) 판정
 *   2. 연 cap (3,000P) 검사 — 잔여분만 부분 적립
 *   3. service-role 로 ledger 기록 (멱등성 partial unique index)
 *
 * 변경 이력:
 *   - audit #25 의 partial reward (UPGRADE_REWARD_PARTIAL=500P) 가 dead code 였음
 *     → 본 라우트에서 사용하도록 통합 (1-4 부정 적립 차단 보조).
 *   - audit 1-4: 강아지 N마리 등록 시 N×3,000P 무한 적립 → 연 3,000P cap.
 */

const zUpgrade = z.object({
  kind: z.enum(['weight', 'activity', 'feed']),
  prev: z.string().max(40).nullable().optional(),
  next: z.string().min(1).max(40),
})

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  // Rate limit — IP 분당 30회. 정상 흐름은 1콜.
  const rl = rateLimit({
    bucket: 'rewards-measurement',
    key: ipFromRequest(req),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rl.headers },
    )
  }

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

  const tier = upgradeTier(kind as MethodKind, prev, next)
  const baseReward = rewardAmount(tier)
  if (baseReward === 0) {
    return NextResponse.json({
      ok: false,
      reason: 'NOT_UPGRADE',
      message: '보상 대상이 아니에요',
    })
  }

  // 연 cap 검사 — service-role 클라이언트로 ledger 합산.
  const admin = createAdminClient()
  const allowed = await capAllowance(
    admin,
    user.id,
    'measurement_upgrade',
    baseReward,
  )

  if (allowed === 0) {
    return NextResponse.json({
      ok: true,
      amount: 0,
      capped: true,
      annualCap: annualCapFor('measurement_upgrade'),
      message:
        '올해 측정 도구 업그레이드 응원 한도(' +
        annualCapFor('measurement_upgrade').toLocaleString() +
        'P) 에 도달했어요.',
    })
  }

  const { data, error } = await admin.rpc('apply_point_delta', {
    p_user_id: user.id,
    p_delta: allowed,
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
    amount: allowed,
    tier,
    capped: allowed < baseReward,
    balanceAfter: row.balance_after,
  })
}
