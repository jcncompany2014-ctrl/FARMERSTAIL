import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { dbError } from '@/lib/api/errors'
import { safeOrTerm } from '@/lib/supabase/or-filter'
import { NEIGHBOR_RATES } from '@/lib/payments/neighbor'
import { recordAdminAction } from '@/lib/admin-audit'
import { customerHistories, hasPaidBox } from '@/lib/payments/customer-history'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 이웃 할인 API (admin 전용) — 지인·쓰레드 등에서 온 특정 고객에게 첫 박스 할인율을
 * 도장처럼 붙인다(사장님 2026-09-27). 체험단 도장 API 와 같은 동선.
 *
 *   GET    — 목록(+프로필) / ?q= 로 후보 검색(이메일·이름)
 *   POST   — 붙이기 { userId, rate(0.1|0.15|0.2|0.3|0.5), source?, note? }
 *   DELETE — 떼기 { userId } (아직 안 쓴 것만 — 쓴 건 주문 이력이라 남긴다)
 *
 * neighbor_discounts 는 RLS 정책이 없다(service_role 전용) — 돈이 걸린 칸.
 */

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { fail: NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요해요' }, { status: 401 }) }
  if (!(await isAdmin(supabase, user)))
    return { fail: NextResponse.json({ code: 'FORBIDDEN', message: '권한이 없어요' }, { status: 403 }) }
  return { user, supabase }
}

export async function GET(req: Request) {
  const gate = await requireAdmin()
  if ('fail' in gate) return gate.fail
  const admin = createAdminClient()

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q) {
    // 후보 검색 — 카카오 가입자는 email 이 없을 수 있어 이름도 함께 찾는다.
    // .or() 보간은 반드시 safeOrTerm (규칙49 — supabase-js 가 escape 안 함).
    const safeQ = safeOrTerm(q)
    if (!safeQ) return NextResponse.json({ ok: true, candidates: [] })
    const { data, error } = await admin
      .from('profiles')
      .select('id, name, email, created_at')
      .or(`email.ilike.%${safeQ}%,name.ilike.%${safeQ}%`)
      .limit(10)
    if (error) return dbError(error, 'admin_neighbors_search', '검색하지 못했어요')
    // 후보마다 구독 상태·결제 박스 수·가입일 — 이름만 보고 엉뚱한 사람(기존 구독자)에게 붙이는 사고 방지.
    const hist = await customerHistories(admin, (data ?? []).map((p) => p.id))
    if (!hist.ok) return dbError({ message: hist.error }, 'admin_neighbors_search_history', '고객 이력을 불러오지 못했어요')
    return NextResponse.json({
      ok: true,
      candidates: (data ?? []).map((p) => ({ ...p, ...hist.byUser.get(p.id)! })),
    })
  }

  const { data: rows, error } = await admin
    .from('neighbor_discounts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return dbError(error, 'admin_neighbors_list', '이웃 할인 목록을 불러오지 못했어요')

  const ids = (rows ?? []).map((r) => r.user_id)
  const profileById = new Map<string, { name: string | null; email: string | null }>()
  if (ids.length > 0) {
    const { data: profs, error: profErr } = await admin.from('profiles').select('id, name, email').in('id', ids)
    if (profErr) return dbError(profErr, 'admin_neighbors_profiles', '프로필을 불러오지 못했어요')
    for (const p of profs ?? []) profileById.set(p.id, { name: p.name, email: p.email })
  }

  return NextResponse.json({
    ok: true,
    neighbors: (rows ?? []).map((r) => ({
      ...r,
      profile: profileById.get(r.user_id) ?? { name: null, email: null },
    })),
  })
}

export async function POST(req: Request) {
  const gate = await requireAdmin()
  if ('fail' in gate) return gate.fail

  let body: { userId?: string; rate?: number; source?: string; note?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 'INVALID_BODY', message: '요청 형식 오류' }, { status: 400 })
  }
  if (!body.userId) {
    return NextResponse.json({ code: 'INVALID_BODY', message: 'userId 필요' }, { status: 400 })
  }
  // 할인율은 선택지만 — 0.9 같은 오타로 첫 박스가 공짜가 되는 사고 방지.
  const rate = Number(body.rate)
  if (!(NEIGHBOR_RATES as readonly number[]).includes(rate)) {
    return NextResponse.json({ code: 'INVALID_RATE', message: '할인율은 선택지 중에서 골라 주세요' }, { status: 400 })
  }
  const source = (body.source ?? '').trim().slice(0, 60)
  const note = (body.note ?? '').trim().slice(0, 200)

  const admin = createAdminClient()
  // ★'첫 박스' 할인이다 — 결제한 박스가 있는 고객에겐 붙이지 않는다(2026-09-28 9차 점검:
  //   기존 구독자의 다음 회차가 최대 50% 할인되는 경로). 청구 판정도 같은 검사를 한다.
  const paid = await hasPaidBox(admin, body.userId)
  if (paid === null) {
    return NextResponse.json({ code: 'HISTORY_UNAVAILABLE', message: '결제 이력을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요' }, { status: 503 })
  }
  if (paid) {
    return NextResponse.json(
      { code: 'NOT_FIRST_BOX', message: '이미 결제한 박스가 있는 고객이에요 — 이웃 할인은 첫 박스 전용이에요' },
      { status: 409 },
    )
  }
  const { error } = await admin.from('neighbor_discounts').insert({
    user_id: body.userId,
    rate,
    source,
    note,
    created_by: gate.user.id,
  })
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ code: 'ALREADY', message: '이미 이웃 할인이 붙어 있어요' }, { status: 409 })
    }
    return dbError(error, 'admin_neighbors_create', '이웃 할인을 붙이지 못했어요')
  }
  await recordAdminAction(gate.supabase, {
    action: 'neighbor_discount_give',
    entityType: 'user',
    entityId: body.userId,
    diff: { after: { rate, source } },
    req,
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const gate = await requireAdmin()
  if ('fail' in gate) return gate.fail

  let body: { userId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 'INVALID_BODY', message: '요청 형식 오류' }, { status: 400 })
  }
  if (!body.userId) {
    return NextResponse.json({ code: 'INVALID_BODY', message: 'userId 필요' }, { status: 400 })
  }
  const admin = createAdminClient()
  // 이미 쓴 할인(redeemed_order_id 있음)은 주문 이력과 묶여 있어 지우지 않는다.
  const { data, error } = await admin
    .from('neighbor_discounts')
    .delete()
    .eq('user_id', body.userId)
    .is('redeemed_order_id', null)
    .select('rate, source, created_at')
  if (error) return dbError(error, 'admin_neighbors_delete', '이웃 할인을 떼지 못했어요')
  if (!data || data.length === 0) {
    return NextResponse.json({ code: 'NOT_DELETABLE', message: '이미 쓴 할인이거나 없어요' }, { status: 409 })
  }
  await recordAdminAction(gate.supabase, {
    action: 'neighbor_discount_remove',
    entityType: 'user',
    entityId: body.userId,
    diff: { before: data[0] },
    req,
  })
  return NextResponse.json({ ok: true })
}
