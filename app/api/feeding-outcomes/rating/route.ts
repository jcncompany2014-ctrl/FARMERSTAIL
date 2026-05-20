import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { recordOutcome } from '@/lib/feeding-outcomes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/feeding-outcomes/rating
 *
 * Phase 4 (2026-05-20): 박스 별점 1문항. 자발 입력, 50P 적립.
 *
 * # 흐름
 *  - 정기구독 N번째 박스 도착 후 푸시 → 별점 1문항 → 50P
 *  - 멱등: 같은 (dog_id, order_id) 한 번만 적립
 */

const zRating = z.object({
  dogId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  subscriptionId: z.string().uuid().optional(),
  ratingStars: z.number().int().min(1).max(5),
  skuCode: z.string().max(20).optional(),
  comment: z.string().max(300).optional(),
})

export async function POST(req: Request) {
  // Rate limit — 분당 10회 (정상 흐름 1팩 1별점)
  const rl = rateLimit({
    bucket: 'feeding-rating',
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

  const parsed = await parseRequest(req, zRating)
  if (!parsed.ok) return parsed.response
  const { dogId, orderId, subscriptionId, ratingStars, skuCode, comment } = parsed.data

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

  // dog 소유 확인
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

  // outcome 기록
  const result = await recordOutcome(supabase, {
    dog_id: dogId,
    user_id: user.id,
    source: 'box_rating',
    rating_stars: ratingStars,
    sku_code: skuCode ?? null,
    comment: comment ?? null,
    order_id: orderId ?? null,
    subscription_id: subscriptionId ?? null,
  })

  if (!result.ok) {
    return NextResponse.json(
      { code: 'INSERT_FAILED', message: result.reason },
      { status: 500 },
    )
  }

  // 50P 적립 — reference_id 에 order_id (또는 subscription:N) 사용 → 멱등
  const refId = orderId
    ? `box_rating:${orderId}`
    : subscriptionId
      ? `box_rating:sub:${subscriptionId}`
      : `box_rating:${dogId}:${Date.now()}`

  try {
    await supabase.rpc('apply_point_delta', {
      p_user_id: user.id,
      p_delta: 50,
      p_reason: '박스 별점 응원 포인트',
      p_reference_type: 'survey_completion',
      p_reference_id: refId,
    })
  } catch {
    /* 적립 실패는 silent — outcome 기록 자체가 성공 */
  }

  return NextResponse.json({ ok: true, points: 50 })
}
