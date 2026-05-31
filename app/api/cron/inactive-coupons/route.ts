import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { sendEmail } from '@/lib/email'
import { renderComebackCoupon } from '@/lib/email/templates/comeback'
import { generateMarketingUnsubscribeToken } from '@/lib/email/unsubscribe-token'
import { currentKstHour } from '@/lib/datetime-kst'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/inactive-coupons
 *
 * 30일+ 미접속 + 마케팅 동의 사용자에게 재참여 쿠폰 메일 발송.
 *
 * 동작
 * ────
 * 1) audience_type='inactive_30d' 활성/미만료 쿠폰 1건 picking. 없으면 skip.
 * 2) auth.users.last_sign_in_at < (today - 30d) + agree_email=true + email 보유
 *    profiles 조회.
 * 3) inactive_coupon_log 의 (user_id, year_month=YYYY-MM) 가 이미 있으면 제외
 *    — 한 달 1회.
 * 4) 배치 5명씩 sendEmail + log insert. 멱등 — 발송 실패해도 log 는 기록해
 *    재시도 무한 루프 방지 (birthday cron 패턴 동일).
 *
 * 인증: x-vercel-cron 또는 Authorization: Bearer ${CRON_SECRET}. 그 외 401.
 *
 * 스케줄
 * ─────
 * vercel.json 에 path: '/api/cron/inactive-coupons' 추가하면 자동. 권장 빈도
 * 는 한 달 1회 또는 매주 일요일 — 사용자가 정함.
 */

function todayKst() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return {
    yearMonth: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
    cutoffIso: new Date(now.getTime() - 30 * 86_400_000).toISOString(),
  }
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }
  // R83-E3 (D3): trackCron wrap.
  return trackCron('inactive-coupons', async () => {
    // R101-G: 광고성 메일 야간 발송 제한 (정보통신망법 §50⑧, 21~08시 KST).
    const kstHour = currentKstHour()
    if (kstHour >= 21 || kstHour < 8) {
      return NextResponse.json({ ok: true, skipped: 'night_quiet_hours', kstHour })
    }
    const admin = createAdminClient()
    const { yearMonth, cutoffIso } = todayKst()

  // 1) 쿠폰 pick — audience_type='inactive_30d' 활성/미만료.
  type CouponRow = {
    code: string
    name: string
    discount_type: 'percent' | 'fixed'
    discount_value: number
    expires_at: string | null
    is_active: boolean
  }
  const { data: couponData } = await admin
    .from('coupons')
    .select('code, name, discount_type, discount_value, expires_at, is_active')
    .eq('audience_type', 'inactive_30d')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const coupon = (couponData ?? null) as CouponRow | null

  if (!coupon) {
    return NextResponse.json({
      ok: true,
      matched: 0,
      sent: 0,
      reason: 'coupon_not_configured',
      hint: 'Create an active coupon with audience_type=inactive_30d in /admin/coupons.',
    })
  }
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

  // 2) 30일+ 미접속 후보. auth.users 의 last_sign_in_at 은 admin client 로만
  //    안전하게 접근 가능 — service_role 키 사용. profiles 와 join 해서 마케팅
  //    동의 + 이메일 보유 필터.
  //
  //    Supabase JS SDK 는 auth.users 직접 query 가 제한적이라 RPC 또는 raw
  //    SQL 이 필요한데, 가장 단순한 방법 — admin.auth.admin.listUsers 로 1차
  //    fetch 후 profiles 와 in-memory join. 페이지네이션은 1000명 단위.
  const { data: listed, error: listErr } =
    await admin.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) {
    return NextResponse.json(
      { code: 'AUTH_LIST_FAILED', message: listErr.message },
      { status: 500 },
    )
  }

  const cutoffMs = new Date(cutoffIso).getTime()
  const inactiveUserIds = listed.users
    .filter((u) => {
      const last = u.last_sign_in_at
      if (!last) return false // 한 번도 로그인 안 한 계정 — 다른 동선
      return new Date(last).getTime() < cutoffMs
    })
    .map((u) => u.id)

  if (inactiveUserIds.length === 0) {
    return NextResponse.json({ ok: true, matched: 0, sent: 0 })
  }

  // 3) profiles 에서 마케팅 동의 + 이메일 보유 필터.
  const { data: candidates } = await admin
    .from('profiles')
    .select('id, name, email, agree_email')
    .in('id', inactiveUserIds)
    .eq('agree_email', true)
    .not('email', 'is', null)

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, matched: 0, sent: 0 })
  }

  // 4) 이번 달 이미 발송 받은 사용자 제외.
  const { data: alreadySent } = await admin
    .from('inactive_coupon_log')
    .select('user_id')
    .eq('year_month', yearMonth)
    .in(
      'user_id',
      candidates.map((c) => c.id),
    )

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
      reason: 'all_sent_this_month',
    })
  }

  // 5) 발송 (배치 5)
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
          const { subject, html } = renderComebackCoupon({
            recipientName: user.name ?? '보호자',
            discountLabel,
            validUntil: coupon.expires_at,
          })
          const r = await sendEmail({
            to: user.email!,
            subject,
            html,
            tag: 'inactive-coupon',
            idempotencyKey: `inactive:${user.id}:${yearMonth}`,
            // R101: RFC 8058 List-Unsubscribe — Gmail/Yahoo 2024 대량발송 필수.
            unsubscribeUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://farmerstail.kr'}/api/marketing/unsubscribe?uid=${encodeURIComponent(user.id)}&token=${generateMarketingUnsubscribeToken(user.id)}`,
          })
          await admin.from('inactive_coupon_log').insert({
            user_id: user.id,
            year_month: yearMonth,
            coupon_code: coupon.code,
          })
          return r.ok === true
        } catch (err) {
          console.error('[cron/inactive] failed', {
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
  })
}
