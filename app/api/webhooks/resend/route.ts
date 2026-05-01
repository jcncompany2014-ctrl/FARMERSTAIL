import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureBusinessEvent } from '@/lib/sentry/trace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/resend
 *
 * Resend 가 이메일 이벤트 (delivered / bounced / complained / opened /
 * clicked / unsubscribed) 발생 시 이 endpoint 로 webhook 발송.
 *
 * # 처리 정책
 * - bounced / complained — 해당 이메일을 newsletter_subscribers 에서
 *   status='unsubscribed' 로 마킹. 추후 발송 자동 차단.
 * - 같은 이메일 profile 가 있으면 agree_email=false 로 강제 (마케팅 동의 철회).
 *   사용자 액션 없이 자동 — 정보통신망법 §50④ "수신거부 의사 확인" 자동 처리.
 * - opened / clicked / delivered — Sentry 통계 이벤트 (운영 모니터링).
 * - unsubscribed (Resend 의 List-Unsubscribe 처리) — 동일하게 차단.
 *
 * # 보안
 * Resend 는 svix 기반 webhook 서명 (Svix-Signature 헤더). 환경변수
 * `RESEND_WEBHOOK_SECRET` 가 있으면 검증, 없으면 dev 우회 (env 가 미설정인
 * 로컬 / 프리뷰).
 *
 * # 멱등성
 * 같은 (event_id, type) 가 retry 로 두 번 와도 status update 자체가 idempotent.
 * 별도 ledger 안 둠 — 메일 트래픽 폭주 시 disk 비용 큼.
 */

type ResendEvent = {
  type: string
  created_at?: string
  data?: {
    email_id?: string
    to?: string[] | string
    from?: string
    subject?: string
    bounce?: { reason?: string }
    [k: string]: unknown
  }
}

export async function POST(req: Request) {
  // svix 서명 검증.
  const secret = process.env.RESEND_WEBHOOK_SECRET
  const svixId = req.headers.get('svix-id')
  const svixTs = req.headers.get('svix-timestamp')
  const svixSig = req.headers.get('svix-signature')

  const rawBody = await req.text()

  if (secret) {
    if (!svixId || !svixTs || !svixSig) {
      return NextResponse.json(
        { code: 'MISSING_SIGNATURE' },
        { status: 401 },
      )
    }
    // svix 서명 = 'v1,<base64(hmac-sha256(<id>.<ts>.<body>))>'
    // 헤더는 공백 구분으로 여러 시도 (key rotation) 동봉 가능.
    const cleanSecret = secret.startsWith('whsec_')
      ? secret.slice('whsec_'.length)
      : secret
    const secretBuf = Buffer.from(cleanSecret, 'base64')
    const signed = `${svixId}.${svixTs}.${rawBody}`
    const expected = crypto
      .createHmac('sha256', secretBuf)
      .update(signed)
      .digest('base64')
    const candidates = svixSig.split(' ').map((s) => s.split(',')[1])
    const ok = candidates.some((c) => {
      if (!c || c.length !== expected.length) return false
      try {
        return crypto.timingSafeEqual(Buffer.from(c), Buffer.from(expected))
      } catch {
        return false
      }
    })
    if (!ok) {
      return NextResponse.json(
        { code: 'INVALID_SIGNATURE' },
        { status: 401 },
      )
    }
  }

  let event: ResendEvent
  try {
    event = JSON.parse(rawBody) as ResendEvent
  } catch {
    return NextResponse.json({ code: 'INVALID_BODY' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const recipients: string[] = []
  if (Array.isArray(event.data?.to)) {
    recipients.push(...event.data.to.filter((e): e is string => typeof e === 'string'))
  } else if (typeof event.data?.to === 'string') {
    recipients.push(event.data.to)
  }
  const lowered = recipients.map((e) => e.toLowerCase())

  switch (event.type) {
    case 'email.bounced':
    case 'email.complained':
    case 'email.unsubscribed': {
      if (lowered.length === 0) break
      // newsletter 구독 차단
      await supabase
        .from('newsletter_subscribers')
        .update({
          status: 'unsubscribed',
          unsubscribed_at: new Date().toISOString(),
        })
        .in('email', lowered)

      // profiles 의 마케팅 동의 강제 철회
      await supabase
        .from('profiles')
        .update({
          agree_email: false,
          agree_email_at: null,
        })
        .in('email', lowered)

      captureBusinessEvent('warning', `email.${event.type.split('.')[1]}`, {
        recipients: lowered.length,
        reason: event.data?.bounce?.reason,
      })
      break
    }
    case 'email.delivered':
    case 'email.opened':
    case 'email.clicked':
    case 'email.sent':
      // 운영 통계 — Sentry 에 카운트만 (PII 없음).
      captureBusinessEvent('info', `email.${event.type.split('.')[1]}`, {
        emailId: event.data?.email_id ?? null,
      })
      break
    default:
      // 알 수 없는 type — 무시. Resend 가 새 이벤트 추가해도 안전.
      break
  }

  return NextResponse.json({ ok: true })
}
