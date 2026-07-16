import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { normalizePromoCode } from '@/lib/promotions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 프로모션 관리 API (admin 전용).
 *
 *   GET  — 목록 + 성과(가입수·결제수)
 *   POST — 새 이벤트 만들기
 *   PATCH— 켜기/끄기
 *
 * 이벤트를 만들면 `/start?p=<code>` 링크가 생긴다. 오프라인은 그 QR 을 배너에,
 * 인스타는 프로필 링크에. 고객은 코드를 입력하지 않는다 — 링크가 곧 코드.
 *
 * # 왜 admin API 로 쓰기를 몰아두나
 * promotions 는 RLS 에서 **쓰기 정책이 없다**(= service_role 만). 할인율을 바꾸는
 * 일은 돈이 걸린 조작이라 클라이언트에서 직접 못 하게 한다.
 */

type PromoRow = {
  id: string
  code: string
  name: string
  discount_rate: number
  starts_at: string
  ends_at: string
  max_signups: number | null
  active: boolean
  created_at: string
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요해요' }, { status: 401 })
  }
  if (!(await isAdmin(supabase, user))) {
    return NextResponse.json({ code: 'FORBIDDEN', message: '권한이 없어요' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('promotions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    return NextResponse.json({ code: 'DB_ERROR', message: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as PromoRow[]
  if (rows.length === 0) return NextResponse.json({ ok: true, promotions: [] })

  // 성과 — 가입수(claim) vs 결제수(redeemed). 지금 광고 추적이 없어서, 이 두 숫자가
  // 채널별 성과를 읽는 유일한 창이다.
  const { data: claims } = await admin
    .from('promotion_claims')
    .select('promotion_id, redeemed_order_id')
  const stat = new Map<string, { signups: number; orders: number }>()
  for (const c of (claims ?? []) as Array<{
    promotion_id: string
    redeemed_order_id: string | null
  }>) {
    const s = stat.get(c.promotion_id) ?? { signups: 0, orders: 0 }
    s.signups += 1
    if (c.redeemed_order_id) s.orders += 1
    stat.set(c.promotion_id, s)
  }

  return NextResponse.json({
    ok: true,
    promotions: rows.map((p) => ({
      ...p,
      signups: stat.get(p.id)?.signups ?? 0,
      orders: stat.get(p.id)?.orders ?? 0,
    })),
  })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요해요' }, { status: 401 })
  }
  if (!(await isAdmin(supabase, user))) {
    return NextResponse.json({ code: 'FORBIDDEN', message: '권한이 없어요' }, { status: 403 })
  }

  let body: {
    code?: string
    name?: string
    discountPct?: number
    startsAt?: string
    endsAt?: string
    maxSignups?: number | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 'INVALID_BODY', message: '요청 형식 오류' }, { status: 400 })
  }

  const code = normalizePromoCode(body.code)
  if (!code) {
    return NextResponse.json(
      {
        code: 'INVALID_CODE',
        message: '코드는 영문 소문자·숫자로 2~40자예요 (예: busan1102)',
      },
      { status: 400 },
    )
  }

  const name = (body.name ?? '').trim()
  if (!name) {
    return NextResponse.json({ code: 'INVALID_NAME', message: '이벤트 이름을 적어 주세요' }, { status: 400 })
  }

  // 사장님은 '%' 로 생각한다. 저장은 0~1 비율.
  const pct = Number(body.discountPct)
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
    return NextResponse.json(
      { code: 'INVALID_RATE', message: '할인율은 1~100 사이 숫자예요' },
      { status: 400 },
    )
  }

  const startsAt = body.startsAt ? new Date(body.startsAt) : new Date()
  const endsAt = body.endsAt ? new Date(body.endsAt) : null
  if (!endsAt || Number.isNaN(endsAt.getTime()) || Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ code: 'INVALID_DATE', message: '기간을 확인해 주세요' }, { status: 400 })
  }
  if (endsAt <= startsAt) {
    return NextResponse.json(
      { code: 'INVALID_DATE', message: '종료가 시작보다 빨라요' },
      { status: 400 },
    )
  }

  const maxSignups =
    body.maxSignups == null || body.maxSignups === 0 ? null : Math.trunc(Number(body.maxSignups))
  if (maxSignups != null && (!Number.isFinite(maxSignups) || maxSignups < 0)) {
    return NextResponse.json({ code: 'INVALID_MAX', message: '인원 상한을 확인해 주세요' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('promotions')
    .insert({
      code,
      name,
      discount_rate: pct / 100,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      max_signups: maxSignups,
    })
    .select('*')
    .single()

  if (error) {
    // unique(code) 충돌 — 사람이 읽는 말로.
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json(
        { code: 'DUPLICATE_CODE', message: '이미 쓰고 있는 코드예요' },
        { status: 409 },
      )
    }
    return NextResponse.json({ code: 'DB_ERROR', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, promotion: data })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요해요' }, { status: 401 })
  }
  if (!(await isAdmin(supabase, user))) {
    return NextResponse.json({ code: 'FORBIDDEN', message: '권한이 없어요' }, { status: 403 })
  }

  let body: { id?: string; active?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 'INVALID_BODY', message: '요청 형식 오류' }, { status: 400 })
  }
  if (!body.id || typeof body.active !== 'boolean') {
    return NextResponse.json({ code: 'INVALID_BODY', message: 'id·active 필요' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('promotions')
    .update({ active: body.active })
    .eq('id', body.id)
  if (error) {
    return NextResponse.json({ code: 'DB_ERROR', message: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
