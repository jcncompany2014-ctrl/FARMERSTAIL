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

  // 프로필 (배송지 기본값)
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, phone, zip, address, address_detail')
    .eq('id', user.id)
    .single()

  // 장바구니 불러오기
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
      <div className="p-5">
        <p className="text-[#B83A2E]">장바구니를 불러오지 못했어요.</p>
        <p className="text-xs text-[#8A7668] mt-2">{error.message}</p>
      </div>
    )
  }

  const rows = (items ?? [])
    .map((it: any) => ({
      id: it.id as string,
      quantity: it.quantity as number,
      product: Array.isArray(it.products) ? it.products[0] : it.products,
    }))
    .filter((r) => r.product && r.product.is_active)

  if (rows.length === 0) {
    return (
      <div className="px-5 pt-20 flex flex-col items-center">
        <div className="w-20 h-20 rounded-full bg-[#F5F0E6] flex items-center justify-center text-4xl">
          🛒
        </div>
        <p className="mt-5 text-[#5C4A3A]">장바구니가 비어있어요</p>
        <Link
          href="/products"
          className="mt-6 px-6 py-3 rounded-full bg-[#A0452E] text-white text-sm font-medium"
        >
          제품 둘러보기
        </Link>
      </div>
    )
  }

  const subtotal = rows.reduce((sum, r) => {
    const price = r.product.sale_price ?? r.product.price
    return sum + price * r.quantity
  }, 0)
  const shippingFee = subtotal >= 30000 ? 0 : 3000
  const total = subtotal + shippingFee

  // 클라이언트 컴포넌트로 넘길 직렬화 가능한 데이터
  const orderItems = rows.map((r) => ({
    productId: r.product.id as string,
    name: r.product.name as string,
    imageUrl: (r.product.image_url as string | null) ?? null,
    unitPrice: (r.product.sale_price ?? r.product.price) as number,
    quantity: r.quantity,
    lineTotal: (r.product.sale_price ?? r.product.price) * r.quantity,
  }))

  return (
    <div className="pb-40">
      <div className="px-5 pt-6 pb-4">
        <h1 className="font-['Archivo_Black'] text-2xl text-[#2A2118]">
          CHECKOUT
        </h1>
        <p className="text-sm text-[#8A7668] mt-1">주문 정보를 확인해주세요</p>
      </div>

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
    </div>
  )
}