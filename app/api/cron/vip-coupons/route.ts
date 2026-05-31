import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { sendEmail } from '@/lib/email'
import { renderVipCoupon } from '@/lib/email/templates/vip'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/vip-coupons
 *
 * profiles.tier IN ('fruit','mate') + 마케팅 동의 사용자에게 매월 1회 정기
 * 쿠폰 메일 발송.
 *
 * 동작
 * ────
 * 1) audience_type='vip_tier' + is_active + 미만료 쿠폰 1건 pick. 없으면 skip.
 * 2) profiles 에서 tier IN ('fruit','mate') + agree_email + email 보유.
 * 3) vip_coupon_log (user_id, year_month) 가 이미 있으면 제외.
 * 4) 배치 5명씩 sendEmail + log insert.
 *
 * 정책
 * ────
 * - 'fruit' (spend >= 1,000,000) + 'mate' (spend >= 3,000,000) 둘 다 대상.
 *   bloom/sprout/seed 제외. fn_compute_tier 함수 정의 참고.
 * - 한 달 1회 발송 (멱등). vercel.json 에서 매월 1일 9시 KST 권장.
 *
 * 스케줄
 * ─────
 * vercel.json 에 path:'/api/cron/vip-coupons' 추가.
 * cron: '0 0 1 * *' (UTC 매월 1일 0시 = KST 매월 1일 9시).
 */

function todayKst() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return {
    yearMonth: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
  }
}

// 5단계 리브랜딩 (seed/sprout/bloom/fruit/mate) 후 cron 대상.
// fruit (>= 100만원) + mate (>= 300만원). bloom 이하 제외.
const VIP_TIERS = ['fruit', 'mate']

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }
  // R83-E3 (D3): trackCron wrap.
  return trackCron('vip-coupons', async () => {
    const admin = createAdminClient()
    const { yearMonth } = todayKst()

  // 1) 쿠폰 pick — audience_type='vip_tier' 활성/미만료.
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
    .eq('audience_type', 'vip_tier')
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
      hint: 'Create an active coupon with audience_type=vip_tier in /admin/coupons.',
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

  // 2) gold/vip + 마케팅 동의 + email 보유.
  const { data: candidates, error: qErr } = await admin
    .from('profiles')
    .select('id, name, email, tier, agree_email')
    .in('tier', VIP_TIERS)
    .eq('agree_email', true)
    .not('email', 'is', null)

  if (qErr) {
    return NextResponse.json(
      { code: 'QUERY_FAILED', message: qErr.message },
      { status: 500 },
    )
  }
  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, matched: 0, sent: 0 })
  }

  // 3) 이번 달 이미 발송 받은 사용자 제외.
  const { data: alreadySent } = await admin
    .from('vip_coupon_log')
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

  // 4) 발송 (배치 5)
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
          const { subject, html } = renderVipCoupon({
            recipientName: user.name ?? '보호자',
            tier: user.tier ?? 'gold',
            discountLabel,
            validUntil: coupon.expires_at,
          })
          const r = await sendEmail({
            to: user.email!,
            subject,
            html,
            tag: 'vip-coupon',
            idempotencyKey: `vip:${user.id}:${yearMonth}`,
          })
          await admin.from('vip_coupon_log').insert({
            user_id: user.id,
            year_month: yearMonth,
            coupon_code: coupon.code,
            tier: user.tier ?? 'gold',
          })
          return r.ok === true
        } catch (err) {
          console.error('[cron/vip] failed', {
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
