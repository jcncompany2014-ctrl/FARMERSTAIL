import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import {
  buildChatbotSystemPrompt,
  CHATBOT_HISTORY_LIMIT,
} from '@/lib/chatbot-system-prompt'
import { checkAnthropicDailyCap, checkAiUserDailyLimit, recordAnthropicUsage } from '@/lib/anthropic-usage'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import { checkChatbotAccess, loadChatDogInfo } from '@/lib/chatbot/server'
import { CHATBOT_SUBSCRIBERS_ONLY, CHATBOT_SUBSCRIBERS_ONLY_MESSAGE } from '@/lib/chatbot/eligibility'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/chatbot — 식이/알러지 상담 (history 보존).
 * GET /api/chatbot?dogId=... — 대화 history 조회.
 * DELETE /api/chatbot?dogId=... — history 삭제.
 *
 * (user_id, dog_id) 쌍의 최근 10턴을 컨텍스트로 묶어 자연 대화. dog_id 가
 * 없으면 dog_id IS NULL 인 일반 대화로 분리.
 *
 * # 가드
 *  - 인증 필수, rate limit 5/min/IP, 메시지 500자
 *  - 시스템 프롬프트 "수의사 진료 대체 X" 명시
 */

const zChatbot = z.object({
  message: z.string().trim().min(1).max(500),
  dogId: z.string().uuid().optional(),
})

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>
  error?: { type?: string; message?: string }
  usage?: { input_tokens?: number; output_tokens?: number }
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

  // 점검 G: 일일 전역 AI 비용 cap — 분산 IP/다수 사용자가 IP 분당 제한을 우회해
  // 무제한 호출하는 비용 남용 방지(commentary/structured 와 동일 패턴). fail-open.
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

  // ★정기배송 중인 보호자만 쓴다(2026-10-13 사장님 결정, 규칙191) — 하루 한도를 세기 전에 거른다.
  const access = await checkChatbotAccess(user.id)
  if (access === 'lookup_failed') {
    return NextResponse.json(
      { code: 'LOOKUP_FAILED', message: '지금은 확인하지 못했어요. 잠시 후 다시 시도해 주세요' },
      { status: 503 },
    )
  }
  if (access === 'not_subscriber') {
    return NextResponse.json(
      { code: CHATBOT_SUBSCRIBERS_ONLY, message: CHATBOT_SUBSCRIBERS_ONLY_MESSAGE },
      { status: 403 },
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

  // audit #68: dog 컨텍스트 — 본인 소유 검증 + 자유 입력 prompt injection 격리(<dog_info> 태그).
  // ★알레르기·기저질환은 최신 설문에서 읽는다(2026-10-13 규칙191) — dogs.allergies 는 늘 비어 있어
  //   알레르기견에게 그 재료를 권했다(9/14). 모르면 '알 수 없음'으로 넘겨 AI 가 먼저 묻는다.
  const dogContext = dogId ? await loadChatDogInfo(user.id, dogId) : ''

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { code: 'NOT_CONFIGURED', message: 'AI 상담이 설정되지 않았어요' },
      { status: 503 },
    )
  }

  // XL-8 (#47): history — 20턴 (10왕복) 로 확장. 자연스러운 multi-turn 추적.
  // token 비용은 haiku 라 영향 미미 (input $0.80/M, 20턴 ≈ 4K token ≈ $0.003).
  const historyQuery = supabase
    .from('chatbot_messages')
    .select('role, content')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(CHATBOT_HISTORY_LIMIT)
  const { data: historyRaw } = dogId
    ? await historyQuery.eq('dog_id', dogId)
    : await historyQuery.is('dog_id', null)

  const history = ((historyRaw ?? []) as Array<{ role: string; content: string }>)
    .reverse()
    .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
      m.role === 'user' || m.role === 'assistant',
    )

  const systemPrompt = buildChatbotSystemPrompt(dogContext)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: (await import('@/lib/anthropic-models')).MODEL_CHATBOT,
        max_tokens: 400,
        system: systemPrompt,
        messages: [
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: message },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as AnthropicResponse
      // 고객에겐 Anthropic 영문 원문 대신 한글 안내, 사장님에겐 Sentry(2026-09-24).
      captureBusinessEvent('error', 'anthropic.chatbot.failed', {
        status: res.status,
        type: err.error?.type ?? 'unknown',
      })
      return NextResponse.json(
        { code: 'AI_ERROR', message: '지금은 답변을 드리지 못했어요. 잠시 후 다시 시도해 주세요' },
        { status: 502 },
      )
    }

    const data = (await res.json()) as AnthropicResponse
    // ★전역 하루 상한(sum_anthropic_calls_today)이 챗봇을 세게 기록한다(2026-09-26 점검 7차 —
    //   예전엔 챗봇이 한 번도 기록되지 않아 상한이 챗봇 호출을 0으로 봤다). best-effort.
    await recordAnthropicUsage('chatbot', data.usage)
    const reply =
      data.content?.find((c) => c.type === 'text')?.text?.trim() ?? ''
    if (!reply) {
      return NextResponse.json(
        { code: 'EMPTY_REPLY', message: 'AI 응답이 비어있어요' },
        { status: 502 },
      )
    }

    // history 저장 — best effort. 응답 흐름은 안 막음.
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
          content: reply,
        },
      ])
      .then(() => undefined, () => undefined)

    return NextResponse.json({ reply })
  } catch (err) {
    captureBusinessEvent('error', 'anthropic.chatbot.fetch_failed', {
      error: err instanceof Error ? err.name : 'unknown',
    })
    return NextResponse.json(
      { code: 'NETWORK_ERROR', message: '지금은 답변을 드리지 못했어요. 잠시 후 다시 시도해 주세요' },
      { status: 502 },
    )
  }
}

export async function GET(req: Request) {
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
  const url = new URL(req.url)
  const rawDogId = url.searchParams.get('dogId')
  // UUID 형식만 통과 — garbage path param 으로 DB 에러 일으키는 것 차단.
  const dogId =
    rawDogId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawDogId)
      ? rawDogId
      : null

  // 최근 30개 — desc 로 가져와 응답 직전 reverse. asc + limit 은 30개 넘기면
  // "옛날 30개" 만 잘려 사용자 화면에 새 메시지가 사라지는 버그가 됨.
  const q = supabase
    .from('chatbot_messages')
    .select('id, role, content, created_at, dog_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)
  const { data } = dogId
    ? await q.eq('dog_id', dogId)
    : await q.is('dog_id', null)
  const messages = (data ?? []).slice().reverse()
  return NextResponse.json({ messages })
}

export async function DELETE(req: Request) {
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
  const url = new URL(req.url)
  const rawDogId = url.searchParams.get('dogId')
  const dogId =
    rawDogId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawDogId)
      ? rawDogId
      : null
  let q = supabase.from('chatbot_messages').delete().eq('user_id', user.id)
  if (dogId) q = q.eq('dog_id', dogId)
  const { error } = await q
  if (error) {
    // audit #69: 원본 DB message 클라이언트 노출 제거 — 서버 로그만(2026-06-20).
    console.error('[chatbot] delete failed:', error.message)
    return NextResponse.json(
      { code: 'DELETE_FAILED', message: '대화 기록을 삭제하지 못했어요' },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true })
}
