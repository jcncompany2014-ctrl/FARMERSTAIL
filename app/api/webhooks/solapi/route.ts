import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureBusinessEvent } from '@/lib/sentry/trace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 솔라피 발송 결과 웹훅(single-report) — message_log 상태를 갱신한다.
 *
 * 인증: 솔라피 콘솔에 등록하는 URL 에 우리 토큰을 붙인다
 *   https://www.farmerstail.kr/api/webhooks/solapi?token=<SOLAPI_WEBHOOK_TOKEN>
 * (솔라피 쪽 서명 헤더 형식을 공식 문서로 확인하지 못해, 우리가 통제하는 토큰으로 막는다.)
 *
 * 솔라피는 200 이 아니면 최대 5번 다시 보낸다 → 처리는 messageId 기준 갱신이라 몇 번 와도 같다.
 * DB 오류일 때만 500 을 돌려 재전송을 받는다. payload 는 메시지 정보 배열(형식이 달라도 방어적으로).
 */

function tokenOk(req: Request): boolean {
  const expected = process.env.SOLAPI_WEBHOOK_TOKEN?.trim()
  if (!expected) return false
  const got = new URL(req.url).searchParams.get('token') ?? ''
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

type ReportItem = { messageId?: unknown; statusCode?: unknown; statusMessage?: unknown }

/** 솔라피 상태코드 → 우리 상태. 4000 = 수신 완료, 2000/3000 = 접수·전달 중, 그 외 = 실패. */
function toStatus(code: string): 'delivered' | 'accepted' | 'failed' {
  if (code === '4000') return 'delivered'
  if (code === '2000' || code === '3000') return 'accepted'
  return 'failed'
}

export async function POST(req: Request) {
  if (!tokenOk(req)) return NextResponse.json({ ok: false }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: true, ignored: 'bad_json' })
  }
  const items: ReportItem[] = Array.isArray(body)
    ? (body as ReportItem[])
    : Array.isArray((body as { messages?: unknown })?.messages)
      ? ((body as { messages: ReportItem[] }).messages)
      : []

  const admin = createAdminClient()
  let updated = 0
  for (const it of items) {
    const messageId = typeof it.messageId === 'string' ? it.messageId : null
    const code = typeof it.statusCode === 'string' ? it.statusCode : String(it.statusCode ?? '')
    if (!messageId || !code) continue
    const status = toStatus(code)
    const { error } = await admin
      .from('message_log')
      .update({
        status,
        status_code: code,
        error: status === 'failed' && typeof it.statusMessage === 'string' ? it.statusMessage.slice(0, 300) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('provider_message_id', messageId)
    if (error) {
      captureBusinessEvent('error', 'notify.alimtalk.webhook_update_failed', { messageId, dbError: error.message })
      return NextResponse.json({ ok: false }, { status: 500 })
    }
    updated += 1
  }
  return NextResponse.json({ ok: true, updated })
}
