import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { notifyRestock } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/restock/dispatch
 *
 * body: { productId: string, variantId?: string | null }
 *
 * 관리자가 품절 상품의 stock 을 0 → N 으로 올렸을 때 fire-and-forget 으로
 * 호출하는 알림 dispatch. 아래 순서로 동작한다:
 *
 *   1. 호출자가 admin 인지 확인 (JWT app_metadata.role='admin' 또는 profiles.role).
 *   2. 해당 상품/variant 가 실제로 stock > 0 인지 확인 — 아직 품절인데 실수로
 *      눌린 경우 구독자에게 거짓 알림이 나가지 않도록 방어.
 *   3. service-role 클라이언트로 restock_alerts 를 스캔하고 발송 + notified_at 업데이트.
 *      (다른 유저의 row 를 건드려야 하므로 RLS 우회 필요.)
 *
 * 응답:
 *   { ok: true, matched, notified, failed } — 얼마나 보냈는지 리포트.
 *   관리자 UI 가 토스트/로그로 확인할 수 있도록.
 */

type Body = {
  productId?: string
  variantId?: string | null
}

export async function POST(req: Request) {
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
  if (!(await isAdmin(supabase, user))) {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다' },
      { status: 403 },
    )
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: '요청 형식이 올바르지 않습니다' },
      { status: 400 },
    )
  }
  if (!body.productId) {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: 'productId 가 필요해요' },
      { status: 400 },
    )
  }

  // 실제 재고 확인 — 0 이면 "재입고" 알림이 어색하므로 거부.
  // variant 단위 구독을 처리할 때는 variant stock 을 본다.
  const admin = createAdminClient()
  if (body.variantId) {
    const { data: variant } = await admin
      .from('product_variants')
      .select('stock, product_id')
      .eq('id', body.variantId)
      .maybeSingle()
    if (!variant || variant.product_id !== body.productId) {
      return NextResponse.json(
        { code: 'VARIANT_NOT_FOUND', message: '상품 옵션을 찾을 수 없어요' },
        { status: 404 },
      )
    }
    if ((variant.stock ?? 0) <= 0) {
      return NextResponse.json(
        { code: 'STILL_OUT_OF_STOCK', message: '아직 재고가 없어요' },
        { status: 409 },
      )
    }
  } else {
    const { data: product } = await admin
      .from('products')
      .select('stock')
      .eq('id', body.productId)
      .maybeSingle()
    if (!product) {
      return NextResponse.json(
        { code: 'PRODUCT_NOT_FOUND', message: '상품을 찾을 수 없어요' },
        { status: 404 },
      )
    }
    if ((product.stock ?? 0) <= 0) {
      return NextResponse.json(
        { code: 'STILL_OUT_OF_STOCK', message: '아직 재고가 없어요' },
        { status: 409 },
      )
    }
  }

  const result = await notifyRestock(admin, {
    productId: body.productId,
    variantId: body.variantId ?? null,
  })

  return NextResponse.json({ ok: true, ...result })
}
