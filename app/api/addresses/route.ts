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
 * GET /api/addresses — 본인 배송지 목록.
 * POST /api/addresses — 새 배송지 추가.
 *
 * RLS 가 "본인만" 을 강제하지만 route 에서도 auth 체크해서 빨리 401 로 잘라낸다.
 * 중복 검사는 안 한다 — 같은 주소를 라벨만 다르게 저장하고 싶은 케이스 존재.
 */

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data, error } = await supabase
    .from('addresses')
    .select(
      'id, user_id, label, recipient_name, phone, zip, address, address_detail, is_default, created_at, updated_at',
    )
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as AddressRow[]
  return NextResponse.json({ addresses: rows.map(rowToAddress) })
}

export async function POST(req: Request) {
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

  const payload = toDbPayload(parsed.data, user.id)

  const { data, error } = await supabase
    .from('addresses')
    .insert(payload)
    .select(
      // 명시적 컬럼 — `*` 대신. 혹시 나중에 geo/latlng 같은 컬럼이 추가되어도
      // 클라이언트로 흘러가지 않게.
      'id, user_id, label, recipient_name, phone, zip, address, address_detail, is_default, created_at, updated_at',
    )
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ address: rowToAddress(data as AddressRow) }, { status: 201 })
}
