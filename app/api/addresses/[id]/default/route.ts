import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/addresses/[id]/default — 해당 배송지를 기본으로 설정.
 *
 * DB 트리거(addresses_manage_default_upd) 가 "해당 행이 default=true 로
 * 업데이트되면 같은 user 의 다른 default 를 false 로 내린다" 를 보장하므로
 * 여기서는 단 한 번의 UPDATE 만 하면 된다.
 */

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data, error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
