/**
 * POST /api/contact — 1:1 문의 폼 endpoint.
 *
 * - 검증: 이름·이메일·메시지 필수, 메시지 10~3000자, 이메일 형식.
 * - honeypot: payload 에 `website` 가 있으면 silently 200 (봇 차단).
 * - rate limit: IP 당 1시간 5건 (이메일 발송 cost 보호).
 * - 발송 2건:
 *     1) admin → story@farmerstail.kr 로 새 문의 알림 (replyTo = 사용자 이메일)
 *     2) 사용자 → 입력한 이메일로 접수 확인
 * - Resend 미설정 시 (RESEND_API_KEY 없음) DB 또는 콘솔 로그만. 폼은 success
 *   처리 (사용자 입장에선 전송된 것처럼). Sentry breadcrumb 로 트래킹.
 */

import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/client'
import { renderContactAck, renderContactAdmin } from '@/lib/email/templates/contact'
import { ipFromRequest, rateLimit, rateLimitDB } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { business } from '@/lib/business'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ContactPayload = {
  name?: string
  email?: string
  category?: string
  message?: string
  website?: string // honeypot
}

const CATEGORY_LABEL: Record<string, string> = {
  product: '제품·영양 문의',
  order: '주문·배송',
  subscription: '정기배송',
  refund: '반품·환불',
  partnership: '제휴·도매',
  other: '기타',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  // rate limit — IP 당 1시간 5건. 같은 IP 의 abuse 차단 (이메일 비용).
  const ip = ipFromRequest(req)
  const rl = rateLimit({
    bucket: 'contact',
    key: ip,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { error: '요청이 너무 많아요. 1시간 후 다시 시도해 주세요.' },
      { status: 429, headers: rl.headers },
    )
  }

  let body: ContactPayload
  try {
    body = (await req.json()) as ContactPayload
  } catch {
    return NextResponse.json(
      { error: '요청 형식이 올바르지 않아요.' },
      { status: 400 },
    )
  }

  // honeypot — 봇이 채우면 silently 200.
  // typeof check 까지 — JSON 에서 `false` / `0` / `null` 등 falsy 우회 차단.
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  const name = (body.name ?? '').trim().slice(0, 40)
  const email = (body.email ?? '').trim().slice(0, 120).toLowerCase()
  const category = (body.category ?? 'other').trim().slice(0, 40)
  const message = (body.message ?? '').trim().slice(0, 3000)

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: '이름·이메일·메시지를 모두 입력해 주세요.' },
      { status: 400 },
    )
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: '이메일 형식이 올바르지 않아요.' },
      { status: 400 },
    )
  }
  if (message.length < 10) {
    return NextResponse.json(
      { error: '메시지를 10자 이상 작성해 주세요.' },
      { status: 400 },
    )
  }

  const categoryLabel = CATEGORY_LABEL[category] ?? '기타'

  // 1) admin 알림 — story@farmerstail.kr
  const adminMail = renderContactAdmin({ name, email, categoryLabel, message })
  const adminResult = await sendEmail({
    to: business.email,
    subject: adminMail.subject,
    html: adminMail.html,
    replyTo: email,
    tag: 'contact-admin',
  })

  // admin 메일 진짜 실패 (skipped=false 인데 ok=false) → 사용자에게도 알림.
  // 이 경우 사용자 confirm 메일도 보내지 않음 — bounce reflect 방지
  // (악의적 사용자가 임의 이메일 입력하면 무한 bounce 가능성).
  if (adminResult.ok === false && adminResult.skipped !== true) {
    console.error('[/api/contact] admin email failed:', adminResult)
    return NextResponse.json(
      { error: '메시지 전송이 실패했어요. 이메일로 직접 보내주세요.' },
      { status: 500 },
    )
  }

  // ENV 미설정 (skipped=true) → 운영 가시성 확보 위한 로그
  if (adminResult.ok === false && adminResult.skipped === true) {
    console.warn(
      '[/api/contact] RESEND_API_KEY 미설정 — admin 알림 발송 안 됨. user confirm 메일도 skip',
    )
    // 봇 차단 효과를 위해 200 응답 유지 — 사용자 입장에선 성공처럼 보이지만
    // 실제론 ENV 누락 사고. Sentry 가 잡아야 함.
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  // 2) 사용자 확인 메일 — admin 메일 성공한 경우에만.
  //    ★입력값(이름·내용)을 인용하지 않는다(2026-09-24 보안 점검). 이 폼은 로그인 없이 **아무 주소**로
  //    보낼 수 있어서, 이름·내용을 그대로 실으면 "결제 실패, 여기서 카드 재등록" 같은 글을 우리 도메인
  //    메일로 남에게 보낼 수 있었다(피싱 중계). 고정 문구 + 카테고리(선택지)만 보낸다. 사장님은 관리자
  //    메일에서 원문을 본다.
  // ★받는 주소 기준 하루 3통 (2026-09-26) — 로그인 없이 아무 주소로 보내는 자동답장이라
  //   남의 주소로 반복 발송해 스팸 신고(→ 그 주소의 거래 메일까지 영구 차단)를 유도할 수 있었다.
  //   문의 자체(관리자 메일)는 그대로 접수된다.
  let recipientOk = true
  try {
    const rl = await rateLimitDB({
      supabase: createAdminClient() as never,
      bucket: 'contact-ack-to',
      key: email.trim().toLowerCase(),
      limit: 3,
      windowMs: 86_400_000,
    })
    recipientOk = rl.ok
  } catch {
    /* 서비스 키 없음 — 메모리 한도(위 IP)만으로 진행 */
  }
  if (!recipientOk) return NextResponse.json({ ok: true }, { status: 200 })

  const userMail = renderContactAck({ categoryLabel })
  const userResult = await sendEmail({
    to: email,
    subject: userMail.subject,
    html: userMail.html,
    tag: 'contact-user',
  })

  // 사용자 메일 실패는 silent — admin 은 받았으니 운영 가능
  if (userResult.ok === false && userResult.skipped !== true) {
    console.warn('[/api/contact] user confirmation email failed:', userResult)
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
