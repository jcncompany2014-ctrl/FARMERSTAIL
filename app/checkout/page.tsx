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
import DeliveryCountdownBanner from '@/components/products/DeliveryCountdownBanner'
import { isAppContextServer } from '@/lib/app-context'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '주문/결제',
  description: '파머스테일 주문 및 결제',
  robots: { index: false, follow: false },
}

export default async function CheckoutPage() {
  const supabase = await createClient()
  const isApp = await isAppContextServer()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/checkout')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, phone, zip, address, address_detail')
    .eq('id', user.id)
    .single()

  // User's current points balance
  const { data: ledger } = await supabase
    .from('point_ledger')
    .select('balance_after')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const pointBalance = ledger?.balance_after ?? 0

  // Saved shipping addresses — multi-address management (Phase 1.6).
  // Default address first, then most recently created. CheckoutForm uses
  // this list for the saved-address picker at the top of the 배송지 section.
  const { data: addrRows } = await supabase
    .from('addresses')
    .select(
      'id, user_id, label, recipient_name, phone, zip, address, address_detail, is_default, created_at, updated_at',
    )
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
  const savedAddresses = (addrRows ?? []).map((r) =>
    rowToAddress(r as AddressRow),
  )
  const defaultAddress = savedAddresses.find((a) => a.isDefault) ?? null

  const { data: items, error } = await supabase
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
    .eq('user_id', user.id)

  if (error) {
    return (
      <AuthAwareShell>
        <main className="pb-8 mx-auto" style={{ maxWidth: 1200 }}>
        <div className="px-5 pt-5">
          <div className="bg-white rounded-xl border border-rule px-5 py-5">
            <p className="text-[13px] font-bold text-sale">
              장바구니를 불러오지 못했어요
            </p>
            <p className="text-[11px] text-muted mt-1.5">{error.message}</p>
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
        <main className="pb-8 mx-auto" style={{ maxWidth: 1200 }}>
        <section className="px-5 mt-14">
          <div
            className="rounded-2xl border px-5 py-12 text-center"
            style={{
              background: 'var(--bg-2)',
              borderColor: 'var(--rule-2)',
              borderStyle: 'dashed',
            }}
          >
            <div
              className="w-14 h-14 mx-auto rounded-full flex items-center justify-center"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--rule-2)',
              }}
            >
              <ShoppingCart
                className="w-6 h-6 text-muted"
                strokeWidth={1.5}
              />
            </div>
            <span className="kicker mt-4 block">Empty · 비어 있음</span>
            <p
              className="font-serif mt-2"
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              장바구니가 비어 있어요
            </p>
            <Link
              href="/products"
              className="mt-5 inline-block px-6 py-2.5 rounded-full text-[12px] font-bold active:scale-[0.98] transition"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              제품 둘러보기
            </Link>
          </div>
        </section>
      </main>
    </AuthAwareShell>
    )
  }

  // 재고 게이트 — 품절이거나 재고보다 많이 담긴 라인이 하나라도 있으면 결제 진입을
  // 막고 장바구니로 돌려보낸다. 여기서 자동 보정은 하지 않음 — 사용자가 의도적으로
  // 수량을 확인하고 조정하게 하는 편이 결제 직전 분쟁을 줄인다.
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
        <main className="pb-8 mx-auto" style={{ maxWidth: 1200 }}>
        <section className="px-5 pt-6">
          <span className="kicker">Checkout · 주문/결제</span>
          <h1
            className="font-serif mt-1.5"
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            재고 확인이 필요해요
          </h1>
          <p className="text-[11px] text-muted mt-1">
            장바구니에서 수량을 조정한 뒤 다시 결제해 주세요
          </p>
        </section>

        <section className="px-5 mt-4">
          <div
            className="rounded-2xl border px-4 py-4"
            style={{
              background: 'var(--bg-2)',
              borderColor: 'var(--rule-2)',
            }}
          >
            <div className="flex items-start gap-2.5">
              <div
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'var(--sale)' }}
              >
                <AlertTriangle
                  className="w-4 h-4"
                  style={{ color: 'var(--bg)' }}
                  strokeWidth={2.25}
                />
              </div>
              <div className="min-w-0">
                <p
                  className="text-[13px] font-bold"
                  style={{ color: 'var(--ink)' }}
                >
                  아래 상품들은 지금 주문할 수 없어요
                </p>
                <p className="text-[11px] text-muted mt-0.5">
                  품절됐거나 남은 재고보다 많이 담겨 있어요. 장바구니에서 수량을
                  맞추거나 삭제 후 다시 결제해 주세요.
                </p>
              </div>
            </div>

            <ul className="mt-3 space-y-2">
              {blocked.map(({ row, isOut, maxQ }) => (
                <li
                  key={row.id}
                  className="bg-white rounded-xl border border-rule px-3 py-2.5 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-text line-clamp-1">
                      {row.product.name}
                    </p>
                    <p className="text-[10px] text-muted mt-0.5">
                      {isOut
                        ? '품절 상품이에요'
                        : `담긴 수량 ${row.quantity}개 / 남은 재고 ${maxQ}개`}
                    </p>
                  </div>
                  <span
                    className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight"
                    style={{
                      background: isOut ? 'var(--ink)' : 'var(--sale)',
                      color: 'var(--bg)',
                    }}
                  >
                    {isOut ? '품절' : '재고 부족'}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              href="/cart"
              className="mt-4 w-full inline-flex items-center justify-center px-6 py-3 rounded-full text-[13px] font-bold active:scale-[0.99] transition"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
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
  // 초기 배송비 zip — 기본 배송지가 있으면 그 zip 기준, 없으면 profile zip.
  // 사용자가 결제 화면에서 주소를 바꾸면 CheckoutForm이 클라이언트측
  // calculateShipping으로 재계산.
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
      <main className="pb-40 md:max-w-5xl md:mx-auto md:pt-4">
      <section className="px-5 pt-6 md:pt-8 pb-2 md:pb-4 md:px-6">
        <span className="kicker">Checkout · 주문/결제</span>
        <h1
          className="font-serif mt-1.5 md:mt-3 text-[22px] md:text-[34px] lg:text-[40px]"
          style={{
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
          }}
        >
          주문/결제
        </h1>
        <p className="text-[11px] md:text-[13px] text-muted mt-1 md:mt-2">
          주문 정보를 확인해 주세요
        </p>
      </section>

      {!isApp && (
        <section className="px-5 mt-3 md:px-6">
          <DeliveryCountdownBanner />
        </section>
      )}

      <CheckoutForm
        userId={user.id}
        userEmail={user.email ?? ''}
        defaultProfile={{
          // 기본 배송지가 있으면 그 정보를 initial 값으로 사용. 없을 땐
          // profile fallback — 아직 주소를 한 번도 등록하지 않은 사용자 대응.
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
      />
    </main>
    </AuthAwareShell>
  )
}
