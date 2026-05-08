import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/blog/draft — admin 이 키워드/주제 입력하면 AI 가 블로그
 * 글 초안 (title / excerpt / body) 생성.
 *
 * Anthropic Claude Haiku 호출. body 는 markdown.
 * Body: { topic: string, audience?: string, length?: 'short'|'medium'|'long' }
 *
 * 가드:
 *  - admin 만
 *  - rate limit 5/min/IP (Haiku 비용 보호)
 *  - topic 100자, audience 100자
 *  - response 검증 — title 누락 시 502
 */

const zDraft = z.object({
  topic: z.string().trim().min(2).max(100),
  audience: z.string().trim().max(100).optional(),
  length: z.enum(['short', 'medium', 'long']).optional().default('medium'),
})

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>
  error?: { type?: string; message?: string }
}

const LENGTH_HINTS = {
  short: '600~900자',
  medium: '1200~1800자',
  long: '2000~3000자',
} as const

export async function POST(req: Request) {
  const rl = rateLimit({
    bucket: 'blog-draft',
    key: ipFromRequest(req),
    limit: 5,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: rl.headers },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!(await isAdmin(supabase, user))) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const parsed = await parseRequest(req, zDraft)
  if (!parsed.ok) return parsed.response

  const { topic, audience, length } = parsed.data

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'AI_NOT_CONFIGURED' },
      { status: 503 },
    )
  }

  const systemPrompt = `당신은 파머스테일 (Farmer's Tail) — 수의영양학 기반 프리미엄
반려견 식단 D2C 브랜드의 콘텐츠 에디터예요. 한국어 매거진 톤으로 글을 써요.

# 출력 형식 (반드시 JSON, 다른 텍스트 없이)
{
  "title": "60자 이하 헤드라인",
  "excerpt": "120자 이하 요약 — 검색결과·공유카드용",
  "body": "본문 (markdown, ${LENGTH_HINTS[length]})",
  "tags": ["태그1", "태그2"]
}

# 톤 & 매너
- 보호자에게 친근하게 ("~예요 / ~해요" 어미)
- 과장된 마케팅 표현 금지 — "최고의" "유일한" 같은 superlative ❌
- "수의사 진료를 대체하지 않아요" 가 식이/건강 주제면 본문에 명시
- 위험한 식품 (초콜릿/양파/포도 등) 은 단호하게 금지
- NRC 2006 / FEDIAF / WSAVA 가이드라인 기반
- 수치는 단위 명시 (g, kcal, %)

# body 구성
- ## 으로 섹션 2~4개
- 각 섹션 2~4 문단
- 마지막 "한 줄 요약" 섹션 — 보호자가 기억할 핵심 1줄
${audience ? `\n# 타겟 독자\n${audience}` : ''}`

  const userPrompt = `주제: "${topic}"

위 주제로 블로그 글 초안 생성해 주세요. ${LENGTH_HINTS[length]} 길이 본문.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2400,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: AbortSignal.timeout(45_000),
    })

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as AnthropicResponse
      return NextResponse.json(
        {
          ok: false,
          error: err.error?.type ?? 'AI_ERROR',
          message: err.error?.message ?? 'AI 응답 실패',
        },
        { status: 502 },
      )
    }

    const data = (await res.json()) as AnthropicResponse
    const text =
      data.content?.find((c) => c.type === 'text')?.text?.trim() ?? ''
    if (!text) {
      return NextResponse.json(
        { ok: false, error: 'EMPTY_REPLY' },
        { status: 502 },
      )
    }

    // JSON parse — Haiku 가 가끔 ```json wrapper 붙이는 경우 strip.
    let jsonText = text
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (fenceMatch) jsonText = fenceMatch[1]

    let draft: {
      title?: string
      excerpt?: string
      body?: string
      tags?: string[]
    }
    try {
      draft = JSON.parse(jsonText)
    } catch {
      return NextResponse.json(
        { ok: false, error: 'INVALID_JSON', raw: text.slice(0, 500) },
        { status: 502 },
      )
    }

    if (!draft.title || !draft.body) {
      return NextResponse.json(
        { ok: false, error: 'MISSING_FIELDS' },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      draft: {
        title: draft.title,
        excerpt: draft.excerpt ?? '',
        body: draft.body,
        tags: Array.isArray(draft.tags) ? draft.tags : [],
      },
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'unknown',
      },
      { status: 502 },
    )
  }
}
