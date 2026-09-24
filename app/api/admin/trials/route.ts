import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { dbError } from '@/lib/api/errors'
import { safeOrTerm } from '@/lib/supabase/or-filter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 체험단 도장 API (admin 전용) — docs/TRIAL_PROGRAM_2026_10.md v2.
 *
 *   GET    — 도장 목록(+프로필) / ?q= 로 도장 찍을 후보 검색(이메일·이름)
 *   POST   — 도장 찍기 { userId, note?, cheapBoxes?, halfBoxes? }
 *   DELETE — 도장 취소 { userId } (진행 중 취소 = 다음 결제부터 정상 규칙)
 *
 * subscription_trials 는 RLS 정책이 없다(service_role 전용) — 돈이 걸린 칸이라
 * 프로모션과 같은 원칙으로 쓰기를 admin API 로만 몰아둔다.
 */

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { fail: NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요해요' }, { status: 401 }) }
  if (!(await isAdmin(supabase, user)))
    return { fail: NextResponse.json({ code: 'FORBIDDEN', message: '권한이 없어요' }, { status: 403 }) }
  return { user }
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
      .select('id, name, email')
      .or(`email.ilike.%${safeQ}%,name.ilike.%${safeQ}%`)
      .limit(10)
    if (error) return dbError(error, 'admin_trials_search', '검색하지 못했어요')
    return NextResponse.json({ ok: true, candidates: data ?? [] })
  }

  const { data: trials, error } = await admin
    .from('subscription_trials')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return dbError(error, 'admin_trials_list', '체험단 목록을 불러오지 못했어요')

  const ids = (trials ?? []).map((t) => t.user_id)
  const profileById = new Map<string, { name: string | null; email: string | null }>()
  if (ids.length > 0) {
    const { data: profs, error: profErr } = await admin
      .from('profiles')
      .select('id, name, email')
      .in('id', ids)
    if (profErr) return dbError(profErr, 'admin_trials_profiles', '프로필을 불러오지 못했어요')
    for (const p of profs ?? []) profileById.set(p.id, { name: p.name, email: p.email })
  }

  return NextResponse.json({
    ok: true,
    trials: (trials ?? []).map((t) => ({
      ...t,
      profile: profileById.get(t.user_id) ?? { name: null, email: null },
    })),
  })
}

export async function POST(req: Request) {
  const gate = await requireAdmin()
  if ('fail' in gate) return gate.fail

  let body: { userId?: string; note?: string; cheapBoxes?: number; halfBoxes?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 'INVALID_BODY', message: '요청 형식 오류' }, { status: 400 })
  }
  if (!body.userId) {
    return NextResponse.json({ code: 'INVALID_BODY', message: 'userId 필요' }, { status: 400 })
  }
  // 회차는 1~12 상한 — 실수로 400 같은 값이 들어가 1년 넘게 100원이 나가는 사고 방지.
  const cheap = Math.trunc(Number(body.cheapBoxes ?? 4))
  const half = Math.trunc(Number(body.halfBoxes ?? 4))
  if (!Number.isFinite(cheap) || cheap < 0 || cheap > 12 || !Number.isFinite(half) || half < 0 || half > 12) {
    return NextResponse.json({ code: 'INVALID_BOXES', message: '회차는 0~12 사이예요' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('subscription_trials').insert({
    user_id: body.userId,
    cheap_remaining: cheap,
    half_remaining: half,
    note: (body.note ?? '').trim(),
    created_by: gate.user.id,
  })
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ code: 'ALREADY', message: '이미 체험단 도장이 있어요' }, { status: 409 })
    }
    return dbError(error, 'admin_trials_create', '도장을 찍지 못했어요')
  }
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
  const { error } = await admin.from('subscription_trials').delete().eq('user_id', body.userId)
  if (error) return dbError(error, 'admin_trials_delete', '도장을 취소하지 못했어요')
  return NextResponse.json({ ok: true })
}
