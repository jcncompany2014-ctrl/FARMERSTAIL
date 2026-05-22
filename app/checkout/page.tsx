import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShoppingCart, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { stockState, maxOrderable } from '@/lib/products/stock'
import { calculateShipping } from '@/lib/commerce/shipping'
import CheckoutForm from './CheckoutForm'
import { rowToAddress, type AddressRow } from '@/lib/commerce/addresses'
import AuthAwareShell from '@/components/AuthAwareShell'
import { tierMeta } from '@/lib/tiers'
import DeliveryCountdownBanner from '@/components/products/DeliveryCountdownBanner'
import { isAppContextServer } from '@/lib/app-context'
import { V3, V3FontWeight, V3LetterSpacing, V3Radius } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '주문/결제',
  description: '파머스테일 주문 및 결제',
  robots: { index: false, follow: false },
}

/**
 * /checkout — 주문/결제 페이지 (v3 reskin, 2026-05-22 R9-9).
 *
 * Page-level v3: 헤더, 비어있음, 재고 차단 분기.
 * 내부 CheckoutForm 은 다음 라운드에서 form input/select v3 marker swap 예정.
 */
export default async function CheckoutPage() {
  const supabase = await createClient()
  const isApp = await isAppContextServer()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/checkout')

  const nowIso = new Date().toISOString()
  const [
    { data: profile },
    { data: ledger },
    { data: addrRows },
    { data: items, error },
    { count: paidOrderCount },
    { data: firstSignupCoupon },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('name, phone, zip, address, address_detail, tier')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('point_ledger')
      .select('balance_after')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('addresses')
      .select(
        'id, user_id, label, recipient_name, phone, zip, address, address_detail, is_default, created_at, updated_at',
      )
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('cart_items')
      .select(
        `
      id,
      quantity,
      product_id,
      products (
        id,
        name,
        slug,
        price,
        sale_price,
        image_url,
        stock,
        is_active
      )
    `
      )
      .eq('user_id', user.id),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('payment_status', 'paid'),
    supabase
      .from('coupons')
      .select('code')
      .eq('audience_type', 'first_signup')
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const autoApplyCouponCode =
    (paidOrderCount ?? 0) === 0 && firstSignupCoupon
      ? (firstSignupCoupon as { code: string }).code
      : null

  const pointBalance = ledger?.balance_after ?? 0
  const savedAddresses = (addrRows ?? []).map((r) =>
    rowToAddress(r as AddressRow),
  )
  const defaultAddress = savedAddresses.find((a) => a.isDefault) ?? null

  if (error) {
    return (
      <AuthAwareShell>
        <main className="mx-auto" style={{ maxWidth: 1200, paddingBottom: 32 }}>
          <div style={{ padding: '20px' }}>
            <div
              style={{
                background: V3.paperHi,
                border: `1px solid ${V3.sale}`,
                borderRadius: V3Radius.sm,
                padding: '18px 20px',
              }}
            >
              <p
                style={{
                  fontSize: 13,
                  fontWeight: V3FontWeight.bold,
                  color: V3.sale,
                  margin: 0,
                }}
              >
                장바구니를 불러오지 못했어요
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: V3.inkMute,
                  marginTop: 6,
                }}
              >
                {error.message}
              </p>
            </div>
          </div>
        </main>
      </AuthAwareShell>
    )
  }

  const rows = (items ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((it: any) => ({
      id: it.id as string,
      quantity: it.quantity as number,
      product: Array.isArray(it.products) ? it.products[0] : it.products,
    }))
    .filter((r) => r.product && r.product.is_active)

  if (rows.length === 0) {
    return (
      <AuthAwareShell>
        <main className="mx-auto" style={{ maxWidth: 1200, paddingBottom: 32 }}>
          <section style={{ padding: '56px 20px 0' }}>
            <div
              className="text-center"
              style={{
                borderRadius: V3Radius.sm,
                border: `1.5px dashed ${V3.rule}`,
                padding: '48px 24px',
                background: V3.paperHi,
              }}
            >
              <div
                className="mx-auto flex items-center justify-center"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  background: V3.paper,
                  border: `1px solid ${V3.rule}`,
                }}
              >
                <ShoppingCart size={24} color={V3.inkMute} strokeWidth={1.5} />
              </div>
              <div style={{ marginTop: 14 }}>
                <Mono color="inkMute" size="xxs" weight={600}>
                  Empty
                </Mono>
              </div>
              <p
                style={{
                  margin: '8px 0 0',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: V3FontWeight.black,
                  fontSize: 17,
                  color: V3.ink,
                  letterSpacing: '-0.02em',
                }}
              >
                장바구니가 비어 있어요
              </p>
              <Link
                href="/products"
                className="inline-block active:scale-[0.98] transition"
                style={{
                  marginTop: 20,
                  padding: '12px 24px',
                  fontSize: 12,
                  fontWeight: V3FontWeight.bold,
                  borderRadius: V3Radius.pill,
                  background: V3.ink,
                  color: V3.paperHi,
                  textDecoration: 'none',
                }}
              >
                제품 둘러보기
              </Link>
            </div>
          </section>
        </main>
      </AuthAwareShell>
    )
  }

  const blocked = rows
    .map((r) => {
      const maxQ = maxOrderable(r.product.stock)
      const isOut = stockState(r.product.stock) === 'out'
      const overCap = !isOut && r.quantity > maxQ
      return { row: r, isOut, overCap, maxQ }
    })
    .filter((b) => b.isOut || b.overCap)

  if (blocked.length > 0) {
    return (
      <AuthAwareShell>
        <main className="mx-auto" style={{ maxWidth: 1200, paddingBottom: 32 }}>
          <section style={{ padding: '24px 20px 8px' }}>
            <Mono color="inkMute" size="xs" weight={500}>
              Checkout · 결제
            </Mono>
            <h1
              style={{
                margin: '6px 0 0',
                fontFamily: 'var(--font-sans)',
                fontWeight: V3FontWeight.black,
                fontSize: 28,
                color: V3.ink,
                letterSpacing: V3LetterSpacing.heading,
                lineHeight: 1,
              }}
            >
              재고 확인이 필요해요
            </h1>
            <p
              style={{
                fontSize: 11.5,
                color: V3.inkMute,
                marginTop: 6,
              }}
            >
              장바구니에서 수량을 조정한 뒤 다시 결제해 주세요
            </p>
          </section>

          <section style={{ padding: '16px 20px 0' }}>
            <div
              style={{
                background: V3.paperHi,
                border: `1px solid ${V3.sale}`,
                borderRadius: V3Radius.sm,
                padding: '16px 16px',
              }}
            >
              <div className="flex items-start" style={{ gap: 10 }}>
                <div
                  className="shrink-0 flex items-center justify-center"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    background: V3.sale,
                  }}
                >
                  <AlertTriangle
                    size={16}
                    color={V3.paperHi}
                    strokeWidth={2.25}
                  />
                </div>
                <div className="min-w-0">
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: V3FontWeight.bold,
                      color: V3.ink,
                      margin: 0,
                    }}
                  >
                    아래 상품들은 지금 주문할 수 없어요
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: V3.inkMute,
                      marginTop: 4,
                    }}
                  >
                    품절됐거나 남은 재고보다 많이 담겨 있어요. 장바구니에서 수량을
                    맞추거나 삭제 후 다시 결제해 주세요.
                  </p>
                </div>
              </div>

              <ul
                style={{
                  marginTop: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  listStyle: 'none',
                  padding: 0,
                }}
              >
                {blocked.map(({ row, isOut, maxQ }) => (
                  <li
                    key={row.id}
                    className="flex items-center"
                    style={{
                      gap: 12,
                      background: V3.paper,
                      border: `1px solid ${V3.rule}`,
                      borderRadius: V3Radius.xs,
                      padding: '10px 12px',
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className="line-clamp-1"
                        style={{
                          margin: 0,
                          fontSize: 12,
                          fontWeight: V3FontWeight.bold,
                          color: V3.ink,
                        }}
                      >
                        {row.product.name}
                      </p>
                      <Mono
                        color="inkMute"
                        size="xxs"
                        weight={500}
                        letterSpacing="0.04em"
                        style={{ marginTop: 3, display: 'inline-block' }}
                      >
                        {isOut
                          ? '품절 상품이에요'
                          : `담긴 수량 ${row.quantity}개 / 남은 재고 ${maxQ}개`}
                      </Mono>
                    </div>
                    <span
                      className="shrink-0"
                      style={{
                        padding: '2px 8px',
                        borderRadius: V3Radius.pill,
                        fontSize: 10,
                        fontWeight: V3FontWeight.bold,
                        background: isOut ? V3.ink : V3.sale,
                        color: V3.paperHi,
                        letterSpacing: '0.02em',
                      }}
                    >
                      {isOut ? '품절' : '재고 부족'}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href="/cart"
                className="inline-flex items-center justify-center active:scale-[0.99] transition w-full"
                style={{
                  marginTop: 16,
                  padding: '12px 0',
                  borderRadius: V3Radius.pill,
                  fontSize: 13,
                  fontWeight: V3FontWeight.bold,
                  background: V3.ink,
                  color: V3.paperHi,
                  textDecoration: 'none',
                }}
              >
                장바구니로 돌아가기
              </Link>
            </div>
          </section>
        </main>
      </AuthAwareShell>
    )
  }

  const subtotal = rows.reduce((sum, r) => {
    const price = r.product.sale_price ?? r.product.price
    return sum + price * r.quantity
  }, 0)
  const initialZip = defaultAddress?.zip ?? profile?.zip ?? null
  const initialShipping = calculateShipping({
    subtotal,
    zip: initialZip,
  })
  const shippingFee = initialShipping.total
  const total = subtotal + shippingFee

  const orderItems = rows.map((r) => ({
    productId: r.product.id as string,
    name: r.product.name as string,
    imageUrl: (r.product.image_url as string | null) ?? null,
    unitPrice: (r.product.sale_price ?? r.product.price) as number,
    quantity: r.quantity,
    lineTotal: (r.product.sale_price ?? r.product.price) * r.quantity,
  }))

  return (
    <AuthAwareShell>
      <main
        className="md:max-w-5xl md:mx-auto md:pt-4"
        style={{ paddingBottom: 160 }}
      >
        <section
          style={{ padding: '24px 20px 8px' }}
          className="md:pt-8 md:pb-4 md:px-6"
        >
          <Mono color="inkMute" size="xs" weight={500}>
            Checkout · 결제
          </Mono>
          <h1
            className="md:text-[34px] lg:text-[40px]"
            style={{
              margin: '6px 0 0',
              fontFamily: 'var(--font-sans)',
              fontWeight: V3FontWeight.black,
              fontSize: 28,
              color: V3.ink,
              letterSpacing: V3LetterSpacing.heading,
              lineHeight: 1.1,
            }}
          >
            주문 / 결제
          </h1>
          <p
            className="md:text-[13px]"
            style={{
              fontSize: 11.5,
              color: V3.inkMute,
              marginTop: 6,
            }}
          >
            주문 정보를 확인해 주세요
          </p>
        </section>

        {!isApp && (
          <section style={{ padding: '12px 20px 0' }} className="md:px-6">
            <DeliveryCountdownBanner />
          </section>
        )}

        <CheckoutForm
          userId={user.id}
          userEmail={user.email ?? ''}
          defaultProfile={{
            name: defaultAddress?.recipientName || (profile?.name ?? ''),
            phone: defaultAddress?.phone || (profile?.phone ?? ''),
            zip: defaultAddress?.zip || (profile?.zip ?? ''),
            address: defaultAddress?.address || (profile?.address ?? ''),
            addressDetail:
              defaultAddress?.addressDetail || (profile?.address_detail ?? ''),
          }}
          savedAddresses={savedAddresses}
          selectedAddressId={defaultAddress?.id ?? null}
          orderItems={orderItems}
          subtotal={subtotal}
          shippingFee={shippingFee}
          total={total}
          pointBalance={pointBalance}
          earnRate={tierMeta(profile?.tier ?? null).earnRate}
          autoApplyCouponCode={autoApplyCouponCode}
        />
      </main>
    </AuthAwareShell>
  )
}
