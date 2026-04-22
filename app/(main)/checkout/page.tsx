import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import CheckoutForm from './CheckoutForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '주문/결제',
  description: '파머스테일 주문 및 결제',
  robots: { index: false, follow: false },
}

export default async function CheckoutPage() {
  const supabase = await createClient()

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
      <main className="pb-8">
        <div className="px-5 pt-5">
          <div className="bg-white rounded-xl border border-rule px-5 py-5">
            <p className="text-[13px] font-bold text-sale">
              장바구니를 불러오지 못했어요
            </p>
            <p className="text-[11px] text-muted mt-1.5">{error.message}</p>
          </div>
        </div>
      </main>
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
      <main className="pb-8">
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
            <span className="kicker mt-4 inline-block">Empty · 비어 있음</span>
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
    )
  }

  const subtotal = rows.reduce((sum, r) => {
    const price = r.product.sale_price ?? r.product.price
    return sum + price * r.quantity
  }, 0)
  const shippingFee = subtotal >= 30000 ? 0 : 3000
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
    <main className="pb-40">
      <section className="px-5 pt-6 pb-2">
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
          주문/결제
        </h1>
        <p className="text-[11px] text-muted mt-1">
          주문 정보를 확인해 주세요
        </p>
      </section>

      <CheckoutForm
        userId={user.id}
        userEmail={user.email ?? ''}
        defaultProfile={{
          name: profile?.name ?? '',
          phone: profile?.phone ?? '',
          zip: profile?.zip ?? '',
          address: profile?.address ?? '',
          addressDetail: profile?.address_detail ?? '',
        }}
        orderItems={orderItems}
        subtotal={subtotal}
        shippingFee={shippingFee}
        total={total}
        pointBalance={pointBalance}
      />
    </main>
  )
}
