// R17-C30: AI chatbot streaming endpoint.
//
// POST /api/chatbot/stream — POST /api/chatbot 와 동일 body, 다른 response.
//   - non-stream: { reply: string }
//   - stream: text/event-stream — 각 chunk 가 `data: <text>\n\n` SSE 형식
//
// 클라이언트는 fetch + ReadableStream reader 로 incremental 표시.
// history 저장은 stream 종료 시 한 번에.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { parseRequest } from '@/lib/api/parseRequest'
import {
  buildChatbotSystemPrompt,
  CHATBOT_HISTORY_LIMIT,
} from '@/lib/chatbot-system-prompt'

const zChatbot = z.object({
  message: z.string().min(1).max(500),
  dogId: z.string().uuid().optional(),
})

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface AnthropicStreamDelta {
  type: string
  delta?: { type: string; text?: string }
}

export async function POST(req: Request): Promise<Response> {
  // 같은 rate limit bucket — non-stream 과 합쳐서 분당 5건.
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
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
      { status: 401 },
    )
  }

  // dog context (POST 와 동일 패턴)
  let dogContext = ''
  if (dogId) {
    const { data: dog } = await supabase
      .from('dogs')
      .select('name, breed, age_value, age_unit, weight, gender, neutered, allergies')
      .eq('id', dogId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (dog) {
      const allergies = Array.isArray(dog.allergies)
        ? (dog.allergies as string[])
            .map((a) => String(a).replace(/[<>{}]/g, '').slice(0, 80))
            .join(', ')
        : ''
      dogContext = `
<dog_info>
- 이름: ${String(dog.name ?? '').replace(/[<>{}]/g, '').slice(0, 50)}
- 견종: ${String(dog.breed ?? '미상').replace(/[<>{}]/g, '').slice(0, 50)}
- 나이: ${dog.age_value ?? '?'} ${String(dog.age_unit ?? '').slice(0, 10)}
- 체중: ${dog.weight ?? '?'} kg
- 성별: ${String(dog.gender ?? '미상').slice(0, 10)} ${dog.neutered ? '(중성화 완료)' : ''}
- 알러지: ${allergies || '없음'}
</dog_info>
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

  // XL-8 (#47): history depth 10 → 20 + system prompt 중앙화.
  const historyQuery = supabase
    .from('chatbot_messages')
    .select('role, content')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(CHATBOT_HISTORY_LIMIT)
  const { data: historyRaw } = dogId
    ? await historyQuery.eq('dog_id', dogId)
    : await historyQuery.is('dog_id', null)

  const history = (
    (historyRaw ?? []) as Array<{ role: string; content: string }>
  )
    .reverse()
    .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
      m.role === 'user' || m.role === 'assistant',
    )

  const systemPrompt = buildChatbotSystemPrompt(dogContext)

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 400,
      stream: true,
      system: systemPrompt,
      messages: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: message },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  }).catch((e) => {
    return new Response(
      JSON.stringify({ code: 'NETWORK_ERROR', message: String(e) }),
      { status: 502 },
    )
  })

  if (!anthropicRes.ok || !anthropicRes.body) {
    return NextResponse.json(
      { code: 'AI_ERROR', message: 'AI 응답 실패' },
      { status: 502 },
    )
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  // Anthropic SSE → 클라이언트 SSE (text delta 만 추출 후 재포장).
  // 누적된 텍스트는 stream 종료 시 chatbot_messages 에 저장.
  let fullText = ''

  const stream = new ReadableStream({
    async start(controller) {
      const reader = anthropicRes.body!.getReader()
      let buffer = ''
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split('\n\n')
          buffer = events.pop() ?? ''
          for (const ev of events) {
            // data: {...}
            const m = /^data:\s*(.+)$/m.exec(ev)
            if (!m) continue
            try {
              const obj = JSON.parse(m[1]!) as AnthropicStreamDelta
              if (
                obj.type === 'content_block_delta' &&
                obj.delta?.type === 'text_delta' &&
                obj.delta?.text
              ) {
                fullText += obj.delta.text
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ delta: obj.delta.text })}\n\n`),
                )
              }
            } catch {
              /* malformed event — skip */
            }
          }
        }
      } catch (e) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: String(e) })}\n\n`,
          ),
        )
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }

      // best-effort history 저장. stream 응답 닫힌 뒤라 async 그대로 두고 종료.
      if (fullText) {
        void supabase
          .from('chatbot_messages')
          .insert([
            {
              user_id: user.id,
              dog_id: dogId ?? null,
              role: 'user',
              content: message,
            },
            {
              user_id: user.id,
              dog_id: dogId ?? null,
              role: 'assistant',
              content: fullText,
            },
          ])
          .then(() => undefined, () => undefined)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
