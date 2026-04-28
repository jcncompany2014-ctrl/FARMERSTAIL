import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  addressInputSchema,
  toDbPayload,
  rowToAddress,
  type AddressRow,
} from '@/lib/commerce/addresses'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/addresses/[id] — 배송지 수정.
 * DELETE /api/addresses/[id] — 배송지 삭제.
 *
 * RLS 가 본인 행만 UPDATE/DELETE 허용. 그래도 route 에서 auth 를 먼저 확인해
 * 인증 안 된 요청은 즉시 401.
 *
 * 삭제 시 "기본 배송지" 행을 지우면 다른 행 중 가장 최근 것을 자동 기본값
 * 으로 승격. DB 트리거가 insert 시에만 auto-default 하므로, delete 의
 * auto-promote 는 애플리케이션 레이어에서 처리한다.
 */

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = addressInputSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'validation_failed',
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
      { status: 422 }
    )
  }

  const payload = toDbPayload(parsed.data)

  const { data, error } = await supabase
    .from('addresses')
    .update(payload)
    .eq('id', id)
    .eq('user_id', user.id) // defense-in-depth (RLS 도 동일 조건)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ address: rowToAddress(data as AddressRow) })
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // 삭제 대상이 default 였는지 확인 (삭제 후 승격 여부 결정).
  const { data: target } = await supabase
    .from('addresses')
    .select('id, is_default')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { error: delErr } = await supabase
    .from('addresses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  // 기본 배송지를 지웠다면 가장 최근 등록 주소를 자동 승격.
  if (target.is_default) {
    const { data: next } = await supabase
      .from('addresses')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (next) {
      await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', next.id)
        .eq('user_id', user.id)
    }
  }

  return NextResponse.json({ ok: true })
}
