/**
 * Farmer's Tail — 메일 전송 공용 엔트리.
 *
 * 각 이벤트 훅(결제 confirm, 발송 처리, 취소 등) 에서 이 모듈의 `notifyXxx`
 * 를 부르면 (a) 수신자 이메일 조회, (b) 템플릿 렌더, (c) Resend 호출까지
 * 한 번에 처리한다. 실패는 베스트 에포트 — 주문 플로우를 막지 않는다.
 *
 * "왜 async 이지만 await 하지 않는가" 패턴:
 *   호출처는 `notifyOrderPlaced(...).catch(() => {})` 로 fire-and-forget
 *   한다. Vercel 서버리스는 응답 종료 후에도 pending promise 를 수 초간
 *   drain 해주기 때문에 대개 발송이 완료된다. 확실한 보장이 필요하면
 *   cron job / edge function 으로 빼는 게 맞다 (미래 과제).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from './client'
import {
  renderOrderCancelled,
  renderOrderConfirmation,
  renderOrderDelivered,
  renderOrderShipped,
  renderVirtualAccountWaiting,
  renderWelcome,
  type OrderEmailItem,
} from './templates/orders'
import { renderRestockAlert } from './templates/restock'
import { renderCartAbandoned, type CartRecoveryItem } from './templates/cart'
import { paymentMethodLabel } from '@/lib/payments/toss'
import { pushToUser } from '@/lib/push'

export { sendEmail }

type AnySupabase = SupabaseClient

/**
 * 주문에 연결된 수신자 정보 (이름/이메일) 조회. RLS 로 막히는 경우 서비스
 * 롤 클라이언트를 넘기는 호출처가 책임진다.
 */
async function resolveRecipient(
  supabase: AnySupabase,
  userId: string,
  fallbackName: string | null,
): Promise<{ email: string; name: string } | null> {
  const { data } = await supabase
    .from('profiles')
    .select('email, name')
    .eq('id', userId)
    .single()
  if (!data?.email) return null
  return {
    email: data.email,
    name: data.name ?? fallbackName ?? '고객',
  }
}

async function loadOrderItems(
  supabase: AnySupabase,
  orderId: string,
): Promise<OrderEmailItem[]> {
  const { data } = await supabase
    .from('order_items')
    .select('product_name, quantity, line_total')
    .eq('order_id', orderId)
  return (data ?? []) as OrderEmailItem[]
}

// ── 주문 접수 메일 (결제 DONE 직후) ──────────────────────────────────────────
export async function notifyOrderPlaced(
  supabase: AnySupabase,
  input: {
    orderId: string
    userId: string
    orderNumber: string
    recipientName: string | null
    totalAmount: number
    shippingFee: number
    paymentMethod: string | null
  },
) {
  const recipient = await resolveRecipient(supabase, input.userId, input.recipientName)
  if (!recipient) return
  const items = await loadOrderItems(supabase, input.orderId)
  const { subject, html } = renderOrderConfirmation({
    recipientName: recipient.name,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    totalAmount: input.totalAmount,
    shippingFee: input.shippingFee,
    paymentMethodLabel: paymentMethodLabel(input.paymentMethod),
    items,
  })
  await sendEmail({
    to: recipient.email,
    subject,
    html,
    tag: 'order-placed',
    idempotencyKey: `order-placed:${input.orderId}`,
  })
}

// ── 가상계좌 입금 대기 메일 ──────────────────────────────────────────────────
export async function notifyVirtualAccountWaiting(
  supabase: AnySupabase,
  input: {
    orderId: string
    userId: string
    orderNumber: string
    recipientName: string | null
    totalAmount: number
    bankCode: string | null
    accountNumber: string
    accountHolder: string | null
    dueDate: string | null
  },
) {
  const recipient = await resolveRecipient(supabase, input.userId, input.recipientName)
  if (!recipient) return
  const items = await loadOrderItems(supabase, input.orderId)
  const { subject, html } = renderVirtualAccountWaiting({
    recipientName: recipient.name,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    totalAmount: input.totalAmount,
    items,
    bankCode: input.bankCode,
    accountNumber: input.accountNumber,
    accountHolder: input.accountHolder,
    dueDate: input.dueDate,
  })
  await sendEmail({
    to: recipient.email,
    subject,
    html,
    tag: 'virtual-account-waiting',
    idempotencyKey: `va-waiting:${input.orderId}`,
  })
}

// ── 발송 시작 메일 ───────────────────────────────────────────────────────────
export async function notifyOrderShipped(
  supabase: AnySupabase,
  input: {
    orderId: string
    userId: string
    orderNumber: string
    recipientName: string | null
    totalAmount: number
    carrier: string | null
    trackingNumber: string | null
  },
) {
  const recipient = await resolveRecipient(supabase, input.userId, input.recipientName)
  if (!recipient) return
  const items = await loadOrderItems(supabase, input.orderId)
  const { subject, html } = renderOrderShipped({
    recipientName: recipient.name,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    totalAmount: input.totalAmount,
    items,
    carrier: input.carrier,
    trackingNumber: input.trackingNumber,
  })
  await sendEmail({
    to: recipient.email,
    subject,
    html,
    tag: 'order-shipped',
    idempotencyKey: `order-shipped:${input.orderId}`,
  })
}

// ── 배송 완료 메일 ───────────────────────────────────────────────────────────
export async function notifyOrderDelivered(
  supabase: AnySupabase,
  input: {
    orderId: string
    userId: string
    orderNumber: string
    recipientName: string | null
    totalAmount: number
  },
) {
  const recipient = await resolveRecipient(supabase, input.userId, input.recipientName)
  if (!recipient) return
  const items = await loadOrderItems(supabase, input.orderId)
  const { subject, html } = renderOrderDelivered({
    recipientName: recipient.name,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    totalAmount: input.totalAmount,
    items,
  })
  await sendEmail({
    to: recipient.email,
    subject,
    html,
    tag: 'order-delivered',
    idempotencyKey: `order-delivered:${input.orderId}`,
  })
}

// ── 주문 취소 메일 ───────────────────────────────────────────────────────────
export async function notifyOrderCancelled(
  supabase: AnySupabase,
  input: {
    orderId: string
    userId: string
    orderNumber: string
    recipientName: string | null
    totalAmount: number
    reason: string | null
    refundAmount: number | null
  },
) {
  const recipient = await resolveRecipient(supabase, input.userId, input.recipientName)
  if (!recipient) return
  const items = await loadOrderItems(supabase, input.orderId)
  const { subject, html } = renderOrderCancelled({
    recipientName: recipient.name,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    totalAmount: input.totalAmount,
    items,
    reason: input.reason,
    refundAmount: input.refundAmount,
  })
  await sendEmail({
    to: recipient.email,
    subject,
    html,
    tag: 'order-cancelled',
    idempotencyKey: `order-cancelled:${input.orderId}`,
  })
}

// ── 재입고 알림 일괄 발송 ───────────────────────────────────────────────────
/**
 * 품절 → 재입고 트리거. 이 상품(+variant) 의 미통지 구독자를 모두 돌며
 * 메일 + 웹푸시를 쏘고, `notified_at` 을 찍어 중복 발송을 막는다.
 *
 * 전제:
 *   - RLS bypass 가능한 admin 클라이언트(service_role) 를 받아야 여러 유저의
 *     구독 row 를 select/update 할 수 있다.
 *   - 호출처(관리자 dispatch 엔드포인트 또는 stock update webhook) 에서 이미
 *     "이 상품의 stock 이 > 0 인지" 를 확인했다고 가정. 이 함수는 발송만 담당.
 *
 * 베스트 에포트 의미:
 *   개별 유저에게 메일/푸시 전송이 실패해도 notified_at 은 찍는다 — 반복 발송
 *   방지가 우선. 실패 로그는 함수 반환값으로 올려 호출처에서 집계 가능.
 */
export async function notifyRestock(
  supabase: AnySupabase,
  input: {
    productId: string
    variantId?: string | null
  },
): Promise<{ matched: number; notified: number; failed: number }> {
  // 1) 상품 + (옵션) variant 메타 조회 — 메일 본문 렌더에 필요.
  const { data: product } = await supabase
    .from('products')
    .select('id, name, slug, price, sale_price, image_url, stock')
    .eq('id', input.productId)
    .maybeSingle()

  if (!product) return { matched: 0, notified: 0, failed: 0 }

  let variantName: string | null = null
  let variantPrice: number | null = null
  if (input.variantId) {
    const { data: variant } = await supabase
      .from('product_variants')
      .select('id, name, price, sale_price')
      .eq('id', input.variantId)
      .eq('product_id', input.productId)
      .maybeSingle()
    if (variant) {
      variantName = variant.name ?? null
      variantPrice = variant.sale_price ?? variant.price ?? null
    }
  }

  const displayPrice =
    variantPrice ?? product.sale_price ?? product.price ?? 0

  // 2) 미통지 구독자 스캔. variant 조건을 NULL/비-NULL 로 정확히 분기.
  const base = supabase
    .from('restock_alerts')
    .select('id, user_id')
    .eq('product_id', input.productId)
    .is('notified_at', null)
  const { data: subs } = input.variantId
    ? await base.eq('variant_id', input.variantId)
    : await base.is('variant_id', null)

  const rows = (subs ?? []) as Array<{ id: string; user_id: string }>
  if (rows.length === 0) return { matched: 0, notified: 0, failed: 0 }

  // 3) 각 구독자에게 메일 + 웹푸시. 실패해도 notified_at 은 찍어 재발송 방지.
  let notified = 0
  let failed = 0

  await Promise.all(
    rows.map(async (row) => {
      try {
        const recipient = await resolveRecipient(supabase, row.user_id, null)
        if (recipient) {
          const { subject, html } = renderRestockAlert({
            recipientName: recipient.name,
            productName: product.name,
            productSlug: product.slug,
            variantName,
            price: displayPrice,
            imageUrl: product.image_url ?? null,
          })
          await sendEmail({
            to: recipient.email,
            subject,
            html,
            tag: 'restock',
            idempotencyKey: `restock:${input.productId}:${input.variantId ?? 'null'}:${row.user_id}`,
          })
        }
        // 웹푸시는 이메일 주소 유무와 무관하게 시도 — 푸시 구독만 등록한 유저도 있음.
        await pushToUser(row.user_id, {
          title: '🐾 재입고되었어요',
          body: `${product.name}${variantName ? ` (${variantName})` : ''} 가 다시 돌아왔어요. 한정 수량이에요.`,
          url: `/products/${product.slug}`,
          tag: `restock:${input.productId}`,
          requireInteraction: false,
        }).catch(() => {})
        notified += 1
      } catch {
        failed += 1
      }
    }),
  )

  // 4) 발송/실패와 무관하게 notified_at 을 찍어 다음 cron 스캔에서 제외.
  const ids = rows.map((r) => r.id)
  await supabase
    .from('restock_alerts')
    .update({ notified_at: new Date().toISOString() })
    .in('id', ids)

  return { matched: rows.length, notified, failed }
}

// ── 장바구니 재결제 유도 메일 ────────────────────────────────────────────────
/**
 * 한 유저의 현재 장바구니를 조회해 재결제 유도 메일을 보낸다. 호출 전에 cron 이
 * 24h+ 미결제 + 7일 쿨다운 조건을 만족하는지 확인한 상태여야 한다.
 *
 * RLS 우회를 위해 service_role 클라이언트를 받는 것을 전제.
 */
export async function notifyAbandonedCart(
  supabase: AnySupabase,
  input: { userId: string },
): Promise<{ sent: boolean; itemCount: number; subtotal: number }> {
  // 1) 카트 + 상품 join. is_active + stock>0 만 추려 "이미 내려간 상품" 은 제외.
  const { data: rows } = await supabase
    .from('cart_items')
    .select(
      'id, quantity, product_id, variant_id, products(id, name, slug, price, sale_price, image_url, stock, is_active)',
    )
    .eq('user_id', input.userId)

  type Row = {
    id: string
    quantity: number
    product_id: string
    variant_id?: string | null
    products:
      | {
          id: string
          name: string
          slug: string
          price: number
          sale_price: number | null
          image_url: string | null
          stock: number
          is_active: boolean
        }
      | Array<{
          id: string
          name: string
          slug: string
          price: number
          sale_price: number | null
          image_url: string | null
          stock: number
          is_active: boolean
        }>
      | null
  }

  const items: CartRecoveryItem[] = []
  let subtotal = 0
  for (const r of (rows ?? []) as Row[]) {
    const p = Array.isArray(r.products) ? r.products[0] : r.products
    if (!p || !p.is_active || (p.stock ?? 0) <= 0) continue
    const price = p.sale_price ?? p.price ?? 0
    const lineTotal = price * r.quantity
    subtotal += lineTotal
    items.push({
      productName: p.name,
      quantity: r.quantity,
      lineTotal,
    })
  }
  if (items.length === 0) return { sent: false, itemCount: 0, subtotal: 0 }

  // 2) 수신자 조회 — profiles 에서 email.
  const recipient = await resolveRecipient(supabase, input.userId, null)
  if (!recipient) return { sent: false, itemCount: items.length, subtotal }

  const { subject, html } = renderCartAbandoned({
    recipientName: recipient.name,
    items,
    subtotal,
  })
  const sendResult = await sendEmail({
    to: recipient.email,
    subject,
    html,
    tag: 'cart-abandoned',
    // sent_at 일자별 dedupe — 같은 날 중복 트리거는 Resend 측에서 1건으로 접음.
    idempotencyKey: `cart-abandoned:${input.userId}:${new Date().toISOString().slice(0, 10)}`,
  })

  // 3) 로그 기록 — 쿨다운 판정용. 이메일이 skipped 됐어도 "트리거 됐다"는 기록은 남김.
  await supabase.from('cart_recovery_log').insert({
    user_id: input.userId,
    item_count: items.length,
    subtotal,
    channel: 'email',
  })

  return { sent: sendResult.ok === true, itemCount: items.length, subtotal }
}

// ── 회원 가입 환영 메일 ──────────────────────────────────────────────────────
export async function notifyWelcome(
  input: { email: string; name: string | null },
) {
  const { subject, html } = renderWelcome({
    recipientName: input.name ?? '고객',
  })
  await sendEmail({
    to: input.email,
    subject,
    html,
    tag: 'welcome',
    idempotencyKey: `welcome:${input.email}`,
  })
}
