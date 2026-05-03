import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { zPersonalizationCheckin } from '@/lib/api/schemas'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/personalization/checkin
 *
 * 보호자가 매 cycle 의 week_2 / week_4 응답 제출. dog_checkins 테이블에
 * upsert (UNIQUE dog_id + cycle_number + checkpoint).
 *
 * 같은 cycle 의 같은 checkpoint 응답을 다시 보내면 update — 보호자가
 * "다시 답하기" 시 중복 row 누적 방지.
 *
 * # 보안
 *  - rate limit 분당 10 (정상 응답은 1회면 충분)
 *  - 본인 강아지만 (dogs.user_id = auth.uid())
 *  - cycle_number 가 dog_formulas 에 실제로 존재하는지 검증 — 임의 cycle
 *    응답 방지
 *
 * # 흐름
 *  1. auth + rate limit
 *  2. 강아지 소유 + cycle 존재 검증
 *  3. dog_checkins upsert (onConflict: dog_id,cycle_number,checkpoint)
 */
export async function POST(req: Request) {
  const rl = rateLimit({
    bucket: 'personalization-checkin',
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

  const parsed = await parseRequest(req, zPersonalizationCheckin)
  if (!parsed.ok) return parsed.response
  const data = parsed.data

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

  // 강아지 소유 + cycle 존재 한 번에 검증.
  const { data: existingFormula, error: fetchErr } = await supabase
    .from('dog_formulas')
    .select('id, dog_id')
    .eq('dog_id', data.dogId)
    .eq('user_id', user.id)
    .eq('cycle_number', data.cycleNumber)
    .maybeSingle()
  if (fetchErr || !existingFormula) {
    return NextResponse.json(
      {
        code: 'CYCLE_NOT_FOUND',
        message: '해당 cycle 의 처방을 찾을 수 없어요',
      },
      { status: 404 },
    )
  }

  // upsert — 같은 (dog, cycle, checkpoint) 면 update.
  const { error: upErr } = await supabase.from('dog_checkins').upsert(
    {
      dog_id: data.dogId,
      user_id: user.id,
      cycle_number: data.cycleNumber,
      checkpoint: data.checkpoint,
      stool_score: data.stoolScore ?? null,
      coat_score: data.coatScore ?? null,
      appetite_score: data.appetiteScore ?? null,
      overall_satisfaction: data.overallSatisfaction ?? null,
      free_text: data.freeText ?? null,
      photo_urls: data.photoUrls ?? [],
      responded_at: new Date().toISOString(),
    },
    { onConflict: 'dog_id,cycle_number,checkpoint' },
  )

  if (upErr) {
    return NextResponse.json(
      { code: 'DB_ERROR', message: upErr.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
