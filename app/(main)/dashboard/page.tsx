'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Soup,
  Cookie,
  PackageOpen,
  Flame,
  Repeat,
  ArrowRight,
  Dog,
  Plus,
  ChevronRight,
  Leaf,
  Truck,
  BookOpen,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ReferralAutoRedeemer from '@/components/ReferralAutoRedeemer'

type DogRow = {
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
  { key: '화식', label: '화식', Icon: Soup, desc: '건강한 한 끼' },
  { key: '간식', label: '간식', Icon: Cookie, desc: '특별한 보상' },
  { key: '체험팩', label: '체험팩', Icon: PackageOpen, desc: '처음이라면' },
]

function ProductFallback({ category }: { category: string | null }) {
  const Icon =
    category === '간식' ? Cookie : category === '체험팩' ? PackageOpen : Soup
  return (
    <div className="w-full h-full flex items-center justify-center">
      <Icon
        className="w-10 h-10"
        style={{ color: 'var(--muted)' }}
        strokeWidth={1.2}
      />
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [userName, setUserName] = useState<string | null>(null)
  const [dogs, setDogs] = useState<DogRow[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

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
        .select(
          'id, name, slug, price, sale_price, image_url, category, short_description, is_subscribable'
        )
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(10)
      if (prodData) setProducts(prodData)

      const { data: subData } = await supabase
        .from('subscriptions')
        .select(
          'id, status, next_delivery_date, subscription_items(product_name)'
        )
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
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--terracotta)', borderTopColor: 'transparent' }}
        />
      </main>
    )
  }

  const saleProducts = products.filter((p) => p.sale_price !== null)
  const allProducts = products

  return (
    <main className="pb-8">
      {/* Fires at most once per session: consumes a pending referral
          code stashed during the Kakao OAuth signup roundtrip. */}
      <ReferralAutoRedeemer />

      {/* ── 인사 — kicker + serif h1, landing/auth와 동일 조판 언어 ── */}
      <section className="px-5 pt-6 pb-2">
        <span className="kicker">Good day · 오늘의 한 끼</span>
        <h1
          className="font-serif mt-2 leading-snug"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          {userName ? `${userName}님,` : ''}
          <br />
          안녕하세요.
        </h1>
        <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
          오늘도 건강한 한 끼를 준비해요
        </p>
      </section>

      {/* ── 다음 배송 히어로 (D-N 강조) ── */}
      {subscription && subscription.next_delivery_date && (
        <section className="px-5 mt-4">
          <Link
            href="/mypage/subscriptions"
            className="block rounded-2xl px-5 py-5 shadow-sm hover:shadow-md transition-all"
            style={{
              background:
                'linear-gradient(to bottom right, var(--moss), #556828)',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Truck className="w-3.5 h-3.5 text-white/80" strokeWidth={2} />
                <span className="kicker kicker-white">Next Delivery</span>
              </div>
              <Repeat className="w-4 h-4 text-white/60" strokeWidth={2} />
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              {(() => {
                const target = new Date(subscription.next_delivery_date)
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                target.setHours(0, 0, 0, 0)
                const diff = Math.round(
                  (target.getTime() - today.getTime()) / 86400000
                )
                const label =
                  diff === 0
                    ? '오늘'
                    : diff > 0
                      ? `D-${diff}`
                      : `${Math.abs(diff)}일 경과`
                return (
                  <>
                    <span
                      className="font-serif text-white leading-none"
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {label}
                    </span>
                    <span className="text-white/70 text-[11px] font-semibold">
                      {target.toLocaleDateString('ko-KR', {
                        month: 'long',
                        day: 'numeric',
                        weekday: 'short',
                      })}
                    </span>
                  </>
                )
              })()}
            </div>
            <div className="mt-2 text-white/80 text-[11px] truncate">
              {subscription.subscription_items?.[0]?.product_name}
              {subscription.subscription_items?.length > 1 &&
                ` 외 ${subscription.subscription_items.length - 1}개`}
            </div>
          </Link>
        </section>
      )}

      {/* ── 내 강아지 ── */}
      <section className="px-5 mt-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2
            className="font-serif"
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.015em',
            }}
          >
            내 아이들
          </h2>
          {dogs.length > 0 && (
            <Link
              href="/dogs"
              className="text-[11px] font-semibold"
              style={{ color: 'var(--muted)' }}
            >
              전체보기 →
            </Link>
          )}
        </div>

        {dogs.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {dogs.map((dog) => (
              <Link
                key={dog.id}
                href={`/dogs/${dog.id}`}
                className="flex-shrink-0 bg-white rounded-2xl hover:shadow-sm transition-all"
                style={{
                  width: '120px',
                  border: '1px solid var(--rule)',
                }}
              >
                <div className="flex flex-col items-center py-4 px-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mb-2.5"
                    style={{ background: 'var(--bg)' }}
                  >
                    <Dog
                      className="w-5 h-5"
                      style={{ color: 'var(--muted)' }}
                      strokeWidth={1.5}
                    />
                  </div>
                  <div
                    className="font-bold text-[13px] truncate w-full text-center"
                    style={{ color: 'var(--ink)' }}
                  >
                    {dog.name}
                  </div>
                  <div
                    className="text-[10px] mt-1 truncate w-full text-center"
                    style={{ color: 'var(--muted)' }}
                  >
                    {[dog.breed, dog.weight ? `${dog.weight}kg` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
              </Link>
            ))}
            <Link
              href="/dogs/new"
              className="flex-shrink-0 rounded-2xl border border-dashed transition-all"
              style={{
                width: '120px',
                borderColor: 'var(--rule-2)',
              }}
            >
              <div className="flex flex-col items-center justify-center py-4 px-3 h-full">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-2.5"
                  style={{ background: 'var(--bg)' }}
                >
                  <Plus
                    className="w-5 h-5"
                    style={{ color: 'var(--muted)' }}
                    strokeWidth={1.5}
                  />
                </div>
                <div
                  className="text-[11px] font-semibold"
                  style={{ color: 'var(--muted)' }}
                >
                  추가하기
                </div>
              </div>
            </Link>
          </div>
        ) : (
          // Empty-state — 에디토리얼 톤으로 통일. 가득 찬 글래스모피즘 배경
          // 대신, paper-tone 지면 위에 kicker + serif 헤드라인 + ink CTA로
          // 정리한다. onboarding 마지막 슬라이드와 같은 문법.
          <Link href="/dogs/new" className="block">
            <div
              className="relative overflow-hidden rounded-2xl border border-dashed px-5 py-9 text-center transition-all hover:shadow-sm"
              style={{
                background: 'var(--bg-2)',
                borderColor: 'var(--rule-2)',
              }}
            >
              <div
                className="inline-flex w-14 h-14 rounded-full items-center justify-center mb-3"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--rule-2)',
                }}
              >
                <Dog
                  className="w-6 h-6"
                  style={{ color: 'var(--terracotta)' }}
                  strokeWidth={1.5}
                />
              </div>
              <span className="kicker">First Dog · 시작하기</span>
              <div
                className="font-serif mt-2"
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: 'var(--ink)',
                  letterSpacing: '-0.015em',
                }}
              >
                우리 아이를 등록해
                보세요
              </div>
              <div
                className="text-[11px] mt-2 leading-relaxed"
                style={{ color: 'var(--muted)' }}
              >
                맞춤 영양 분석과 제품 추천을 받을 수 있어요
              </div>
              <div
                className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-bold px-5 py-2.5 rounded-full"
                style={{
                  background: 'var(--ink)',
                  color: 'var(--bg)',
                  letterSpacing: '-0.01em',
                }}
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                등록 시작하기
              </div>
            </div>
          </Link>
        )}
      </section>

      {/* ── 카테고리 ── */}
      <section className="px-5 mb-8">
        <div className="mb-2.5">
          <span className="kicker kicker-muted">Categories</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {CATEGORIES.map(({ key, label, Icon, desc }) => (
            <Link
              key={key}
              href={`/products?category=${encodeURIComponent(key)}`}
              className="bg-white rounded-2xl py-5 px-2 text-center transition-all"
              style={{ border: '1px solid var(--rule)' }}
            >
              <Icon
                className="w-6 h-6 mx-auto mb-3"
                style={{ color: 'var(--ink)' }}
                strokeWidth={1.5}
              />
              <div
                className="text-[12px] font-bold"
                style={{ color: 'var(--ink)' }}
              >
                {label}
              </div>
              <div
                className="text-[9px] mt-0.5"
                style={{ color: 'var(--muted)' }}
              >
                {desc}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 할인 상품 (가로 스크롤) ── */}
      {saleProducts.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between px-5 mb-3">
            <div className="flex items-center gap-2">
              <Flame
                className="w-4 h-4"
                style={{ color: 'var(--terracotta)' }}
                strokeWidth={2}
              />
              <h2
                className="font-serif"
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: 'var(--ink)',
                  letterSpacing: '-0.015em',
                }}
              >
                지금 할인 중
              </h2>
            </div>
            <Link
              href="/products"
              className="text-[11px] font-semibold"
              style={{ color: 'var(--muted)' }}
            >
              전체보기 →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 pl-5 pr-5 scrollbar-hide">
            {saleProducts.map((p) => {
              const discount = Math.round(
                ((p.price - (p.sale_price ?? p.price)) / p.price) * 100
              )
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.slug}`}
                  className="flex-shrink-0 bg-white rounded-2xl overflow-hidden transition-all"
                  style={{
                    width: '160px',
                    border: '1px solid var(--rule)',
                  }}
                >
                  <div
                    className="relative overflow-hidden"
                    style={{
                      width: '160px',
                      height: '160px',
                      background: 'var(--bg)',
                    }}
                  >
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ProductFallback category={p.category} />
                    )}
                    {discount > 0 && (
                      <div
                        className="absolute top-2 left-2 text-white text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--terracotta)' }}
                      >
                        -{discount}%
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2.5">
                    <div
                      className="text-[11px] font-semibold leading-snug line-clamp-2 min-h-[30px]"
                      style={{ color: 'var(--ink)' }}
                    >
                      {p.name}
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-1">
                      <span
                        className="font-serif text-[15px] font-black"
                        style={{ color: 'var(--terracotta)' }}
                      >
                        {(p.sale_price ?? p.price).toLocaleString()}
                      </span>
                      <span
                        className="text-[10px]"
                        style={{ color: 'var(--muted)' }}
                      >
                        원
                      </span>
                    </div>
                    <div
                      className="text-[10px] line-through leading-none"
                      style={{ color: 'var(--muted)' }}
                    >
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
      <section className="px-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2
            className="font-serif"
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.015em',
            }}
          >
            전체 상품
          </h2>
          <Link
            href="/products"
            className="text-[11px] font-semibold"
            style={{ color: 'var(--muted)' }}
          >
            전체보기 →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {allProducts.slice(0, 6).map((p) => {
            const hasSale = p.sale_price !== null
            const discount = hasSale
              ? Math.round(
                  ((p.price - (p.sale_price ?? p.price)) / p.price) * 100
                )
              : 0
            return (
              <Link
                key={p.id}
                href={`/products/${p.slug}`}
                className="group bg-white rounded-2xl overflow-hidden transition-all"
                style={{ border: '1px solid var(--rule)' }}
              >
                <div
                  className="aspect-square relative overflow-hidden"
                  style={{ background: 'var(--bg)' }}
                >
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                  ) : (
                    <ProductFallback category={p.category} />
                  )}
                  {hasSale && discount > 0 && (
                    <div
                      className="absolute top-2 left-2 text-white text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--terracotta)' }}
                    >
                      -{discount}%
                    </div>
                  )}
                  {p.is_subscribable && (
                    <div
                      className="absolute top-2 right-2 text-white text-[9px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--moss)' }}
                    >
                      정기배송
                    </div>
                  )}
                </div>
                <div className="px-4 py-3.5">
                  {p.category && (
                    <div
                      className="text-[10px] font-semibold uppercase tracking-[0.15em]"
                      style={{ color: 'var(--muted)' }}
                    >
                      {p.category}
                    </div>
                  )}
                  <div
                    className="mt-1 text-[12px] font-semibold leading-snug line-clamp-2 min-h-[32px]"
                    style={{ color: 'var(--ink)' }}
                  >
                    {p.name}
                  </div>
                  {hasSale ? (
                    <div className="mt-2">
                      <div className="flex items-baseline gap-1">
                        <span
                          className="font-serif text-[16px] font-black"
                          style={{ color: 'var(--terracotta)' }}
                        >
                          {(p.sale_price ?? p.price).toLocaleString()}
                        </span>
                        <span
                          className="text-[10px]"
                          style={{ color: 'var(--muted)' }}
                        >
                          원
                        </span>
                      </div>
                      <div
                        className="text-[10px] line-through leading-none mt-0.5"
                        style={{ color: 'var(--muted)' }}
                      >
                        {p.price.toLocaleString()}원
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-baseline gap-1">
                      <span
                        className="font-serif text-[16px] font-black"
                        style={{ color: 'var(--ink)' }}
                      >
                        {p.price.toLocaleString()}
                      </span>
                      <span
                        className="text-[10px]"
                        style={{ color: 'var(--muted)' }}
                      >
                        원
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── 매거진 CTA ── */}
      <section className="px-5 mb-6">
        <Link
          href="/blog"
          className="group block bg-white rounded-2xl transition overflow-hidden"
          style={{ border: '1px solid var(--rule)' }}
        >
          <div className="flex items-center gap-4 px-5 py-5">
            <div
              className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg)' }}
            >
              <BookOpen
                className="w-5 h-5"
                style={{ color: 'var(--terracotta)' }}
                strokeWidth={1.75}
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className="kicker">Magazine</span>
              <div
                className="font-serif mt-1 leading-snug"
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: 'var(--ink)',
                  letterSpacing: '-0.015em',
                }}
              >
                반려견 영양·건강 이야기
              </div>
              <div
                className="text-[11px] mt-0.5"
                style={{ color: 'var(--muted)' }}
              >
                파머스테일이 전하는 케어 가이드
              </div>
            </div>
            <ChevronRight
              className="w-4 h-4 group-hover:translate-x-0.5 transition"
              style={{ color: 'var(--muted)' }}
              strokeWidth={2.25}
            />
          </div>
        </Link>
      </section>

      {/* ── 영양 분석 CTA — ink 배경 + gold kicker (에디토리얼 dark panel) ── */}
      {dogs.length > 0 && (
        <section className="px-5 mb-6">
          <Link href="/dogs" className="block">
            <div
              className="rounded-2xl px-7 py-7"
              style={{ background: 'var(--ink)' }}
            >
              <span className="kicker kicker-gold">Nutrition Analysis</span>
              <div
                className="font-serif text-white leading-snug mt-2"
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: '-0.015em',
                }}
              >
                우리 아이에게 딱 맞는
                <br />
                영양 밸런스를 확인해 보세요
              </div>
              <div className="mt-4 inline-flex items-center gap-1.5 bg-white/15 text-white text-[11px] font-bold px-4 py-2 rounded-full">
                분석 시작하기
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* ── 브랜드 소개 ── */}
      <section className="px-5 mb-4">
        <div
          className="bg-white rounded-2xl px-5 py-6"
          style={{ border: '1px solid var(--rule)' }}
        >
          <div className="flex items-center gap-2">
            <Leaf
              className="w-4 h-4"
              style={{ color: 'var(--moss)' }}
              strokeWidth={1.5}
            />
            <span className="kicker kicker-moss">Farm to Tail</span>
          </div>
          <p
            className="font-serif mt-3"
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.015em',
            }}
          >
            농장에서{' '}
            꼬리까지.
          </p>
          <p
            className="text-[11px] mt-2 leading-relaxed"
            style={{ color: 'var(--muted)' }}
          >
            수의영양학 기반 레시피로 만든 프리미엄 반려견 식품. 건강한 매일을
            파머스테일이 함께합니다.
          </p>
        </div>
      </section>
    </main>
  )
}
