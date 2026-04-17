'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Dog = {
  id: string
  name: string
  breed: string | null
  birth_date: string | null
  weight: number | null
}

type Product = {
  id: string
  name: string
  slug: string
  price: number
  sale_price: number | null
  image_url: string | null
  category: string | null
  short_description: string | null
  is_subscribable: boolean
}

type Subscription = {
  id: string
  status: string
  next_delivery_date: string | null
  subscription_items: { product_name: string }[]
}

const CATEGORIES = [
  { key: '화식', label: '화식', emoji: '🍲', desc: '건강한 한 끼' },
  { key: '간식', label: '간식', emoji: '🍪', desc: '특별한 보상' },
  { key: '체험팩', label: '체험팩', emoji: '📦', desc: '처음이라면' },
]

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [userName, setUserName] = useState<string | null>(null)
  const [dogs, setDogs] = useState<Dog[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single()
      setUserName(profile?.name || user.email?.split('@')[0] || null)

      const { data: dogData } = await supabase
        .from('dogs')
        .select('id, name, breed, birth_date, weight')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3)
      if (dogData) setDogs(dogData)

      const { data: prodData } = await supabase
        .from('products')
        .select('id, name, slug, price, sale_price, image_url, category, short_description, is_subscribable')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(10)
      if (prodData) setProducts(prodData)

      const { data: subData } = await supabase
        .from('subscriptions')
        .select('id, status, next_delivery_date, subscription_items(product_name)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (subData) setSubscription(subData as Subscription)

      setLoading(false)
    }
    load()
  }, [router, supabase])

  if (loading) {
    return (
      <main className="min-h-[80vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#A0452E] border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  function getAge(birthDate: string | null) {
    if (!birthDate) return null
    const diff = Date.now() - new Date(birthDate).getTime()
    const years = Math.floor(diff / (365.25 * 86400000))
    const months = Math.floor((diff % (365.25 * 86400000)) / (30.44 * 86400000))
    if (years > 0) return `${years}살 ${months}개월`
    return `${months}개월`
  }

  const saleProducts = products.filter(p => p.sale_price !== null)
  const allProducts = products

  return (
    <main className="pb-8">

      {/* ── 인사 ── */}
      <section className="px-5 pt-6 pb-2">
        <h1 className="text-lg font-black text-[#3D2B1F] tracking-tight leading-snug">
          {userName ? `${userName}님, 안녕하세요 👋` : '안녕하세요 👋'}
        </h1>
        <p className="text-xs text-[#8A7668] mt-1">오늘도 건강한 한 끼를 준비해요</p>
      </section>

      {/* ── 구독 배너 ── */}
      {subscription && (
        <section className="px-5 mt-3 mb-2">
          <Link href="/mypage/subscriptions" className="block">
            <div className="bg-[#6B7F3A] rounded-xl px-4 py-3.5 flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                <span className="text-base">🔁</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-[11px] font-bold">정기배송 진행 중</div>
                <div className="text-white/70 text-[10px] mt-0.5 truncate">
                  {subscription.subscription_items?.[0]?.product_name}
                  {subscription.next_delivery_date && (
                    <> · 다음 {new Date(subscription.next_delivery_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</>
                  )}
                </div>
              </div>
              <span className="text-white/50 text-xs">→</span>
            </div>
          </Link>
        </section>
      )}

      {/* ── 내 강아지 ── */}
      <section className="px-5 mt-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-black text-[#3D2B1F]">내 아이들</h2>
          {dogs.length > 0 && (
            <Link href="/dogs" className="text-[11px] text-[#8A7668] font-bold">전체보기 →</Link>
          )}
        </div>

        {dogs.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {dogs.map((dog) => (
              <Link
                key={dog.id}
                href={`/dogs/${dog.id}`}
                className="flex-shrink-0 bg-white rounded-xl border border-[#EDE6D8] hover:border-[#A0452E]/50 transition-all"
                style={{ width: '120px' }}
              >
                <div className="flex flex-col items-center py-4 px-3">
                  <div className="w-12 h-12 bg-[#F5F0E6] rounded-full flex items-center justify-center text-[24px] mb-2.5">
                    🐕
                  </div>
                  <div className="font-bold text-[13px] text-[#3D2B1F] truncate w-full text-center">{dog.name}</div>
                  <div className="text-[10px] text-[#8A7668] mt-1 truncate w-full text-center">
                    {[dog.breed, dog.weight ? `${dog.weight}kg` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
              </Link>
            ))}
            <Link
              href="/dogs/new"
              className="flex-shrink-0 rounded-xl border-2 border-dashed border-[#EDE6D8] hover:border-[#A0452E]/50 transition-all"
              style={{ width: '120px' }}
            >
              <div className="flex flex-col items-center justify-center py-4 px-3 h-full">
                <div className="w-12 h-12 bg-[#F5F0E6] rounded-full flex items-center justify-center text-lg text-[#8A7668] mb-2.5">+</div>
                <div className="text-[11px] font-bold text-[#8A7668]">추가하기</div>
              </div>
            </Link>
          </div>
        ) : (
          <Link href="/dogs/new" className="block">
            <div className="bg-white rounded-xl border-2 border-dashed border-[#EDE6D8] px-5 py-6 text-center hover:border-[#A0452E]/50 transition-all">
              <div className="text-3xl mb-2">🐕</div>
              <div className="font-bold text-[13px] text-[#3D2B1F]">우리 아이를 등록해 보세요</div>
              <div className="text-[11px] text-[#8A7668] mt-1">맞춤 영양 분석과 제품 추천을 받을 수 있어요</div>
            </div>
          </Link>
        )}
      </section>

      {/* ── 카테고리 ── */}
      <section className="px-5 mb-6">
        <h2 className="text-[13px] font-black text-[#3D2B1F] mb-3">카테고리</h2>
        <div className="grid grid-cols-3 gap-2.5">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.key}
              href={`/products?category=${encodeURIComponent(cat.key)}`}
              className="bg-white rounded-xl border border-[#EDE6D8] py-4 px-2 text-center hover:border-[#3D2B1F] hover:-translate-y-0.5 transition-all"
            >
              <div className="text-[28px] leading-none mb-2">{cat.emoji}</div>
              <div className="text-[12px] font-bold text-[#3D2B1F]">{cat.label}</div>
              <div className="text-[9px] text-[#8A7668] mt-0.5">{cat.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 할인 상품 (가로 스크롤) ── */}
      {saleProducts.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between px-5 mb-3">
            <h2 className="text-[13px] font-black text-[#3D2B1F]">🔥 지금 할인 중</h2>
            <Link href="/products" className="text-[11px] text-[#8A7668] font-bold">전체보기 →</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 pl-5 pr-5 scrollbar-hide">
            {saleProducts.map((p) => {
              const discount = Math.round(((p.price - (p.sale_price ?? p.price)) / p.price) * 100)
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.slug}`}
                  className="flex-shrink-0 bg-white rounded-xl border border-[#EDE6D8] overflow-hidden hover:border-[#3D2B1F] hover:-translate-y-0.5 transition-all"
                  style={{ width: '160px' }}
                >
                  <div className="relative overflow-hidden bg-[#F5F0E6]" style={{ width: '160px', height: '160px' }}>
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        {p.category === '간식' ? '🍪' : p.category === '체험팩' ? '📦' : '🍲'}
                      </div>
                    )}
                    {discount > 0 && (
                      <div className="absolute top-2 left-2 bg-[#A0452E] text-white text-[10px] font-black px-1.5 py-0.5 rounded-md">
                        {discount}%
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="text-[11px] text-[#3D2B1F] font-bold leading-snug line-clamp-2 min-h-[30px]">
                      {p.name}
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-1">
                      <span className="text-[14px] font-black text-[#A0452E]">
                        {(p.sale_price ?? p.price).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-[#8A7668]">원</span>
                    </div>
                    <div className="text-[10px] text-[#8A7668] line-through leading-none">
                      {p.price.toLocaleString()}원
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ── 전체 상품 (2열 그리드) ── */}
      <section className="px-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-black text-[#3D2B1F]">전체 상품</h2>
          <Link href="/products" className="text-[11px] text-[#8A7668] font-bold">전체보기 →</Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {allProducts.slice(0, 6).map((p) => {
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
                <div className="aspect-square bg-[#F5F0E6] relative overflow-hidden">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-16 h-16 bg-[#EDE6D8] rounded-full flex items-center justify-center text-3xl">
                        {p.category === '간식' ? '🍪' : p.category === '체험팩' ? '📦' : '🍲'}
                      </div>
                    </div>
                  )}
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
                {/* 구분선 + 텍스트 영역 — 여유 패딩 */}
                <div className="border-t border-[#EDE6D8] px-4 py-3.5">
                  <div className="text-[11px] text-[#3D2B1F] font-bold leading-snug line-clamp-2 min-h-[30px]">
                    {p.name}
                  </div>
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
      </section>

     {/* ── 영양 분석 CTA ── */}
      {dogs.length > 0 && (
        <section className="px-5 mb-5">
          <Link href="/dogs" className="block">
            <div className="bg-[#3D2B1F] rounded-xl px-7 py-7">
              <div className="text-[#D4B872] text-[10px] font-bold uppercase tracking-widest">맞춤 영양 분석</div>
              <div className="text-white font-black text-[16px] leading-snug mt-2">
                우리 아이에게 딱 맞는<br />영양 밸런스를 확인해 보세요
              </div>
              <div className="mt-4 inline-block bg-white/15 text-white text-[11px] font-bold px-4 py-2 rounded-lg">
                분석 시작하기 →
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* ── 브랜드 소개 ── */}
      <section className="px-5 mb-4">
        <div className="bg-white rounded-xl border border-[#EDE6D8] px-5 py-5">
          <div className="text-[10px] text-[#8A7668] font-bold uppercase tracking-widest">Farm to Tail</div>
          <p className="text-[13px] text-[#3D2B1F] font-bold mt-2">
            농장에서 꼬리까지.
          </p>
          <p className="text-[11px] text-[#8A7668] mt-1.5 leading-relaxed">
            수의영양학 기반 레시피로 만든 프리미엄 반려견 식품.
            건강한 매일을 파머스테일이 함께합니다.
          </p>
        </div>
      </section>

    </main>
  )
}