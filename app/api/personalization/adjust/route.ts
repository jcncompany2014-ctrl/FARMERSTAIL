import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { zPersonalizationAdjust } from '@/lib/api/schemas'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { FOOD_LINE_META, ALL_LINES } from '@/lib/personalization/lines'
import type { Reasoning } from '@/lib/personalization/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/personalization/adjust
 *
 * 사용자가 추천 비율을 직접 수정한 결과를 dog_formulas 에 저장. user_adjusted
 * = true 로 마킹 + reasoning 에 "사용자 조정" 항목 추가.
 *
 * # 검증
 *  - lineRatios 합 = 1.0 (오차 0.001 허용)
 *  - 알레르기 차단된 라인은 0% 강제 — 사용자가 슬라이더 풀어도 서버가 거부
 *  - 토퍼 합 ≤ 0.3 (Zod 가 1차, 라우트가 2차)
 *
 * # 보안
 *  - 본인 강아지 + cycle 검증
 *  - rate limit 분당 30 (사용자가 슬라이더 여러 번 만질 수 있음)
 */
export async function POST(req: Request) {
  const rl = rateLimit({
    bucket: 'personalization-adjust',
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

  const parsed = await parseRequest(req, zPersonalizationAdjust)
  if (!parsed.ok) return parsed.response
  const data = parsed.data

  // 합 1.0 검증.
  const total = ALL_LINES.reduce((s, l) => s + data.lineRatios[l], 0)
  if (Math.abs(total - 1) > 0.001) {
    return NextResponse.json(
      {
        code: 'INVALID_RATIO_SUM',
        message: `라인 비율 합이 1.0 이어야 해요 (현재 ${total.toFixed(2)})`,
      },
      { status: 400 },
    )
  }

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

  // 기존 formula 조회 — 알레르기 검증 + reasoning 누적.
  const { data: existing, error: fetchErr } = await supabase
    .from('dog_formulas')
    .select('id, formula, reasoning, daily_kcal, daily_grams')
    .eq('dog_id', data.dogId)
    .eq('user_id', user.id)
    .eq('cycle_number', data.cycleNumber)
    .maybeSingle()
  if (fetchErr || !existing) {
    return NextResponse.json(
      {
        code: 'CYCLE_NOT_FOUND',
        message: '해당 cycle 의 처방을 찾을 수 없어요',
      },
      { status: 404 },
    )
  }

  // 알레르기 차단 검증 — 최신 surveys 의 알레르기 조회.
  const { data: latestSurvey } = await supabase
    .from('surveys')
    .select('answers')
    .eq('dog_id', data.dogId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const allergies = Array.isArray(
    (latestSurvey?.answers as { allergies?: unknown })?.allergies,
  )
    ? ((latestSurvey?.answers as { allergies: string[] }).allergies as string[])
    : []

  for (const line of ALL_LINES) {
    const meta = FOOD_LINE_META[line]
    const conflict = meta.blockingAllergies.find((a) => allergies.includes(a))
    if (conflict && data.lineRatios[line] > 0) {
      return NextResponse.json(
        {
          code: 'ALLERGY_BLOCKED',
          message: `${meta.name} 라인은 ${conflict} 알레르기로 사용할 수 없어요`,
        },
        { status: 400 },
      )
    }
  }

  // 0.1 단위 quantize 검증 — 사용자 UI 가 슬라이더 step=0.1 이라 가정.
  // 살짝 어긋나면 round 해서 저장 (사용자에게 보이는 값과 DB 일치).
  const quantized = ALL_LINES.reduce(
    (acc, l) => {
      acc[l] = Math.round(data.lineRatios[l] * 10) / 10
      return acc
    },
    {} as Record<string, number>,
  )
  const qSum = ALL_LINES.reduce((s, l) => s + quantized[l], 0)
  if (Math.abs(qSum - 1) > 1e-9) {
    // 가장 큰 라인이 잔차 흡수.
    const target = ALL_LINES.reduce((best, l) =>
      quantized[l] > quantized[best] ? l : best,
    )
    quantized[target] = Math.max(
      0,
      Math.round((quantized[target] + (1 - qSum)) * 10) / 10,
    )
  }

  // reasoning 에 "사용자 조정" 추가.
  const existingReasoning = (existing.reasoning as Reasoning[]) ?? []
  const adjustedReasoning: Reasoning[] = [
    ...existingReasoning,
    {
      trigger: '사용자 직접 조정',
      action: `라인 비율 ${ALL_LINES.filter((l) => quantized[l] > 0)
        .map((l) => `${FOOD_LINE_META[l].name} ${Math.round(quantized[l] * 100)}%`)
        .join(' / ')}`,
      chipLabel: '사용자 조정됨',
      priority: 9, // 가장 낮은 우선순위 — 노출은 마지막
      ruleId: 'user-adjusted',
    },
  ]

  const newFormula = {
    lineRatios: quantized,
    toppers: data.toppers ??
      (existing.formula as { toppers: { protein: number; vegetable: number } })
        .toppers,
  }

  const { error: upErr } = await supabase
    .from('dog_formulas')
    .update({
      formula: newFormula,
      reasoning: adjustedReasoning,
      user_adjusted: true,
    })
    .eq('id', existing.id)

  if (upErr) {
    return NextResponse.json(
      { code: 'DB_ERROR', message: upErr.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, lineRatios: quantized })
}
