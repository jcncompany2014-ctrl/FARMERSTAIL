import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { dbError } from '@/lib/api/errors'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import { bannerWindow } from '@/lib/link-content/status'
import { isSafeUrl, parseDateOrNull, requireAdmin } from '../_guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * /link 이벤트·모집 배너 CRUD + 순서. 쓰기는 service_role, 저장 후 /link 재생성.
 *  GET            전체(숨김 포함) + 오늘 기준 window
 *  POST {fields}  생성 (sort_order = 맨 뒤)
 *  PATCH {id, patch}  부분 수정
 *  PUT {order: [id…]}  순서 저장
 *  DELETE {id}
 */

const SELECT =
  'id, sort_order, enabled, variant, badge, notice, title, sub, href, image_url, starts_on, ends_on, created_at, updated_at'

type Fields = {
  variant: 'photo' | 'poster'
  badge: string
  notice: string
  title: string
  sub: string
  href: string
  image_url: string
  starts_on: string | null
  ends_on: string | null
  enabled: boolean
}

function text(v: unknown, max: number): string | undefined {
  if (v === undefined || v === null) return ''
  if (typeof v !== 'string' || v.length > max) return undefined
  return v.trim()
}

/** 부분 검증 — 주어진 키만 검사해 patch 객체를 돌려준다. 잘못된 키는 이름을 돌려준다. */
function validate(body: Record<string, unknown>, requireAll: boolean): { patch: Partial<Fields> } | { bad: string } {
  const patch: Partial<Fields> = {}
  const has = (k: string) => requireAll || body[k] !== undefined

  if (has('variant')) {
    if (body.variant !== 'photo' && body.variant !== 'poster') return { bad: 'variant' }
    patch.variant = body.variant
  }
  for (const [k, max] of [
    ['badge', 20],
    ['notice', 80],
    ['title', 60],
    ['sub', 80],
  ] as const) {
    if (has(k)) {
      const t = text(body[k], max)
      if (t === undefined) return { bad: k }
      patch[k] = t
    }
  }
  if (has('title') && !patch.title) return { bad: 'title' }
  if (has('href')) {
    if (!isSafeUrl(body.href)) return { bad: 'href' }
    patch.href = body.href
  }
  if (has('image_url')) {
    if (!isSafeUrl(body.image_url)) return { bad: 'image_url' }
    patch.image_url = body.image_url
  }
  if (has('starts_on')) {
    const d = parseDateOrNull(body.starts_on)
    if (d === undefined) return { bad: 'starts_on' }
    patch.starts_on = d
  }
  if (has('ends_on')) {
    const d = parseDateOrNull(body.ends_on)
    if (d === undefined) return { bad: 'ends_on' }
    patch.ends_on = d
  }
  if (patch.starts_on && patch.ends_on && patch.starts_on > patch.ends_on) return { bad: 'ends_on' }
  if (has('enabled')) {
    if (typeof body.enabled !== 'boolean') return { bad: 'enabled' }
    patch.enabled = body.enabled
  }
  return { patch }
}

const FIELD_LABEL: Record<string, string> = {
  variant: '종류',
  badge: '배지',
  notice: '공지 문장',
  title: '제목',
  sub: '부제',
  href: '링크',
  image_url: '이미지',
  starts_on: '시작일',
  ends_on: '종료일(시작일보다 앞설 수 없어요)',
  enabled: '표시 여부',
}

function badField(k: string) {
  return NextResponse.json({ code: 'BAD_FIELD', field: k, message: `${FIELD_LABEL[k] ?? k} 값을 확인해 주세요` }, { status: 400 })
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const j = await req.json()
    return j && typeof j === 'object' ? (j as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('link_banners')
    .select(SELECT)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return dbError(error, 'admin_link_banners_get', '배너를 불러오지 못했어요')
  const today = todayKstIsoDate()
  const banners = (data ?? []).map((b) => ({ ...b, window: bannerWindow(today, b.starts_on, b.ends_on) }))
  return NextResponse.json({ ok: true, today, banners })
}

export async function POST(req: Request) {
  const denied = await requireAdmin()
  if (denied) return denied
  const body = await readJson(req)
  if (!body) return NextResponse.json({ code: 'INVALID_BODY', message: '잘못된 요청 형식입니다' }, { status: 400 })
  const v = validate(body, true)
  if ('bad' in v) return badField(v.bad)
  const f = v.patch as Fields

  const admin = createAdminClient()
  const { data: last, error: lastErr } = await admin
    .from('link_banners')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastErr) return dbError(lastErr, 'admin_link_banners_post_order', '저장에 실패했어요')

  const { data, error } = await admin
    .from('link_banners')
    .insert({ ...f, sort_order: (last?.sort_order ?? -1) + 1 })
    .select(SELECT)
    .single()
  if (error) return dbError(error, 'admin_link_banners_post', '저장에 실패했어요')
  revalidatePath('/link')
  return NextResponse.json({ ok: true, banner: data })
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin()
  if (denied) return denied
  const body = await readJson(req)
  if (!body || typeof body.id !== 'string' || !body.patch || typeof body.patch !== 'object') {
    return NextResponse.json({ code: 'INVALID_BODY', message: '잘못된 요청 형식입니다' }, { status: 400 })
  }
  const v = validate(body.patch as Record<string, unknown>, false)
  if ('bad' in v) return badField(v.bad)
  if (Object.keys(v.patch).length === 0) {
    return NextResponse.json({ code: 'EMPTY_PATCH', message: '바뀐 내용이 없어요' }, { status: 400 })
  }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('link_banners')
    .update({ ...v.patch, updated_at: new Date().toISOString() })
    .eq('id', body.id)
    .select(SELECT)
  if (error) return dbError(error, 'admin_link_banners_patch', '저장에 실패했어요')
  if (!data || data.length === 0) {
    return NextResponse.json({ code: 'NOT_FOUND', message: '배너를 찾지 못했어요' }, { status: 404 })
  }
  revalidatePath('/link')
  return NextResponse.json({ ok: true, banner: data[0] })
}

export async function PUT(req: Request) {
  const denied = await requireAdmin()
  if (denied) return denied
  const body = await readJson(req)
  const order = body?.order
  if (!Array.isArray(order) || order.length > 50 || !order.every((x) => typeof x === 'string')) {
    return NextResponse.json({ code: 'INVALID_BODY', message: '순서 목록이 올바르지 않아요' }, { status: 400 })
  }
  const admin = createAdminClient()
  // 배너 수가 적어(수십 개 이하) 한 건씩 갱신 — 실패는 첫 오류에서 멈추고 알린다.
  for (let i = 0; i < order.length; i++) {
    const { error } = await admin.from('link_banners').update({ sort_order: i }).eq('id', order[i] as string)
    if (error) return dbError(error, 'admin_link_banners_reorder', '순서 저장에 실패했어요')
  }
  revalidatePath('/link')
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const denied = await requireAdmin()
  if (denied) return denied
  const body = await readJson(req)
  if (!body || typeof body.id !== 'string') {
    return NextResponse.json({ code: 'INVALID_BODY', message: '잘못된 요청 형식입니다' }, { status: 400 })
  }
  const admin = createAdminClient()
  const { data, error } = await admin.from('link_banners').delete().eq('id', body.id).select('id')
  if (error) return dbError(error, 'admin_link_banners_delete', '삭제에 실패했어요')
  if (!data || data.length === 0) {
    return NextResponse.json({ code: 'NOT_FOUND', message: '배너를 찾지 못했어요' }, { status: 404 })
  }
  revalidatePath('/link')
  return NextResponse.json({ ok: true })
}
