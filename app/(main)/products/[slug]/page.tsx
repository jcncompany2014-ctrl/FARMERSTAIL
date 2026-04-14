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
    if (!user) {
      router.push('/login')
      return
    }

    // 이미 있는지 확인
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

  if (loading) return <main className="flex items-center justify-center min-h-[80vh]"><div className="text-[#8A7668]">로딩 중...</div></main>

  if (!product) {
    return (
      <main className="px-6 py-10 max-w-md mx-auto text-center">
        <p className="text-[#8A7668]">제품을 찾을 수 없어요</p>
        <Link href="/products" className="mt-4 inline-block text-[#3D2B1F] font-bold underline">← 제품 목록</Link>
      </main>
    )
  }

  const displayPrice = product.sale_price ?? product.price
  const total = displayPrice * quantity

  return (
    <main className="px-6 py-6 pb-32">
      <div className="max-w-md mx-auto">
        <Link href="/products" className="text-sm text-[#8A7668] hover:text-[#3D2B1F]">← 제품 목록</Link>

       {/* Image */}
<div className="mt-4 aspect-square bg-white rounded-2xl border-2 border-[#EDE6D8] overflow-hidden mb-6">
  {product.image_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={product.image_url}
      alt={product.name}
      className="w-full h-full object-cover"
    />
  ) : (
    <div className="w-full h-full flex items-center justify-center text-8xl">
      {product.category === '간식' ? '🍪' : product.category === '체험팩' ? '📦' : '🍲'}
    </div>
  )}
</div>

        {/* Info */}
        <div className="mb-6">
          {product.category && (
            <div className="text-xs font-bold text-[#6B7F3A] uppercase tracking-wider mb-2">
              {product.category}
            </div>
          )}
          <h1 className="text-2xl font-black text-[#3D2B1F] tracking-tight leading-tight mb-2">
            {product.name}
          </h1>
          <p className="text-sm text-[#8A7668]">{product.short_description}</p>
        </div>

        {/* Price */}
        <div className="bg-white rounded-2xl border-2 border-[#EDE6D8] p-5 mb-4">
          {product.sale_price ? (
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold text-[#A0452E] bg-[#A0452E]/10 px-2 py-1 rounded">
                {Math.round(((product.price - product.sale_price) / product.price) * 100)}% OFF
              </span>
              <span className="text-3xl font-black text-[#3D2B1F]">
                {product.sale_price.toLocaleString()}
              </span>
              <span className="text-sm text-[#8A7668]">원</span>
              <span className="text-xs text-[#8A7668] line-through ml-1">
                {product.price.toLocaleString()}원
              </span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-[#3D2B1F]">{product.price.toLocaleString()}</span>
              <span className="text-sm text-[#8A7668]">원</span>
            </div>
          )}
          {product.is_subscribable && (
            <div className="mt-3 inline-block text-xs font-bold text-[#6B7F3A] bg-[#6B7F3A]/10 px-2 py-1 rounded">
              🔁 정기배송 가능
            </div>
          )}
        </div>

        {/* Description */}
        {product.description && (
          <div className="bg-white rounded-2xl border-2 border-[#EDE6D8] p-5 mb-4">
            <div className="text-xs font-bold text-[#8A7668] uppercase tracking-wider mb-2">상품 설명</div>
            <p className="text-sm text-[#3D2B1F] leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </div>
        )}

        {/* Quantity */}
        <div className="bg-white rounded-2xl border-2 border-[#EDE6D8] p-5 mb-4">
          <div className="text-xs font-bold text-[#8A7668] uppercase tracking-wider mb-3">수량</div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 rounded-xl bg-[#F5F0E6] font-black text-[#3D2B1F] text-xl active:scale-95 transition"
            >
              −
            </button>
            <div className="flex-1 text-center font-black text-2xl text-[#3D2B1F]">{quantity}</div>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 rounded-xl bg-[#F5F0E6] font-black text-[#3D2B1F] text-xl active:scale-95 transition"
            >
              +
            </button>
          </div>
          <div className="mt-4 pt-4 border-t border-[#EDE6D8] flex items-center justify-between">
            <span className="text-xs font-bold text-[#8A7668] uppercase">총 금액</span>
            <span className="text-xl font-black text-[#A0452E]">{total.toLocaleString()}원</span>
          </div>
        </div>
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t-2 border-[#EDE6D8] px-6 py-3 z-30">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleAddToCart}
            disabled={adding || added}
            className={`w-full py-4 rounded-xl font-bold text-base border-2 border-[#2A2118] shadow-[3px_3px_0_#2A2118] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-70 ${
              added ? 'bg-[#6B7F3A] text-white' : 'bg-[#A0452E] text-white'
            }`}
          >
            {added ? '✅ 장바구니에 담김!' : adding ? '담는 중...' : '장바구니 담기'}
          </button>
        </div>
      </div>
    </main>
  )
}