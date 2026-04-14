'use client'

import { useEffect, useState } from 'react'
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

const CATEGORIES = ['전체', '체험팩', '정기배송', '간식'] as const

export default function ProductsPage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('전체')

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

  const filtered = category === '전체' ? products : products.filter((p) => p.category === category)

  return (
    <main className="px-6 py-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-black text-[#3D2B1F] tracking-tight">제품</h1>
          <p className="text-sm text-[#8A7668] mt-1">파머스테일 프리미엄 펫푸드</p>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto -mx-6 px-6 pb-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition ${
                category === c
                  ? 'bg-[#3D2B1F] text-white'
                  : 'bg-white text-[#8A7668] border-2 border-[#EDE6D8]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Products */}
        {loading ? (
          <div className="text-center py-20 text-[#8A7668]">로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-[#8A7668]">제품이 없어요</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
              <Link
                key={p.id}
                href={`/products/${p.slug}`}
                className="block bg-white rounded-2xl border-2 border-[#EDE6D8] p-5 hover:border-[#3D2B1F] hover:shadow-[3px_3px_0_#2A2118] hover:-translate-y-0.5 transition-all"
              >
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-[#F5F0E6] rounded-xl overflow-hidden flex-shrink-0">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        {p.category === '간식' ? '🍪' : p.category === '체험팩' ? '📦' : '🍲'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1">
                      <h3 className="font-black text-[#3D2B1F] text-base truncate flex-1">{p.name}</h3>
                    </div>
                    <p className="text-xs text-[#8A7668] mb-2 truncate">{p.short_description}</p>
                    <div className="flex items-center gap-2">
                      {p.sale_price ? (
                        <>
                          <span className="text-xs font-bold text-[#A0452E] bg-[#A0452E]/10 px-1.5 py-0.5 rounded">
                            {Math.round(((p.price - p.sale_price) / p.price) * 100)}% OFF
                          </span>
                          <span className="text-sm font-black text-[#3D2B1F]">
                            {p.sale_price.toLocaleString()}원
                          </span>
                          <span className="text-xs text-[#8A7668] line-through">
                            {p.price.toLocaleString()}원
                          </span>
                        </>
                      ) : (
                        <span className="text-sm font-black text-[#3D2B1F]">
                          {p.price.toLocaleString()}원
                        </span>
                      )}
                      {p.is_subscribable && (
                        <span className="text-[9px] font-bold text-[#6B7F3A] bg-[#6B7F3A]/10 px-1.5 py-0.5 rounded">
                          정기배송
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}