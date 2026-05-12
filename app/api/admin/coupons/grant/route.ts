import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/coupons/grant — audience='manual' 쿠폰을 사용자 1명에게
 * 발급 (manual_coupon_grants insert).
 *
 * Body: { coupon_id: uuid, user_id: uuid }
 *
 * 검증
 * ────
 *  - admin 만 (이중 — middleware + isAdmin)
 *  - 쿠폰이 audience='manual' + is_active 여야 발급 가능. 다른 audience 는
 *    각자 cron / banner 가 처리하므로 manual grant 의미 X — 400 에러.
 *  - 사용자가 실제로 존재해야 함 (foreign key 자동 검증)
 *  - 중복 발급 시 ON CONFLICT silent — 응답은 ok 로 동일.
 *
 * 발급 후 사용자에게 push 알림 (best-effort — 실패해도 grant 는 성공).
 */

const zBody = z.object({
  coupon_id: z.string().uuid(),
  user_id: z.string().uuid(),
})

export async function POST(req: Request) {
  const rl = rateLimit({
    bucket: 'admin-coupon-grant',
    key: ipFromRequest(req),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: rl.headers },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!(await isAdmin(supabase, user))) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const parsed = await parseRequest(req, zBody)
  if (!parsed.ok) return parsed.response

  const { coupon_id, user_id } = parsed.data

  // 쿠폰 audience 검증.
  const { data: coupon, error: couponErr } = await supabase
    .from('coupons')
    .select('id, name, audience_type, is_active, expires_at')
    .eq('id', coupon_id)
    .maybeSingle()

  if (couponErr || !coupon) {
    return NextResponse.json(
      { ok: false, error: 'coupon_not_found' },
      { status: 404 },
    )
  }
  if (!coupon.is_active) {
    return NextResponse.json(
      { ok: false, error: 'coupon_inactive' },
      { status: 400 },
    )
  }
  if (coupon.audience_type !== 'manual') {
    return NextResponse.json(
      {
        ok: false,
        error: 'wrong_audience',
        message: `수동 발급은 audience='manual' 쿠폰만 가능 (현재: ${coupon.audience_type}).`,
      },
      { status: 400 },
    )
  }

  // admin client 로 grant insert — RLS 우회.
  const admin = createAdminClient()
  const { error: insertErr } = await admin.from('manual_coupon_grants').upsert(
    {
      coupon_id,
      user_id,
      granted_by: user.id,
    },
    { onConflict: 'coupon_id,user_id', ignoreDuplicates: true },
  )

  if (insertErr) {
    return NextResponse.json(
      { ok: false, error: 'insert_failed', message: insertErr.message },
      { status: 500 },
    )
  }

  // 사용자에게 push 알림 (best-effort). 실패해도 grant 자체는 성공.
  // category 안 줌 — admin 의도된 1:1 발급이라 marketing 동의 여부와 무관하게
  // 도달해야 자연스러움.
  try {
    const { pushToUser } = await import('@/lib/push')
    await pushToUser(user_id, {
      title: '쿠폰이 도착했어요',
      body: `"${coupon.name}" 쿠폰을 사용하실 수 있어요.`,
      url: '/mypage/coupons',
      tag: `coupon-grant-${coupon_id}`,
    })
  } catch (err) {
    console.error('[coupon/grant] push failed', err)
  }

  return NextResponse.json({ ok: true, granted: { coupon_id, user_id } })
}
