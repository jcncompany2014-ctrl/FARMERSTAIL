import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { sendEmail } from '@/lib/email'
import { renderBirthdayCoupon } from '@/lib/email/templates/birthday'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/birthday-coupons
 *
 * 매일 1회 (예: 오전 9시) 실행. 오늘이 생일인 사용자를 찾아 쿠폰 메일 발송.
 *
 * 동선
 * ────
 * 1. 오늘의 month/day 추출 (KST 기준 — 서버는 UTC, +9 오프셋 보정).
 * 2. profiles 에서 (birth_month, birth_day) = (today.month, today.day) +
 *    agree_email = true (마케팅 수신 동의) 사용자 select.
 * 3. birthday_coupon_log 에 (user_id, year=올해) 가 이미 있으면 skip — 중복 방지.
 * 4. 쿠폰 코드는 ENV `BIRTHDAY_COUPON_CODE` 우선, 기본 'BIRTHDAY10'. coupons
 *    테이블에 활성화된 코드인지 확인 (없으면 모든 발송 skip).
 * 5. 메일 발송 + birthday_coupon_log insert.
 *
 * 응답: { matched, sent, skipped }
 */

function todayKst() {
  // UTC + 9 시간. KST 의 month/day 가 cron 실행 시점과 일치하도록 보정.
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1, // 1..12
    day: now.getUTCDate(),
  }
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }

  const admin = createAdminClient()
  const today = todayKst()

  const couponCode =
    (process.env.BIRTHDAY_COUPON_CODE ?? 'BIRTHDAY10').toUpperCase()

  // 0) 쿠폰 활성 확인 — 운영자가 쿠폰을 만들지 않았으면 발송 안 함.
  const { data: coupon } = await admin
    .from('coupons')
    .select('code, name, discount_type, discount_value, expires_at, is_active')
    .eq('code', couponCode)
    .maybeSingle()

  if (!coupon || !coupon.is_active) {
    return NextResponse.json({
      ok: true,
      matched: 0,
      sent: 0,
      skipped: 0,
      reason: 'coupon_not_configured',
      hint: `Create active coupon "${couponCode}" in /admin/coupons to enable birthday emails.`,
    })
  }

  // 만료된 쿠폰 발송 안 함
  if (
    coupon.expires_at &&
    new Date(coupon.expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json({
      ok: true,
      matched: 0,
      sent: 0,
      reason: 'coupon_expired',
    })
  }

  // 1) 오늘 생일 + 마케팅 수신 동의 + email 보유 사용자.
  const { data: matches, error: qErr } = await admin
    .from('profiles')
    .select('id, name, email, agree_email, birth_month, birth_day')
    .eq('birth_month', today.month)
    .eq('birth_day', today.day)
    .eq('agree_email', true)
    .not('email', 'is', null)

  if (qErr) {
    return NextResponse.json(
      { code: 'QUERY_FAILED', message: qErr.message },
      { status: 500 },
    )
  }

  const candidates = matches ?? []
  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, matched: 0, sent: 0, skipped: 0 })
  }

  // 2) 올해 이미 발송 받은 사용자 제외.
  const userIds = candidates.map((c) => c.id)
  const { data: alreadySent } = await admin
    .from('birthday_coupon_log')
    .select('user_id')
    .eq('year', today.year)
    .in('user_id', userIds)

  const alreadySentSet = new Set(
    (alreadySent ?? []).map((r) => r.user_id as string),
  )

  const eligible = candidates.filter((c) => !alreadySentSet.has(c.id))

  if (eligible.length === 0) {
    return NextResponse.json({
      ok: true,
      matched: candidates.length,
      sent: 0,
      skipped: candidates.length,
      reason: 'all_already_sent_this_year',
    })
  }

  // 3) 발송 (배치 5)
  const discountLabel =
    coupon.discount_type === 'percent'
      ? `${coupon.discount_value}% 할인`
      : `${Number(coupon.discount_value).toLocaleString('ko-KR')}원 할인`

  let sent = 0
  let failed = 0

  for (let i = 0; i < eligible.length; i += 5) {
    const batch = eligible.slice(i, i + 5)
    const results = await Promise.all(
      batch.map(async (user) => {
        try {
          const { subject, html } = renderBirthdayCoupon({
            recipientName: user.name ?? '고객',
            couponCode,
            discountLabel,
            validUntil: coupon.expires_at,
          })
          const r = await sendEmail({
            to: user.email!,
            subject,
            html,
            tag: 'birthday-coupon',
            idempotencyKey: `birthday:${user.id}:${today.year}`,
          })
          // 발송 성공 여부와 무관하게 log 기록 — 재시도 무한 루프 방지.
          await admin.from('birthday_coupon_log').insert({
            user_id: user.id,
            year: today.year,
            coupon_code: couponCode,
          })
          return r.ok === true
        } catch (err) {
          console.error('[cron/birthday] failed', {
            user: user.id,
            err: err instanceof Error ? err.message : String(err),
          })
          return false
        }
      }),
    )
    for (const ok of results) {
      if (ok) sent += 1
      else failed += 1
    }
  }

  return NextResponse.json({
    ok: true,
    matched: candidates.length,
    eligible: eligible.length,
    sent,
    failed,
    skipped: candidates.length - eligible.length,
  })
}
