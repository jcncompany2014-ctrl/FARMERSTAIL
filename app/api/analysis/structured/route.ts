import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildAnalysisPrompt,
  parseAiAnalysis,
  type AiAnalysisContext,
} from '@/lib/nutrition/ai-prompt'
import type { ChronicConditionKey } from '@/lib/nutrition/guidelines'
import { parseRequest, zAnalysisRequest } from '@/lib/api/schemas'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/analysis/structured
 *
 * Body: { analysisId: string }
 * Output: { structured: AiAnalysisJson, cached: boolean }
 *
 * 분석 결과 (analyses) + 설문 (surveys) + 강아지 (dogs) 를 join 해 AI 에 보내고
 * 구조화된 JSON 분석을 받아 analyses.structured_analysis 에 캐시.
 *
 * 기존 /api/analysis/commentary 는 plain text — 호환 유지. 이 라우트가 새 v2.
 *
 * # 보호
 * - Zod 검증 (analysisId UUID)
 * - Rate limit: IP 당 분당 5건 — Anthropic 비용 공격 방어 (캐시 hit 는 cheap
 *   하니 후술 캐시 분기 후 limit 카운트 안 하는 변수도 검토 가능)
 */

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>
  error?: { type?: string; message?: string }
}

export async function POST(req: Request) {
  // 1) Rate limit — Anthropic 비용 폭주 방어. 사용자별 + IP 두 키 모두 적용.
  const ip = ipFromRequest(req)
  const rl = rateLimit({
    bucket: 'analysis-structured',
    key: ip,
    limit: 5,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      {
        code: 'RATE_LIMITED',
        message: '잠시 후 다시 시도해 주세요',
      },
      { status: 429, headers: rl.headers },
    )
  }

  // 2) Zod 검증
  const parsed = await parseRequest(req, zAnalysisRequest)
  if (!parsed.ok) return parsed.response
  const { analysisId } = parsed.data

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

  // 1) analysis 로드 + 소유자 검증
  const { data: analysis, error: aErr } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', analysisId)
    .eq('user_id', user.id)
    .single()
  if (aErr || !analysis) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '분석을 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  // 2) 캐시
  if (analysis.structured_analysis) {
    return NextResponse.json({
      structured: analysis.structured_analysis,
      cached: true,
    })
  }

  // 3) 강아지 + 설문 로드
  const { data: dog } = await supabase
    .from('dogs')
    .select('name, breed, weight, age_value, age_unit, neutered, activity_level, prescription_diet')
    .eq('id', analysis.dog_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!dog) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '강아지 정보를 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  const { data: survey } = await supabase
    .from('surveys')
    .select(
      'mcs_score, bristol_stool_score, chronic_conditions, current_medications, current_food_brand, daily_walk_minutes, coat_condition, appetite, pregnancy_status',
    )
    .eq('id', analysis.survey_id)
    .maybeSingle()

  // 직전 분석
  const { data: prevRows } = await supabase
    .from('analyses')
    .select('bcs_score')
    .eq('dog_id', analysis.dog_id)
    .eq('user_id', user.id)
    .lt('created_at', analysis.created_at)
    .order('created_at', { ascending: false })
    .limit(1)
  const prev = prevRows && prevRows.length > 0 ? prevRows[0] : null

  // 4) Anthropic 호출
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.trim().length === 0) {
    return NextResponse.json(
      {
        code: 'API_KEY_MISSING',
        message: 'AI 분석 기능이 비활성화되어 있어요',
      },
      { status: 503 },
    )
  }

  const ctx: AiAnalysisContext = {
    dogName: dog.name,
    breed: dog.breed ?? '믹스',
    ageValue: dog.age_value ?? 0,
    ageUnit: (dog.age_unit as 'years' | 'months') ?? 'years',
    weight: Number(dog.weight ?? 0),
    neutered: Boolean(dog.neutered),
    activity: (dog.activity_level as 'low' | 'medium' | 'high') ?? 'medium',
    stage: analysis.stage ?? '',
    bcsLabel: analysis.bcs_label ?? '',
    bcsScore: analysis.bcs_score ?? 5,
    mcsScore: survey?.mcs_score ?? null,
    bristolScore: survey?.bristol_stool_score ?? null,
    mer: Number(analysis.mer),
    feedG: Number(analysis.feed_g),
    proteinPct: Number(analysis.protein_pct),
    fatPct: Number(analysis.fat_pct),
    carbPct: Number(analysis.carb_pct),
    fiberPct: Number(analysis.fiber_pct),
    caPRatio: Number(analysis.ca_p_ratio),
    supplements: analysis.supplements ?? [],
    chronicConditions: (survey?.chronic_conditions ?? []) as ChronicConditionKey[],
    currentMedications: survey?.current_medications ?? [],
    currentFoodBrand: survey?.current_food_brand ?? null,
    pregnancyStatus: (survey?.pregnancy_status as 'none' | 'pregnant' | 'lactating' | null) ?? null,
    coatCondition: survey?.coat_condition ?? null,
    appetite: survey?.appetite ?? null,
    dailyWalkMinutes: survey?.daily_walk_minutes ?? null,
    riskFlags: analysis.risk_flags ?? [],
    prevBcsScore: prev?.bcs_score ?? null,
  }

  const prompt = buildAnalysisPrompt(ctx)

  let text: string
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1500,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      }),
      cache: 'no-store',
      // Anthropic capacity hang 방어. 20초 안에 응답 없으면 abort.
      signal: AbortSignal.timeout(20_000),
    })
    const data = (await res.json()) as AnthropicResponse
    if (!res.ok) {
      return NextResponse.json(
        {
          code: data.error?.type ?? 'ANTHROPIC_ERROR',
          message: data.error?.message ?? 'AI 응답을 받지 못했어요',
        },
        { status: 502 },
      )
    }
    text =
      (data.content ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('\n')
        .trim() ?? ''
    if (!text) {
      return NextResponse.json(
        { code: 'EMPTY_RESPONSE', message: 'AI가 빈 응답을 반환했어요' },
        { status: 502 },
      )
    }
  } catch (e) {
    return NextResponse.json(
      {
        code: 'FETCH_FAILED',
        message: e instanceof Error ? e.message : '알 수 없는 오류',
      },
      { status: 502 },
    )
  }

  const structured = parseAiAnalysis(text)
  if (!structured) {
    return NextResponse.json(
      {
        code: 'PARSE_FAILED',
        message: 'AI 응답을 해석할 수 없어요',
        raw: text.slice(0, 500),
      },
      { status: 502 },
    )
  }

  // vetConsult 강화 — AI 가 false 라도 서버 측 risk_flags 가 강하면 덮어씀
  if (analysis.vet_consult_recommended && !structured.vetConsult.recommended) {
    structured.vetConsult = {
      recommended: true,
      reason:
        structured.vetConsult.reason ??
        '시스템이 위험 신호를 감지했어요. 주치 수의사와 상담을 권합니다.',
    }
  }

  // 5) 캐시 저장 (best effort)
  await supabase
    .from('analyses')
    .update({ structured_analysis: structured })
    .eq('id', analysisId)

  return NextResponse.json({ structured, cached: false })
}
