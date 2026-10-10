import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitDB, ipFromRequest } from '@/lib/rate-limit'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import { cartSummary, normalizeCart } from '@/lib/store/cart'
import { RECIPE_DB_SLUG, STORE_RECIPES, type StoreRecipe } from '@/lib/store/catalog'
import { orderItemsFromCart, orderNameFor, validateRecipient } from '@/lib/store/order'
import { storeOrderNumber } from '@/lib/store/order-number'
import { isAppContextServer } from '@/lib/app-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/store/orders — 웹 가게 주문 만들기(결제 전). 2026-10-10 웹 리뉴얼.
 *
 * 브라우저는 '무엇을 몇 개 · 어디로'만 보낸다. 금액·품목·주문번호는 서버가 상품표(lib/store)로 계산해 만든다 —
 * 고객은 orders 를 직접 쓸 수 없다(쓰기 권한 회수, AGENTS 돈 규칙3). 만든 주문은 결제 대기(pending)이고,
 * 결제위젯이 이 주문번호·금액으로 결제한 뒤 /api/payments/confirm 이 승인한다(품목 합 = 상품 금액 대조 포함).
 * 30분 안에 결제 안 되면 order-expire 크론이 취소한다.
 *
 * 회원만(사장님 10/10 "회원만") — 같은 계정이라 앱에서도 이 주문이 보인다.
 * 앱에서는 가게 주문을 받지 않는다(앱은 단품을 안 판다).
 */
export async function POST(req: Request) {
  const admin = createAdminClient()
  const rl = await rateLimitDB({ supabase: admin, bucket: 'store-order', key: ipFromRequest(req), limit: 10, windowMs: 60_000 })
  if (!rl.ok) {
    return NextResponse.json({ code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' }, { status: 429, headers: rl.headers })
  }

  if (await isAppContextServer()) {
    return NextResponse.json({ code: 'APP_NOT_STORE', message: '앱에서는 정기배송만 신청할 수 있어요' }, { status: 403 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요해요' }, { status: 401 })

  let body: { lines?: unknown; recipient?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 'BAD_REQUEST', message: '주문 내용을 읽지 못했어요' }, { status: 400 })
  }

  const lines = normalizeCart(body.lines)
  if (lines.length === 0) return NextResponse.json({ code: 'EMPTY_CART', message: '담은 상품이 없어요' }, { status: 400 })
  const recipient = validateRecipient((body.recipient ?? null) as Parameters<typeof validateRecipient>[0])
  if (!recipient.ok) return NextResponse.json({ code: 'BAD_RECIPIENT', message: recipient.message }, { status: 400 })

  const summary = cartSummary(lines)
  const items = orderItemsFromCart(lines)
  // 품목 합 = 상품 금액 — 승인 라우트가 같은 대조를 한다. 여기서 어긋나면 상품표 버그다.
  const itemsSum = items.reduce((s, it) => s + it.unit_price * it.quantity, 0)
  if (itemsSum !== summary.subtotal) {
    captureBusinessEvent('error', 'store.order.items_sum_mismatch', { itemsSum, subtotal: summary.subtotal })
    return NextResponse.json({ code: 'PRICE_ERROR', message: '금액 계산에 문제가 생겼어요. 고객센터로 알려 주세요.' }, { status: 500 })
  }

  // 주문 품목이 가리킬 레시피 행(products) — 정기배송과 같은 4행.
  const slugs = STORE_RECIPES.map((r) => RECIPE_DB_SLUG[r])
  const { data: prods, error: prodErr } = await admin.from('products').select('id, slug').in('slug', slugs)
  if (prodErr || !prods) {
    captureBusinessEvent('error', 'store.order.products_lookup_failed', { dbError: prodErr?.message ?? 'no-data' })
    return NextResponse.json({ code: 'SERVER_ERROR', message: '잠시 후 다시 시도해 주세요' }, { status: 500 })
  }
  const idOf = new Map<StoreRecipe, string>()
  for (const r of STORE_RECIPES) {
    const row = prods.find((p) => p.slug === RECIPE_DB_SLUG[r])
    if (row) idOf.set(r, row.id)
  }
  if (items.some((it) => !idOf.has(it.recipe))) {
    captureBusinessEvent('error', 'store.order.product_row_missing', { found: prods.map((p) => p.slug).join(',') })
    return NextResponse.json({ code: 'SERVER_ERROR', message: '잠시 후 다시 시도해 주세요' }, { status: 500 })
  }

  const r = recipient.value
  // 주문번호가 겹치면(아주 드묾) 새로 뽑아 두 번 더 시도한다.
  let order: { id: string; order_number: string } | null = null
  let lastErr: string | null = null
  for (let attempt = 0; attempt < 3 && !order; attempt++) {
    const { data, error } = await admin
      .from('orders')
      .insert({
        user_id: user.id,
        order_number: storeOrderNumber(),
        subtotal: summary.subtotal,
        shipping_fee: summary.shippingFee,
        total_amount: summary.total,
        discount_amount: 0,
        recipient_name: r.name,
        recipient_phone: r.phone,
        zip: r.zip,
        address: r.address,
        address_detail: r.addressDetail || null,
        delivery_memo: r.memo || null,
        payment_status: 'pending',
        order_status: 'pending',
        subscription_id: null,
      })
      .select('id, order_number')
      .single()
    if (data) order = data
    else lastErr = error?.message ?? 'no-data'
    if (error && error.code !== '23505') break
  }
  if (!order) {
    captureBusinessEvent('error', 'store.order.insert_failed', { dbError: lastErr })
    return NextResponse.json({ code: 'SERVER_ERROR', message: '주문을 만들지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }

  const { error: itemsErr } = await admin.from('order_items').insert(
    items.map((it) => ({
      order_id: order.id,
      product_id: idOf.get(it.recipe)!,
      product_name: it.product_name,
      variant_name: it.variant_name,
      unit_price: it.unit_price,
      quantity: it.quantity,
      line_total: it.line_total,
    })),
  )
  if (itemsErr) {
    // 품목 없는 주문이 결제되면 승인 대조가 꺼진다 — 주문을 지우고 실패로 돌려준다.
    const { error: delErr } = await admin.from('orders').delete().eq('id', order.id)
    captureBusinessEvent('error', 'store.order.items_insert_failed', { orderId: order.id, dbError: itemsErr.message, cleanupError: delErr?.message ?? null })
    return NextResponse.json({ code: 'SERVER_ERROR', message: '주문을 만들지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    orderId: order.order_number,
    amount: summary.total,
    orderName: orderNameFor(lines),
    customerName: r.name,
    customerEmail: user.email ?? null,
    customerMobilePhone: r.phone.replace(/\D/g, ''),
  })
}
