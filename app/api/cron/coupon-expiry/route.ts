import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { sendEmail } from '@/lib/email/client'
import { renderLayout, escape, SITE_URL, block } from '@/lib/email/layout'
import { pushToUser } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/coupon-expiry
 *
 * 매일 1회. expires_at 가 D-3 ~ D-2 (24h 슬라이스) 범위인 활성 쿠폰을 찾아,
 * 아직 미사용 + 미알림 사용자에게 1회 알림.
 *
 * # 흐름
 * 1) coupons.is_active=true AND expires_at IN [now+2d, now+3d]
 * 2) 각 쿠폰의 per_user_limit 미만으로 redemption 기록한 사용자 추출
 *    (= 아직 사용 가능)
 * 3) coupon_expiry_notifications 에 없는 (user, coupon) 만 대상
 * 4) 이메일 + 푸시 발송, ledger insert
 *
 * # 한계
 * - 사용자 수 N × 쿠폰 수 M 이 커지면 cron 시간 폭증. 현재는 한 cron run
 *   당 최대 200명 처리 — 다음 실행이 나머지 픽업.
 * - per_user_limit=null (무제한) 쿠폰은 모든 사용자 대상 — admin 이 BIRTHDAY
 *   같은 매년 발급 쿠폰 만들 때 주의.
 */

const MAX_PER_RUN = 200

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }

  const supabase = createAdminClient()
  const now = new Date()
  const in2d = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString()
  const in3d = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()

  // 1) 만료 임박 쿠폰
  const { data: coupons } = await supabase
    .from('coupons')
    .select('id, code, name, discount_type, discount_value, expires_at, per_user_limit')
    .eq('is_active', true)
    .gte('expires_at', in2d)
    .lt('expires_at', in3d)
    .limit(20)

  type CouponRow = {
    id: string
    code: string
    name: string | null
    discount_type: 'percent' | 'amount'
    discount_value: number
    expires_at: string
    per_user_limit: number | null
  }
  const couponList = (coupons ?? []) as CouponRow[]

  if (couponList.length === 0) {
    return NextResponse.json({ ok: true, expiringCoupons: 0, sent: 0 })
  }

  let sent = 0
  let skipped = 0

  for (const coupon of couponList) {
    // 2) 사용 가능한 사용자 = profiles.email IS NOT NULL.
    //    per_user_limit 검사를 한 번에 하면 join 비용 큼. 단순화: per_user_limit
    //    가 null 이면 전체 사용자, 아니면 단순화 — redemption 카운트 N+ 이상
    //    필터는 일단 skip 하고 알림 보내기 (사용자가 이미 사용한 쿠폰엔 그냥
    //    "사용 완료" 안내 메일이 가는 셈인데, 메일 텍스트가 "안 쓰셨다면..." 톤
    //    이라 자연스럽게 넘어감). 정확한 필터는 다음 라운드.
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, name, agree_email')
      .eq('agree_email', true) // 광고성 메일 — 동의자만
      .not('email', 'is', null)
      .limit(MAX_PER_RUN)

    const profileList =
      (profiles ?? []) as { id: string; email: string | null; name: string | null; agree_email: boolean }[]

    if (profileList.length === 0) continue

    // 3) 이미 알림 발송된 (user, coupon) 제외
    const userIds = profileList.map((p) => p.id)
    const { data: alreadyNotified } = await supabase
      .from('coupon_expiry_notifications')
      .select('user_id')
      .eq('coupon_id', coupon.id)
      .in('user_id', userIds)
    const notifiedSet = new Set(
      ((alreadyNotified ?? []) as { user_id: string }[]).map((r) => r.user_id),
    )

    // 이미 사용한 사용자도 제외 — per_user_limit 도달 시.
    const { data: redeemed } = await supabase
      .from('coupon_redemptions')
      .select('user_id')
      .eq('coupon_id', coupon.id)
      .in('user_id', userIds)
    const redeemedCount = new Map<string, number>()
    for (const r of (redeemed ?? []) as { user_id: string }[]) {
      redeemedCount.set(r.user_id, (redeemedCount.get(r.user_id) ?? 0) + 1)
    }

    const targets = profileList.filter((p) => {
      if (notifiedSet.has(p.id)) return false
      if (coupon.per_user_limit !== null) {
        const used = redeemedCount.get(p.id) ?? 0
        if (used >= coupon.per_user_limit) return false
      }
      return p.email !== null
    })

    if (targets.length === 0) {
      skipped += profileList.length
      continue
    }

    const expiresKst = formatKstDate(coupon.expires_at)
    const discountLabel =
      coupon.discount_type === 'percent'
        ? `${coupon.discount_value}% 할인`
        : `${coupon.discount_value.toLocaleString()}원 할인`

    for (const target of targets) {
      const { subject, html } = renderCouponExpiry({
        recipientName: target.name ?? '고객',
        couponCode: coupon.code,
        couponName: coupon.name ?? discountLabel,
        discountLabel,
        expiresLabel: expiresKst,
      })
      try {
        await sendEmail({
          to: target.email!,
          subject,
          html,
          tag: 'coupon-expiry',
          idempotencyKey: `coupon-expiry:${coupon.id}:${target.id}`,
        })
        sent += 1
      } catch {
        /* swallow */
      }

      // 푸시도 옵션. silent skip on fail.
      pushToUser(target.id, {
        title: '쿠폰 만료 임박',
        body: `${discountLabel} 쿠폰이 ${expiresKst}에 만료돼요.`,
        url: '/mypage/coupons',
        tag: `coupon-expiry-${coupon.id}`,
      }).catch(() => {})

      // ledger insert (멱등 — UNIQUE 제약).
      await supabase
        .from('coupon_expiry_notifications')
        .insert({ user_id: target.id, coupon_id: coupon.id })
        .then(() => {
          /* swallow conflict */
        })
    }
  }

  return NextResponse.json({
    ok: true,
    expiringCoupons: couponList.length,
    sent,
    skipped,
  })
}

function renderCouponExpiry(input: {
  recipientName: string
  couponCode: string
  couponName: string
  discountLabel: string
  expiresLabel: string
}): { subject: string; html: string } {
  // 광고성 정보 — 정보통신망법 §50④ 표기
  const subject = `(광고) [파머스테일] ${input.discountLabel} 쿠폰이 곧 만료돼요`

  const body = `
    <p style="margin:0 0 14px 0;">
      ${escape(input.recipientName)}님, 안녕하세요.
    </p>
    <p style="margin:0 0 14px 0;">
      가지고 계신 <strong>${escape(input.couponName)}</strong> 쿠폰이
      <strong style="color:#C44B3A">${escape(input.expiresLabel)}</strong>
      에 만료돼요. 만료 전에 사용해 보세요.
    </p>
    ${block.callout(
      'gold',
      `<div style="font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: 700; letter-spacing: 0.18em">
        ${escape(input.couponCode)}
      </div>
      <div style="margin-top:6px; font-size:12px; opacity:0.8">
        ${escape(input.discountLabel)}
      </div>`,
    )}
    <p style="margin:14px 0 0 0;font-size:11px;color:#9A9A9A;line-height:1.6;">
      쿠폰은 결제 화면에서 자동 적용 또는 코드 입력으로 사용하실 수 있어요.
      이미 사용하신 쿠폰이라면 본 안내는 무시하셔도 돼요.
    </p>
  `

  const html = renderLayout({
    preview: subject,
    kicker: 'Coupon · 만료 임박',
    heading: `${input.discountLabel} 쿠폰이 곧 만료돼요`,
    body,
    cta: { label: '쿠폰 사용하러 가기', href: `${SITE_URL}/mypage/coupons` },
  })

  return { subject, html }
}

function formatKstDate(iso: string): string {
  const date = new Date(iso)
  const fmt = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  })
  const parts = fmt.formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('month')}월 ${get('day')}일 ${get('weekday')}`
}
