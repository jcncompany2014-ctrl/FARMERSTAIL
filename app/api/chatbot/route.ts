import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/chatbot
 *
 * 식이 / 알러지 간이 상담 — Anthropic API 호출. stateless (history 없음).
 * 사용자 강아지 정보를 컨텍스트로 묶어 짧은 답변.
 *
 * # 입력
 *  { message: string, dogId?: string }
 *
 * # 출력
 *  { reply: string }
 *
 * # 가드
 *  - 인증 필수
 *  - rate limit: 분당 5회 / IP (Anthropic 비용 폭주 방어)
 *  - 메시지 length 500자 제한
 *  - 시스템 프롬프트에 "수의사 진료 대체 X" 명시
 */

const zChatbot = z.object({
  message: z.string().trim().min(1).max(500),
  dogId: z.string().uuid().optional(),
})

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>
  error?: { type?: string; message?: string }
}

export async function POST(req: Request) {
  const rl = rateLimit({
    bucket: 'chatbot',
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

  const parsed = await parseRequest(req, zChatbot)
  if (!parsed.ok) return parsed.response
  const { message, dogId } = parsed.data

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

  // dog 컨텍스트 (있으면) — RLS 가 자동으로 본인 dog 만 select.
  let dogContext = ''
  if (dogId) {
    const { data: dog } = await supabase
      .from('dogs')
      .select('name, breed, age_value, age_unit, weight, gender, neutered, allergies')
      .eq('id', dogId)
      .maybeSingle()
    if (dog) {
      const allergies = Array.isArray(dog.allergies)
        ? (dog.allergies as string[]).join(', ')
        : ''
      dogContext = `
사용자의 강아지 정보:
- 이름: ${dog.name}
- 견종: ${dog.breed ?? '미상'}
- 나이: ${dog.age_value ?? '?'} ${dog.age_unit ?? ''}
- 체중: ${dog.weight ?? '?'} kg
- 성별: ${dog.gender ?? '미상'} ${dog.neutered ? '(중성화 완료)' : ''}
- 알러지: ${allergies || '없음'}
`
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { code: 'NOT_CONFIGURED', message: 'AI 상담이 설정되지 않았어요' },
      { status: 503 },
    )
  }

  const systemPrompt = `당신은 파머스테일 (Farmer's Tail) 의 AI 영양사예요. 한국어로 친근하게,
간결하게 (3-5 문장) 응답해요. 보호자가 강아지 식이 / 알러지 / 영양에 대해
물어보면 NRC 2006 / FEDIAF / WSAVA 가이드라인 기반으로 답해요.

⚠️ 절대 규칙:
- "수의사 진료를 대체하지 않아요" — 의학적 진단 / 처방 / 응급 상황은 수의사
  방문 권유로 마무리.
- 약물 / 보충제 / 특수 처방식 언급 시 반드시 "수의사 상담 후 결정" 명시.
- 위험한 식품 (초콜릿, 양파, 포도 등) 은 단호하게 금지.
- 모르거나 확신 없으면 "수의사 / 동물병원 상담 권장" 으로 마무리.
- 사용자 강아지 정보가 있으면 그에 맞춰 답변.

톤: 따뜻하고 신뢰감 있게. "~예요 / ~해요" 같은 부드러운 어미.
${dogContext}`

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
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as AnthropicResponse
      return NextResponse.json(
        {
          code: err.error?.type ?? 'AI_ERROR',
          message: err.error?.message ?? 'AI 응답 실패',
        },
        { status: 502 },
      )
    }

    const data = (await res.json()) as AnthropicResponse
    const reply =
      data.content?.find((c) => c.type === 'text')?.text?.trim() ?? ''
    if (!reply) {
      return NextResponse.json(
        { code: 'EMPTY_REPLY', message: 'AI 응답이 비어있어요' },
        { status: 502 },
      )
    }

    return NextResponse.json({ reply })
  } catch (err) {
    return NextResponse.json(
      {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'unknown',
      },
      { status: 502 },
    )
  }
}
