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
import { checkAnthropicDailyCap, checkAiUserDailyLimit, recordAnthropicUsage } from '@/lib/anthropic-usage'
import { captureBusinessEvent } from '@/lib/sentry/trace'
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
  /** message_start — 입력 토큰 */
  message?: { usage?: { input_tokens?: number; output_tokens?: number } }
  /** message_delta — 출력 토큰(누적) */
  usage?: { output_tokens?: number }
  /** 스트림 중간 오류(overloaded 등) */
  error?: { type?: string; message?: string }
}

/** 스트림이 끊겼을 때 고객에게 보낼 한 문장 — 원문(String(e))은 보내지 않는다(2026-09-26). */
const STREAM_BROKEN = '답변이 중간에 끊겼어요. 다시 물어봐 주세요.'

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

  // 점검 G: 일일 전역 AI 비용 cap — IP 분당 제한 우회 무제한 호출 방지. fail-open.
  const cap = await checkAnthropicDailyCap('chatbot')
  if (cap.exceeded) {
    return NextResponse.json(
      {
        code: 'DAILY_CAP_EXCEEDED',
        message: '오늘 AI 사용량이 많아 잠시 후 다시 시도해 주세요',
      },
      { status: 503 },
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

  // 사용자별 하루 AI 한도 — IP·인스턴스와 무관하게 DB 로 센다(2026-09-24 보안 점검).
  const userRl = await checkAiUserDailyLimit(supabase, user.id, 'chatbot')
  if (!userRl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '오늘은 더 이상 요청할 수 없어요. 내일 다시 시도해 주세요' },
      { status: 429, headers: userRl.headers },
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
      model: (await import('@/lib/anthropic-models')).MODEL_CHATBOT,
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
  let inputTokens = 0
  let outputTokens = 0

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
              if (obj.type === 'message_start') {
                inputTokens = obj.message?.usage?.input_tokens ?? inputTokens
              } else if (obj.type === 'message_delta') {
                outputTokens = obj.usage?.output_tokens ?? outputTokens
              } else if (obj.type === 'error') {
                // 중간 오류(과부하 등) — 예전엔 조용히 무시돼 빈 말풍선만 남았다.
                captureBusinessEvent('error', 'anthropic.chatbot_stream.error_event', {
                  type: obj.error?.type ?? 'unknown',
                })
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ error: STREAM_BROKEN })}\n\n`),
                )
              }
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
        captureBusinessEvent('error', 'anthropic.chatbot_stream.broken', {
          detail: (e instanceof Error ? e.message : String(e)).slice(0, 200),
        })
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: STREAM_BROKEN })}\n\n`),
        )
      } finally {
        // ★사용량 기록 — 전역 하루 상한이 챗봇을 세게(2026-09-26 점검 7차). 닫기 전에 기다린다
        //   (응답이 끝난 뒤의 비동기는 서버리스에서 잘릴 수 있다). recordAnthropicUsage 는 throw 안 함.
        await recordAnthropicUsage('chatbot', {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        })
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
