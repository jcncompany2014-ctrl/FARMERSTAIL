import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { notifyConsentResult, notifyUnsubscribeAck } from '@/lib/email'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/consent/unsubscribe-ack
 *
 * 정보통신망법 제50조 제5항 — 사용자가 마케팅 수신거부 후 14일 내에 처리결과를
 * 통보해야 함. /mypage/consent 의 ConsentSettingsClient 가 토글 off 시
 * RPC 성공 직후 이 라우트에 호출 → 본인 이메일로 ack 메일 발송.
 *
 * 보안:
 *   - 로그인 사용자만
 *   - rate limit 분당 5
 *   - email 은 server 가 user.email 로 직접 조회 — client 가 임의 이메일 못 넘김
 */

// ★동의(granted=true)도 받는다 (2026-09-25 출시 전 점검 4차) — §50⑦ 은 동의·거부 모두
//   14일 내 처리결과 통지를 요구한다. 예전 호출(channel 하나·거부)은 그대로 동작한다.
const zUnsubAck = z
  .object({
    channel: z.enum(['email', 'sms', 'newsletter', 'push']).optional(),
    channels: z.array(z.enum(['email', 'sms', 'push'])).min(1).max(3).optional(),
    granted: z.boolean().optional(),
  })
  .refine((v) => Boolean(v.channel || v.channels), { message: 'channel 이 필요해요' })

export async function POST(req: Request) {
  const rl = rateLimit({
    bucket: 'unsubscribe-ack',
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

  const parsed = await parseRequest(req, zUnsubAck)
  if (!parsed.ok) return parsed.response

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
      { status: 401 },
    )
  }

  // 발송 best-effort. 실패해도 사용자 토글 자체엔 영향 없게 fire-and-forget.
  // 단 응답엔 발송 결과 명시 — 운영 모니터링.
  try {
    const { channel, channels, granted } = parsed.data
    // 뉴스레터 거부는 기존 안내 메일을 그대로 쓴다.
    const result =
      channel === 'newsletter'
        ? await notifyUnsubscribeAck({ email: user.email, channel })
        : await notifyConsentResult({
            email: user.email,
            channels: channels ?? [channel as 'email' | 'sms' | 'push'],
            granted: granted === true,
          })
    return NextResponse.json({ ok: true, sent: !!result })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      sent: false,
      message: err instanceof Error ? err.message : 'unknown',
    })
  }
}
