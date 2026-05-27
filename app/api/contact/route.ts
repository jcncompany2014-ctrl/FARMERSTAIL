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
import { ipFromRequest, rateLimit } from '@/lib/rate-limit'
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

  // honeypot — 봇이 채우면 silently 200
  if (body.website && body.website.trim().length > 0) {
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
  const adminHtml = renderAdminEmail({ name, email, categoryLabel, message })
  const adminResult = await sendEmail({
    to: business.email,
    subject: `[문의·${categoryLabel}] ${name} 님`,
    html: adminHtml,
    replyTo: email,
    tag: 'contact-admin',
  })

  // 2) 사용자 확인 메일
  const userHtml = renderUserEmail({ name, categoryLabel, message })
  await sendEmail({
    to: email,
    subject: '[파머스테일] 문의가 접수됐어요',
    html: userHtml,
    tag: 'contact-user',
  })

  if (adminResult.ok === false && adminResult.skipped !== true) {
    // 진짜 실패 — Resend API 가 4xx/5xx 응답. fail open 하면 운영자 모름.
    console.error('[/api/contact] admin email failed:', adminResult)
    return NextResponse.json(
      { error: '메시지 전송이 실패했어요. 이메일로 직접 보내주세요.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderAdminEmail({
  name,
  email,
  categoryLabel,
  message,
}: {
  name: string
  email: string
  categoryLabel: string
  message: string
}): string {
  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;background:#FAF6EE;padding:24px;color:#2C2A26;">
  <table style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #E6DDC8;">
    <tr><td style="padding:24px 28px;">
      <div style="font-size:11px;letter-spacing:0.18em;color:#7A7A7A;text-transform:uppercase;font-weight:700;">새 문의 · Contact</div>
      <h1 style="font-size:22px;font-weight:800;color:#1E1A14;margin:8px 0 14px;letter-spacing:-0.02em;">${escapeHtml(name)} 님의 문의</h1>
      <table style="width:100%;font-size:13px;line-height:1.6;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#7A7A7A;width:90px;">카테고리</td><td style="padding:6px 0;font-weight:600;color:#1E1A14;">${escapeHtml(categoryLabel)}</td></tr>
        <tr><td style="padding:6px 0;color:#7A7A7A;">이메일</td><td style="padding:6px 0;"><a href="mailto:${escapeHtml(email)}" style="color:#B5533A;text-decoration:none;font-weight:600;">${escapeHtml(email)}</a></td></tr>
        <tr><td style="padding:6px 0;color:#7A7A7A;">이름</td><td style="padding:6px 0;color:#1E1A14;">${escapeHtml(name)}</td></tr>
      </table>
      <div style="margin-top:18px;padding:14px 16px;background:#FAF6EE;border-radius:6px;border:1px solid #E6DDC8;font-size:13.5px;line-height:1.7;color:#2C2A26;white-space:pre-wrap;">${escapeHtml(message)}</div>
      <p style="margin-top:18px;font-size:11.5px;color:#7A7A7A;">"답장" 버튼으로 바로 회신 가능합니다 (Reply-To: ${escapeHtml(email)}).</p>
    </td></tr>
  </table>
</body></html>`
}

function renderUserEmail({
  name,
  categoryLabel,
  message,
}: {
  name: string
  categoryLabel: string
  message: string
}): string {
  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;background:#FAF6EE;padding:24px;color:#2C2A26;">
  <table style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #E6DDC8;">
    <tr><td style="padding:28px 28px 24px;">
      <div style="font-size:11px;letter-spacing:0.18em;color:#B5533A;text-transform:uppercase;font-weight:700;">파머스테일 · 문의 접수</div>
      <h1 style="font-size:22px;font-weight:800;color:#1E1A14;margin:10px 0 6px;letter-spacing:-0.02em;">${escapeHtml(name)} 님, 메시지 잘 받았어요.</h1>
      <p style="font-size:13.5px;line-height:1.7;color:#2C2A26;margin:14px 0 0;">
        평일 영업일 24시간 이내, 가능하면 더 빨리 답변드릴게요. 만약 응답이
        늦어진다면 <a href="mailto:${escapeHtml(business.email)}" style="color:#B5533A;text-decoration:none;font-weight:600;">${escapeHtml(business.email)}</a> 로 다시 한 번 연락 주세요.
      </p>

      <div style="margin-top:22px;padding-top:18px;border-top:1px solid #E6DDC8;">
        <div style="font-size:10.5px;letter-spacing:0.18em;color:#7A7A7A;text-transform:uppercase;font-weight:700;margin-bottom:8px;">접수한 내용</div>
        <table style="width:100%;font-size:12.5px;line-height:1.6;border-collapse:collapse;">
          <tr><td style="padding:4px 0;color:#7A7A7A;width:80px;">카테고리</td><td style="padding:4px 0;color:#1E1A14;font-weight:600;">${escapeHtml(categoryLabel)}</td></tr>
        </table>
        <div style="margin-top:10px;padding:12px 14px;background:#FAF6EE;border-radius:6px;font-size:13px;line-height:1.7;color:#2C2A26;white-space:pre-wrap;">${escapeHtml(message)}</div>
      </div>

      <p style="margin-top:24px;font-size:11px;line-height:1.6;color:#7A7A7A;">
        파머스테일 · ${escapeHtml(business.address)}<br/>
        사업자등록 ${escapeHtml(business.businessNumber)} · 통신판매업 ${escapeHtml(business.mailOrderNumber)}
      </p>
    </td></tr>
  </table>
</body></html>`
}
