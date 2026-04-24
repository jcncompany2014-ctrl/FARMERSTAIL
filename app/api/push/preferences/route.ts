import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET  /api/push/preferences — 현재 사용자의 푸시 선호 조회. 행이 없으면 기본값 반환.
 * PATCH /api/push/preferences — 부분 업데이트. upsert 로 처음 호출 시 행 생성.
 *
 * body (PATCH):
 *   { notify_order?, notify_restock?, notify_cart?, notify_marketing?,
 *     quiet_hours_start?, quiet_hours_end? }
 *
 * quiet_hours 는 둘 다 null 이어야 "끄기" — 하나만 null 이면 400.
 */

type Prefs = {
  notify_order: boolean
  notify_restock: boolean
  notify_cart: boolean
  notify_marketing: boolean
  quiet_hours_start: number | null
  quiet_hours_end: number | null
}

const DEFAULTS: Prefs = {
  notify_order: true,
  notify_restock: true,
  notify_cart: true,
  notify_marketing: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요합니다' },
      { status: 401 },
    )
  }
  const { data } = await supabase
    .from('push_preferences')
    .select(
      'notify_order, notify_restock, notify_cart, notify_marketing, quiet_hours_start, quiet_hours_end',
    )
    .eq('user_id', user.id)
    .maybeSingle()
  return NextResponse.json({ ok: true, prefs: (data as Prefs) ?? DEFAULTS })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요합니다' },
      { status: 401 },
    )
  }

  let body: Partial<Prefs>
  try {
    body = (await req.json()) as Partial<Prefs>
  } catch {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: '요청 형식이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  // quiet_hours 는 둘 다 null 또는 둘 다 0-23 정수여야 함.
  const hasStart = body.quiet_hours_start !== undefined
  const hasEnd = body.quiet_hours_end !== undefined
  if (hasStart || hasEnd) {
    const s = body.quiet_hours_start
    const e = body.quiet_hours_end
    const bothNull = s === null && e === null
    const bothRange =
      typeof s === 'number' &&
      typeof e === 'number' &&
      s >= 0 &&
      s <= 23 &&
      e >= 0 &&
      e <= 23 &&
      s !== e
    if (!bothNull && !bothRange) {
      return NextResponse.json(
        {
          code: 'INVALID_QUIET_HOURS',
          message: 'quiet_hours 는 둘 다 null 이거나 0-23 의 서로 다른 정수여야 해요',
        },
        { status: 400 },
      )
    }
  }

  // 현재 값 → 머지 → upsert. PATCH 의미 유지.
  const { data: existing } = await supabase
    .from('push_preferences')
    .select(
      'notify_order, notify_restock, notify_cart, notify_marketing, quiet_hours_start, quiet_hours_end',
    )
    .eq('user_id', user.id)
    .maybeSingle()

  const next: Prefs = {
    ...DEFAULTS,
    ...(existing as Prefs | null),
    ...body,
  }

  const { error } = await supabase.from('push_preferences').upsert({
    user_id: user.id,
    ...next,
    updated_at: new Date().toISOString(),
  })
  if (error) {
    return NextResponse.json(
      { code: 'DB_ERROR', message: error.message },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true, prefs: next })
}
