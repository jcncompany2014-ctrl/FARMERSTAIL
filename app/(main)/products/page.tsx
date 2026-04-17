'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Product = {
  id: string
  name: string
  slug: string
  short_description: string | null
  price: number
  sale_price: number | null
  category: string | null
  is_subscribable: boolean
  image_url: string | null
}

const CATEGORIES = ['전체', '화식', '간식', '체험팩'] as const
type Category = typeof CATEGORIES[number]

export default function ProductsPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const initialCat = (searchParams.get('category') as Category) || '전체'

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<Category>(
    CATEGORIES.includes(initialCat as Category) ? initialCat : '전체'
  )

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('products')
        .select('id, name, slug, short_description, price, sale_price, category, is_subscribable, image_url')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      if (data) setProducts(data)
      setLoading(false)
    }
    load()
  }, [supabase])

  const filtered = category === '전체'
    ? products
    : products.filter((p) => p.category === category)

  return (
    <main className="pb-8">
      {/* 헤더 */}
      <div className="px-5 pt-5 pb-1">
        <h1 className="text-lg font-black text-[#3D2B1F] tracking-tight">제품</h1>
        <p className="text-[11px] text-[#8A7668] mt-0.5">파머스테일 프리미엄 펫푸드</p>
      </div>

      {/* 카테고리 탭 */}
      <div className="flex gap-2 px-5 py-3 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-4 py-2 rounded-full text-[12px] font-bold whitespace-nowrap transition-all ${
              category === c
                ? 'bg-[#3D2B1F] text-white'
                : 'bg-white text-[#8A7668] border border-[#EDE6D8] hover:border-[#8A7668]'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* 상품 수 */}
      {!loading && (
        <div className="px-5 pb-3">
          <span className="text-[11px] text-[#8A7668]">
            {filtered.length}개의 상품
          </span>
        </div>
      )}

      {/* 상품 그리드 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-[#A0452E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-3xl mb-3">🔍</div>
          <div className="text-sm text-[#8A7668]">해당 카테고리에 상품이 없어요</div>
        </div>
      ) : (
        <div className="px-5 grid grid-cols-2 gap-3">
          {filtered.map((p) => {
            const hasSale = p.sale_price !== null
            const discount = hasSale
              ? Math.round(((p.price - (p.sale_price ?? p.price)) / p.price) * 100)
              : 0

            return (
              <Link
                key={p.id}
                href={`/products/${p.slug}`}
                className="bg-white rounded-xl border border-[#EDE6D8] overflow-hidden hover:border-[#3D2B1F] hover:-translate-y-0.5 transition-all"
              >
                {/* 이미지 */}
                <div className="aspect-square bg-[#F5F0E6] relative overflow-hidden">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-16 h-16 bg-[#EDE6D8] rounded-full flex items-center justify-center text-3xl">
                        {p.category === '간식' ? '🍪' : p.category === '체험팩' ? '📦' : '🍲'}
                      </div>
                    </div>
                  )}
                  {/* 뱃지들 */}
                  {hasSale && discount > 0 && (
                    <div className="absolute top-2 left-2 bg-[#A0452E] text-white text-[10px] font-black px-1.5 py-0.5 rounded-md">
                      {discount}%
                    </div>
                  )}
                  {p.is_subscribable && (
                    <div className="absolute top-2 right-2 bg-[#6B7F3A] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md">
                      정기배송
                    </div>
                  )}
                </div>

                {/* 정보 */}
                <div className="border-t border-[#EDE6D8] px-4 py-3.5">
                  <div className="text-[11px] text-[#3D2B1F] font-bold leading-snug line-clamp-2 min-h-[30px]">
                    {p.name}
                  </div>
                  {p.short_description && (
                    <div className="text-[10px] text-[#8A7668] mt-1 truncate">
                      {p.short_description}
                    </div>
                  )}
                  {hasSale ? (
                    <div className="mt-2">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[15px] font-black text-[#A0452E]">
                          {(p.sale_price ?? p.price).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[#8A7668]">원</span>
                      </div>
                      <div className="text-[10px] text-[#8A7668] line-through leading-none mt-0.5">
                        {p.price.toLocaleString()}원
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-[15px] font-black text-[#3D2B1F]">
                        {p.price.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-[#8A7668]">원</span>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}