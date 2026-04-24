import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/restock      — 재입고 알림 구독 추가
 * DELETE /api/restock    — 재입고 알림 구독 취소
 *
 * body: { productId: string, variantId?: string | null }
 *
 * 응답 스키마는 RLS 가 허용한 경우에만 성공. 상품이 현재 품절이든 아니든
 * 구독은 받는다 — 재입고 후 스토어가 뒤에서 자동 발송.
 *
 * 멱등성: 같은 (user, product, variant) 로 여러 번 POST 해도 400이 아닌
 * "이미 구독됨" 으로 응답. DELETE 도 없는 구독은 조용히 성공.
 */

type Body = {
  productId?: string
  variantId?: string | null
}

async function parseBody(req: Request): Promise<Body | null> {
  try {
    return (await req.json()) as Body
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const body = await parseBody(req)
  if (!body?.productId) {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: 'productId 가 필요해요' },
      { status: 400 }
    )
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
      { status: 401 }
    )
  }

  // 존재 여부 확인 (변형 포함) — 없는 상품/변형이면 400.
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', body.productId)
    .maybeSingle()
  if (!product) {
    return NextResponse.json(
      { code: 'PRODUCT_NOT_FOUND', message: '상품을 찾을 수 없어요' },
      { status: 404 }
    )
  }
  if (body.variantId) {
    const { data: variant } = await supabase
      .from('product_variants')
      .select('id')
      .eq('id', body.variantId)
      .eq('product_id', body.productId)
      .maybeSingle()
    if (!variant) {
      return NextResponse.json(
        { code: 'VARIANT_NOT_FOUND', message: '상품 옵션을 찾을 수 없어요' },
        { status: 404 }
      )
    }
  }

  // upsert 처럼 동작 — unique index가 충돌하면 "이미 구독" 으로 응답.
  const { error } = await supabase.from('restock_alerts').insert({
    user_id: user.id,
    product_id: body.productId,
    variant_id: body.variantId ?? null,
  })

  if (error) {
    // Postgres unique violation → 23505
    if (error.code === '23505') {
      return NextResponse.json({ ok: true, alreadySubscribed: true })
    }
    return NextResponse.json(
      { code: 'SUBSCRIBE_FAILED', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const body = await parseBody(req)
  if (!body?.productId) {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: 'productId 가 필요해요' },
      { status: 400 }
    )
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
      { status: 401 }
    )
  }

  // variant_id 가 null 일 때 .eq('variant_id', null) 은 pg에서 항상 false.
  // .is('variant_id', null) 을 써야 NULL 매칭이 된다.
  const q = supabase
    .from('restock_alerts')
    .delete()
    .eq('user_id', user.id)
    .eq('product_id', body.productId)
  const { error } = body.variantId
    ? await q.eq('variant_id', body.variantId)
    : await q.is('variant_id', null)

  if (error) {
    return NextResponse.json(
      { code: 'UNSUBSCRIBE_FAILED', message: error.message },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true })
}
