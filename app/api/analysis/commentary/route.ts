import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildCommentaryPrompt, type CommentaryContext } from '@/lib/commentary'
import { parseRequest, zAnalysisRequest } from '@/lib/api/schemas'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>
  error?: { type?: string; message?: string }
}

export async function POST(req: Request) {
  // Rate limit — Anthropic 비용 폭주 방어 (5 req/min/IP)
  const rl = rateLimit({
    bucket: 'analysis-commentary',
    key: ipFromRequest(req),
    limit: 5,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rl.headers },
    )
  }

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
      { status: 401 }
    )
  }

  // 1) 분석 + 개 정보 로드 (소유자 검증)
  const { data: analysis, error: aErr } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', analysisId)
    .eq('user_id', user.id)
    .single()

  if (aErr || !analysis) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '분석을 찾을 수 없습니다' },
      { status: 404 }
    )
  }

  // 2) 이미 생성된 경우 그대로 반환 (멱등)
  if (analysis.commentary && analysis.commentary.trim().length > 0) {
    return NextResponse.json({ commentary: analysis.commentary, cached: true })
  }

  const { data: dog } = await supabase
    .from('dogs')
    .select('name, breed, weight, age_value, age_unit, activity_level')
    .eq('id', analysis.dog_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!dog) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '강아지 정보를 찾을 수 없습니다' },
      { status: 404 }
    )
  }

  // 3) 최근 추이 (직전 분석 대비)
  const { data: prevRows } = await supabase
    .from('analyses')
    .select('bcs_score, rer, created_at')
    .eq('dog_id', analysis.dog_id)
    .eq('user_id', user.id)
    .lt('created_at', analysis.created_at)
    .order('created_at', { ascending: false })
    .limit(1)

  const prev = prevRows && prevRows.length > 0 ? prevRows[0] : null

  // 4) Anthropic API 호출
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.trim().length === 0) {
    return NextResponse.json(
      {
        code: 'API_KEY_MISSING',
        message: 'AI 코멘트 기능이 비활성화되어 있어요',
      },
      { status: 503 }
    )
  }

  const ctx: CommentaryContext = {
    dogName: dog.name,
    breed: dog.breed ?? '믹스',
    ageValue: dog.age_value ?? 0,
    ageUnit: (dog.age_unit as 'years' | 'months') ?? 'years',
    weight: Number(dog.weight ?? 0),
    activity: (dog.activity_level as 'low' | 'medium' | 'high') ?? 'medium',
    stage: analysis.stage ?? '',
    bcsLabel: analysis.bcs_label ?? '',
    bcsScore: analysis.bcs_score ?? 5,
    mer: Number(analysis.mer),
    feedG: Number(analysis.feed_g),
    proteinPct: Number(analysis.protein_pct),
    fatPct: Number(analysis.fat_pct),
    carbPct: Number(analysis.carb_pct),
    fiberPct: Number(analysis.fiber_pct),
    caPRatio: Number(analysis.ca_p_ratio),
    supplements: analysis.supplements ?? [],
    prevBcsScore: prev?.bcs_score ?? null,
  }

  const prompt = buildCommentaryPrompt(ctx)

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
        max_tokens: 400,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      }),
      cache: 'no-store',
      // Anthropic capacity 이슈 시 30초+ hang 가능. Vercel hobby limit (10s)
      // 안에서 실패하도록 20초 timeout — 사용자가 적절한 에러 메시지 받음.
      signal: AbortSignal.timeout(20_000),
    })

    const data = (await res.json()) as AnthropicResponse

    if (!res.ok) {
      return NextResponse.json(
        {
          code: data.error?.type ?? 'ANTHROPIC_ERROR',
          message: data.error?.message ?? 'AI 응답을 받지 못했어요',
        },
        { status: 502 }
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
        { status: 502 }
      )
    }
  } catch (e) {
    return NextResponse.json(
      {
        code: 'FETCH_FAILED',
        message: e instanceof Error ? e.message : '알 수 없는 오류',
      },
      { status: 502 }
    )
  }

  // 5) 저장 (실패해도 생성된 텍스트는 반환 — best effort)
  await supabase
    .from('analyses')
    .update({ commentary: text })
    .eq('id', analysisId)

  return NextResponse.json({ commentary: text, cached: false })
}
