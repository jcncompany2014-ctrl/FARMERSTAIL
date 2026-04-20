import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CheckoutForm from './CheckoutForm'

export const dynamic = 'force-dynamic'

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
          <div className="bg-white rounded-xl border border-[#EDE6D8] px-5 py-5">
            <p className="text-[13px] font-bold text-[#B83A2E]">
              장바구니를 불러오지 못했어요
            </p>
            <p className="text-[11px] text-[#8A7668] mt-1.5">{error.message}</p>
          </div>
        </div>
      </main>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (items ?? [])
    .map((it: any) => ({
      id: it.id as string,
      quantity: it.quantity as number,
      product: Array.isArray(it.products) ? it.products[0] : it.products,
    }))
    .filter((r) => r.product && r.product.is_active)

  if (rows.length === 0) {
    return (
      <main className="pb-8">
        <section className="px-5 pt-14">
          <div className="bg-white rounded-xl border border-[#EDE6D8] px-5 py-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#F5F0E6] flex items-center justify-center text-[26px]">
              🛒
            </div>
            <p className="mt-4 text-[13px] font-bold text-[#3D2B1F]">
              장바구니가 비어 있어요
            </p>
            <Link
              href="/products"
              className="mt-5 inline-block px-5 py-2.5 rounded-xl bg-[#A0452E] text-white text-[12px] font-bold active:scale-[0.98] transition"
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
      <section className="px-5 pt-5 pb-1">
        <h1 className="text-lg font-black text-[#3D2B1F] tracking-tight">
          주문/결제
        </h1>
        <p className="text-[11px] text-[#8A7668] mt-0.5">
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
      />
    </main>
  )
}
