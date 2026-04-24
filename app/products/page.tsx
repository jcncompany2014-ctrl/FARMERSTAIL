'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  Soup,
  Cookie,
  PackageOpen,
  ArrowUpRight,
  Sparkles,
  Leaf,
  ShieldCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StockBadge, StockOverlay } from '@/components/ui/StockBadge'
import SearchBar from '@/components/SearchBar'

/**
 * /products — 공개 카탈로그.
 *
 * 톤: landing의 editorial 언어(kicker + serif + tint 블록 + corner ticks)와
 * 이어붙는다. 목록은 두 층으로 조판한다:
 *   • Feature — 기본 정렬 1위 제품을 매거진 히어로 카드로 주인공화
 *     (카테고리 '전체' 탭에서만 보여 소음을 줄인다)
 *   • Grid — 나머지는 2열 포트레이트 카드
 *
 * 색은 모두 토큰 (--ink, --bg, --bg-2, --terracotta, --muted, --rule,
 * --rule-2, --moss, --sale, --text) 경유 — Phase 5와 같은 규칙.
 *
 * 구조는 'use client' 유지 — 기존 catalog fetch + 카테고리 필터링 흐름을
 * 그대로 보존한다. SSR 전환은 SEO 개선 작업으로 분리.
 */

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
  /** 재고. PLP에서 품절 뱃지/오버레이, 재고 소량 뱃지에 사용. */
  stock: number
}

const CATEGORIES = ['전체', '화식', '간식', '체험팩'] as const
type Category = (typeof CATEGORIES)[number]

// landing과 동일한 tint 팔레트 — 이미지가 없을 때 카드 배경에 순환 적용.
const PRODUCT_TINTS = [
  '#E4DBC2',
  '#C9D5B0',
  '#E8C9B2',
  '#D9CFBB',
  '#EFD9A8',
]

// 카테고리별 placeholder 아이콘 (이미지 없을 때만).
// React 19의 static-components 규칙 때문에 컴포넌트 참조를 변수에 담아
// 렌더하면 안 된다 — JSX 요소를 직접 반환한다.
function renderCategoryIcon(
  category: string | null,
  { size, opacity = 0.35 }: { size: number; opacity?: number }
) {
  const shared = {
    strokeWidth: 1.2,
    color: 'var(--ink)',
    style: { opacity, width: size, height: size },
  }
  if (category === '간식') return <Cookie {...shared} />
  if (category === '체험팩') return <PackageOpen {...shared} />
  return <Soup {...shared} />
}

export default function ProductsPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const initialCat = (searchParams.get('category') as Category) || '전체'

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<Category>(
    CATEGORIES.includes(initialCat as Category) ? initialCat : '전체'
  )
  // Search query — SearchBar가 URL 의 ?q= 와 양방향 동기화. 여기선 필터용으로만.
  const [query, setQuery] = useState<string>(searchParams.get('q') ?? '')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('products')
        .select(
          'id, name, slug, short_description, price, sale_price, category, is_subscribable, image_url, stock'
        )
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      if (data) setProducts(data)
      setLoading(false)
    }
    load()
  }, [supabase])

  const filtered = useMemo(() => {
    const base =
      category === '전체'
        ? products
        : products.filter((p) => p.category === category)
    const q = query.trim().toLowerCase()
    if (!q) return base
    // name + short_description 대상으로 부분 일치. 한글은 대소문자 영향 없고
    // toLowerCase 는 영문 상품명/영양소 키워드 (예: "DHA") 대응용.
    return base.filter((p) => {
      if (p.name.toLowerCase().includes(q)) return true
      if (p.short_description?.toLowerCase().includes(q)) return true
      return false
    })
  }, [products, category, query])

  const isSearching = query.trim().length > 0

  // Feature 제품 — '전체' 탭에서만, sort_order 1위를 주인공으로.
  // 나머지는 grid로 넘어간다. 카테고리 필터 중에도, 검색 중에도 feature 없이
  // 그리드만 보여줘 소음을 줄인다 (주인공 편집은 '일반 탐색' 맥락에서만 의미).
  const featured =
    category === '전체' && !isSearching && filtered.length > 0
      ? filtered[0]
      : null
  const restForGrid = featured ? filtered.slice(1) : filtered

  return (
    <main className="pb-10" style={{ background: 'var(--bg)' }}>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="px-5 pt-10 pb-7 text-center">
        <span className="kicker">Catalog · 제품 카탈로그</span>
        <h1
          className="font-serif mt-3"
          style={{
            fontSize: 30,
            lineHeight: 1.15,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          농장에서 꼬리까지
        </h1>
        <p
          className="mx-auto mt-3 text-[12px] leading-relaxed max-w-[280px]"
          style={{ color: 'var(--muted)' }}
        >
          수의영양학 기반의 프리미엄 반려견 식단. 사람이 먹는 등급의 재료로,
          정성껏 준비합니다.
        </p>

        {/* Manifesto trio — 가치 3축 */}
        <div className="mt-5 grid grid-cols-3 gap-2 max-w-[360px] mx-auto">
          {[
            { icon: Leaf, tone: 'var(--moss)', label: '국내산 재료' },
            { icon: ShieldCheck, tone: 'var(--ink)', label: '수의사 설계' },
            { icon: Sparkles, tone: 'var(--terracotta)', label: '사람 등급' },
          ].map(({ icon: Icon, tone, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1.5 py-2 rounded-xl"
              style={{
                background: 'var(--bg-2)',
                boxShadow: 'inset 0 0 0 1px var(--rule)',
              }}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={2} color={tone} />
              <span
                className="text-[10.5px] font-bold"
                style={{ color: 'var(--text)' }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Search — WebSite JSON-LD 의 SearchAction target 과 연결. 값 변화는
            debounce 후 URL 의 q 로 동기화되어 공유/뒤로가기가 깨지지 않는다. */}
        <div className="mt-5 max-w-[360px] mx-auto">
          <SearchBar
            placeholder="제품명·설명으로 검색"
            onChange={setQuery}
          />
        </div>
      </section>

      {/* ── Chapter nav · 카테고리 ──────────────────────────── */}
      <section className="px-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="kicker">Chapters · 카테고리</span>
          <div
            className="flex-1 h-px"
            style={{ background: 'var(--rule-2)' }}
          />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {CATEGORIES.map((c, i) => {
            const active = category === c
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className="relative flex flex-col items-center justify-center py-3 rounded-xl transition active:scale-[0.97]"
                style={{
                  background: active ? 'var(--ink)' : 'var(--bg-2)',
                  color: active ? 'var(--bg)' : 'var(--text)',
                  boxShadow: active
                    ? '0 4px 14px rgba(30,26,20,0.18)'
                    : 'inset 0 0 0 1px var(--rule)',
                }}
              >
                <span
                  className="kicker"
                  style={{
                    color: active ? 'var(--gold)' : 'var(--terracotta)',
                    fontSize: 9,
                  }}
                >
                  Ch {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className="font-serif font-black mt-1 text-[13px] leading-none"
                  style={{ letterSpacing: '-0.01em' }}
                >
                  {c}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Product count — kicker 톤. 검색 중엔 '카테고리' 대신 쿼리 echo. */}
      {!loading && (
        <div className="px-5 mt-5 flex items-baseline justify-between gap-3">
          <span className="kicker kicker-muted truncate">
            {filtered.length} Results
            {isSearching
              ? ` · "${query.trim()}"`
              : ` · ${category}`}
          </span>
          {(category !== '전체' || isSearching) && (
            <button
              onClick={() => setCategory('전체')}
              className="text-[10.5px] font-bold underline underline-offset-2 shrink-0"
              style={{ color: 'var(--terracotta)' }}
            >
              전체 보기
            </button>
          )}
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div
            className="w-7 h-7 border-2 rounded-full animate-spin"
            style={{
              borderColor: 'var(--terracotta)',
              borderTopColor: 'transparent',
            }}
          />
        </div>
      )}

      {/* ── Empty ────────────────────────────────────────── */}
      {!loading && filtered.length === 0 && (
        <div className="px-5 mt-6">
          <div
            className="rounded-2xl py-14 px-6 flex flex-col items-center text-center"
            style={{
              background: 'var(--bg-2)',
              border: '1px dashed var(--rule-2)',
            }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{ background: 'var(--bg)' }}
            >
              <Search
                className="w-5 h-5"
                strokeWidth={1.8}
                color="var(--muted)"
              />
            </div>
            <span className="kicker kicker-muted">
              {isSearching ? 'No match · 검색 결과 없음' : 'Empty · 비어 있음'}
            </span>
            <p
              className="font-serif mt-2 text-[15px] font-black"
              style={{ color: 'var(--text)' }}
            >
              {isSearching
                ? '검색어와 일치하는 상품이 없어요'
                : '해당 카테고리에 상품이 없어요'}
            </p>
            {isSearching && (
              <p
                className="mt-2 text-[11.5px] leading-relaxed"
                style={{ color: 'var(--muted)' }}
              >
                다른 단어로 시도하거나 전체 카테고리에서 둘러보세요.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Feature card ─────────────────────────────────── */}
      {!loading && featured && (
        <section className="px-5 mt-7">
          <div className="flex items-center gap-2 mb-3">
            <span className="kicker" style={{ color: 'var(--terracotta)' }}>
              Featured · 이달의 주목
            </span>
            <div
              className="flex-1 h-px"
              style={{ background: 'var(--rule-2)' }}
            />
          </div>
          <FeatureCard product={featured} tint={PRODUCT_TINTS[0]} />
        </section>
      )}

      {/* ── Grid ───────────────────────────────────────── */}
      {!loading && restForGrid.length > 0 && (
        <section className="px-5 mt-7">
          {featured && (
            <div className="flex items-center gap-2 mb-3">
              <span className="kicker kicker-muted">More · 더 보기</span>
              <div
                className="flex-1 h-px"
                style={{ background: 'var(--rule-2)' }}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {restForGrid.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                tint={PRODUCT_TINTS[(i + (featured ? 1 : 0)) % PRODUCT_TINTS.length]}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Footer manifesto ─────────────────────────────── */}
      {!loading && (
        <section className="px-5 mt-10">
          <div
            className="rounded-2xl px-6 py-7 text-center"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}
          >
            <span className="kicker kicker-gold">
              Farm to Tail · 농장에서 꼬리까지
            </span>
            <p
              className="font-serif mt-3 text-[18px] font-black leading-tight"
              style={{ letterSpacing: '-0.01em' }}
            >
              좋은 재료, 정직한 조리.
              <br />그 이상은 없습니다.
            </p>
            <p
              className="mt-3 text-[11.5px] leading-relaxed"
              style={{ color: 'rgba(245,240,230,0.7)' }}
            >
              파머스테일은 국내 농가와 직접 소싱한 사람 등급 재료만을 사용합니다.
              수의영양학 팀이 설계한 레시피로, 주 단위 소량 생산합니다.
            </p>
            <Link
              href="/about"
              className="inline-flex items-center gap-1 mt-4 text-[11px] font-bold"
              style={{ color: 'var(--gold)' }}
            >
              브랜드 이야기
              <ArrowUpRight className="w-3 h-3" strokeWidth={2.5} />
            </Link>
          </div>
        </section>
      )}
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────

function priceParts(p: Product) {
  const hasSale = p.sale_price !== null
  const effectivePrice = p.sale_price ?? p.price
  const discount = hasSale
    ? Math.round(((p.price - effectivePrice) / p.price) * 100)
    : 0
  return { hasSale, effectivePrice, discount }
}

function FeatureCard({
  product,
  tint,
}: {
  product: Product
  tint: string
}) {
  const { hasSale, effectivePrice, discount } = priceParts(product)

  return (
    <Link
      href={`/products/${product.slug}`}
      className="block rounded-2xl overflow-hidden transition hover:shadow-md active:scale-[0.99]"
      style={{
        background: 'var(--bg-2)',
        boxShadow: 'inset 0 0 0 1px var(--rule)',
      }}
    >
      {/* 큰 이미지 영역 — aspect 5/4로 가로가 조금 더 긴 히어로 비율 */}
      <div
        className="aspect-[5/4] relative overflow-hidden"
        style={{ background: tint }}
      >
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {renderCategoryIcon(product.category, { size: 64 })}
          </div>
        )}

        {/* 뱃지들 */}
        <div className="absolute top-3 left-3 flex gap-1.5 z-10">
          {hasSale && discount > 0 && (
            <span
              className="text-[10px] font-black px-2 py-0.5 rounded-full"
              style={{ background: 'var(--sale)', color: 'var(--bg)' }}
            >
              {discount}% OFF
            </span>
          )}
          {product.is_subscribable && (
            <span
              className="text-[9.5px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--moss)', color: 'var(--bg)' }}
            >
              정기배송
            </span>
          )}
          {/* 재고 소량(low)일 때만 inline 뱃지. 품절은 아래 StockOverlay가 커버. */}
          <StockBadge stock={product.stock} placement="inline" showCount />
        </div>

        {/* Sold-out overlay — 이미지 전체를 덮음. stock > 0이면 아무것도 렌더 안 함. */}
        <StockOverlay stock={product.stock} />

        {/* category kicker — 이미지 상단 오른쪽 */}
        {product.category && (
          <span
            className="absolute top-3 right-3 kicker"
            style={{
              color: 'var(--ink)',
              background: 'rgba(245,240,230,0.85)',
              padding: '3px 8px',
              borderRadius: 999,
              fontSize: 9,
            }}
          >
            {product.category}
          </span>
        )}
      </div>

      {/* 텍스트 영역 */}
      <div
        className="px-5 py-5"
        style={{ borderTop: '1px solid var(--rule)' }}
      >
        <h2
          className="font-serif text-[18px] font-black leading-tight"
          style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}
        >
          {product.name}
        </h2>
        {product.short_description && (
          <p
            className="text-[12px] mt-1.5 leading-relaxed line-clamp-2"
            style={{ color: 'var(--muted)' }}
          >
            {product.short_description}
          </p>
        )}

        <div className="mt-4 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            {hasSale && (
              <span
                className="text-[11px] line-through"
                style={{ color: 'var(--muted)' }}
              >
                {product.price.toLocaleString()}원
              </span>
            )}
            <span
              className="font-serif text-[22px] font-black leading-none"
              style={{
                color: hasSale ? 'var(--sale)' : 'var(--ink)',
                letterSpacing: '-0.01em',
              }}
            >
              {effectivePrice.toLocaleString()}
            </span>
            <span
              className="text-[10.5px] font-semibold"
              style={{ color: 'var(--muted)' }}
            >
              원
            </span>
          </div>
          <span
            className="inline-flex items-center gap-1 text-[11px] font-bold"
            style={{ color: 'var(--terracotta)' }}
          >
            자세히
            <ArrowUpRight className="w-3 h-3" strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </Link>
  )
}

function ProductCard({ product, tint }: { product: Product; tint: string }) {
  const { hasSale, effectivePrice, discount } = priceParts(product)

  return (
    <Link
      href={`/products/${product.slug}`}
      className="block rounded-xl overflow-hidden transition active:scale-[0.98] hover:shadow-sm"
      style={{
        background: 'var(--bg-2)',
        boxShadow: 'inset 0 0 0 1px var(--rule)',
      }}
    >
      <div
        className="aspect-[4/5] relative overflow-hidden"
        style={{ background: tint }}
      >
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {renderCategoryIcon(product.category, { size: 40 })}
          </div>
        )}

        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
          {hasSale && discount > 0 && (
            <span
              className="text-[9.5px] font-black px-1.5 py-0.5 rounded-md"
              style={{ background: 'var(--sale)', color: 'var(--bg)' }}
            >
              {discount}%
            </span>
          )}
          {product.is_subscribable && (
            <span
              className="text-[8.5px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: 'var(--moss)', color: 'var(--bg)' }}
            >
              정기배송
            </span>
          )}
        </div>
      </div>

      <div
        className="px-3.5 py-3"
        style={{ borderTop: '1px solid var(--rule)' }}
      >
        {product.category && (
          <span
            className="kicker kicker-muted"
            style={{ fontSize: 9 }}
          >
            {product.category}
          </span>
        )}
        <h3
          className="font-serif text-[13px] font-black leading-tight mt-1 line-clamp-2 min-h-[32px]"
          style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}
        >
          {product.name}
        </h3>
        <div className="mt-2.5 flex items-baseline gap-1">
          <span
            className="font-serif text-[15px] font-black leading-none"
            style={{
              color: hasSale ? 'var(--sale)' : 'var(--ink)',
              letterSpacing: '-0.01em',
            }}
          >
            {effectivePrice.toLocaleString()}
          </span>
          <span
            className="text-[10px] font-semibold"
            style={{ color: 'var(--muted)' }}
          >
            원
          </span>
        </div>
        {hasSale && (
          <div
            className="text-[10px] line-through leading-none mt-0.5"
            style={{ color: 'var(--muted)' }}
          >
            {product.price.toLocaleString()}원
          </div>
        )}
      </div>
    </Link>
  )
}
