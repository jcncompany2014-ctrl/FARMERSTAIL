'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Product = {
  id: string
  name: string
  slug: string
  description: string | null
  short_description: string | null
  price: number
  sale_price: number | null
  category: string | null
  is_subscribable: boolean
  stock: number
  image_url: string | null
}

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const slug = params.slug as string

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single()
      if (data) setProduct(data)
      setLoading(false)
    }
    load()
  }, [slug, supabase])

  async function handleAddToCart() {
    if (!product) return
    setAdding(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: existing } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('user_id', user.id)
      .eq('product_id', product.id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('cart_items')
        .update({ quantity: existing.quantity + quantity })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('cart_items')
        .insert({ user_id: user.id, product_id: product.id, quantity })
    }

    setAdding(false)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  if (loading) {
    return (
      <main className="min-h-[80vh] flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-[#A0452E] border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  if (!product) {
    return (
      <main className="px-5 py-10 max-w-md mx-auto text-center">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-sm text-[#8A7668]">제품을 찾을 수 없어요</p>
        <Link href="/products" className="mt-4 inline-block text-[13px] text-[#3D2B1F] font-bold underline">
          ← 제품 목록으로
        </Link>
      </main>
    )
  }

  const displayPrice = product.sale_price ?? product.price
  const total = displayPrice * quantity
  const discount = product.sale_price
    ? Math.round(((product.price - product.sale_price) / product.price) * 100)
    : 0

  return (
    <main className="pb-36">
      {/* 뒤로가기 */}
      <div className="px-5 pt-3 pb-2">
        <Link href="/products" className="text-[12px] text-[#8A7668] hover:text-[#3D2B1F] transition">
          ← 제품 목록
        </Link>
      </div>

      {/* 메인 이미지 */}
      <div className="w-full aspect-square bg-[#F5F0E6] relative overflow-hidden">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-24 h-24 bg-[#EDE6D8] rounded-full flex items-center justify-center text-6xl">
              {product.category === '간식' ? '🍪' : product.category === '체험팩' ? '📦' : '🍲'}
            </div>
          </div>
        )}
        {/* 뱃지 */}
        {discount > 0 && (
          <div className="absolute top-3 left-3 bg-[#A0452E] text-white text-[12px] font-black px-2 py-1 rounded-lg">
            {discount}% OFF
          </div>
        )}
        {product.is_subscribable && (
          <div className="absolute top-3 right-3 bg-[#6B7F3A] text-white text-[10px] font-bold px-2 py-1 rounded-lg">
            🔁 정기배송 가능
          </div>
        )}
      </div>

      <div className="px-5">
        {/* 제품 정보 */}
        <div className="pt-5 pb-4">
          {product.category && (
            <div className="text-[11px] font-bold text-[#6B7F3A] uppercase tracking-wider mb-1.5">
              {product.category}
            </div>
          )}
          <h1 className="text-xl font-black text-[#3D2B1F] tracking-tight leading-snug">
            {product.name}
          </h1>
          {product.short_description && (
            <p className="text-[12px] text-[#8A7668] mt-1.5 leading-relaxed">
              {product.short_description}
            </p>
          )}
        </div>

        {/* 가격 */}
        <div className="bg-white rounded-xl border border-[#EDE6D8] px-4 py-4 mb-3">
          {product.sale_price ? (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#A0452E]">
                  {product.sale_price.toLocaleString()}
                </span>
                <span className="text-sm text-[#8A7668]">원</span>
                <span className="text-[12px] text-[#8A7668] line-through ml-1">
                  {product.price.toLocaleString()}원
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-[#3D2B1F]">
                {product.price.toLocaleString()}
              </span>
              <span className="text-sm text-[#8A7668]">원</span>
            </div>
          )}
          {/* 배송비 안내 */}
          <div className="mt-2 text-[10px] text-[#8A7668]">
            {displayPrice >= 30000 ? '✅ 무료배송' : '🚛 3만원 이상 무료배송 (배송비 3,000원)'}
          </div>
        </div>

        {/* 상품 설명 */}
        {product.description && (
          <div className="bg-white rounded-xl border border-[#EDE6D8] px-4 py-4 mb-3">
            <div className="text-[11px] font-bold text-[#8A7668] uppercase tracking-wider mb-2">
              상품 설명
            </div>
            <p className="text-[13px] text-[#3D2B1F] leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </div>
        )}

        {/* 수량 선택 */}
        <div className="bg-white rounded-xl border border-[#EDE6D8] px-4 py-4 mb-3">
          <div className="text-[11px] font-bold text-[#8A7668] uppercase tracking-wider mb-3">수량</div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-9 h-9 rounded-lg bg-[#F5F0E6] font-black text-[#3D2B1F] text-lg flex items-center justify-center active:scale-95 transition"
            >
              −
            </button>
            <div className="flex-1 text-center font-black text-xl text-[#3D2B1F]">{quantity}</div>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-9 h-9 rounded-lg bg-[#F5F0E6] font-black text-[#3D2B1F] text-lg flex items-center justify-center active:scale-95 transition"
            >
              +
            </button>
          </div>
          <div className="mt-3 pt-3 border-t border-[#EDE6D8] flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#8A7668]">총 금액</span>
            <span className="text-lg font-black text-[#A0452E]">{total.toLocaleString()}원</span>
          </div>
        </div>
      </div>

      {/* 하단 고정 CTA */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-[#EDE6D8] px-5 py-3 z-30">
        <div className="max-w-md mx-auto">
          {product.is_subscribable ? (
            <div className="flex gap-2">
              <button
                onClick={handleAddToCart}
                disabled={adding || added}
                className={`flex-1 py-3.5 rounded-xl font-bold text-[13px] transition-all disabled:opacity-70 ${
                  added
                    ? 'bg-[#6B7F3A] text-white'
                    : 'bg-[#3D2B1F] text-white active:scale-[0.98]'
                }`}
              >
                {added ? '✅ 담김!' : adding ? '담는 중...' : '장바구니'}
              </button>
              <Link
                href={`/subscribe/${product.slug}`}
                className="flex-1 py-3.5 rounded-xl font-bold text-[13px] bg-[#6B7F3A] text-white text-center active:scale-[0.98] transition-all"
              >
                🔁 정기배송
              </Link>
            </div>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={adding || added}
              className={`w-full py-3.5 rounded-xl font-bold text-[14px] transition-all disabled:opacity-70 ${
                added
                  ? 'bg-[#6B7F3A] text-white'
                  : 'bg-[#A0452E] text-white active:scale-[0.98]'
              }`}
            >
              {added ? '✅ 장바구니에 담김!' : adding ? '담는 중...' : `장바구니 담기 · ${total.toLocaleString()}원`}
            </button>
          )}
        </div>
      </div>
    </main>
  )
}