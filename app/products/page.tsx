import type { Metadata } from 'next'
import Link from 'next/link'
import { Search, ChevronLeft, ChevronRight, ChevronRight as Crumb } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import SearchBar from '@/components/SearchBar'
import SortSelect, { type SortKey } from '@/components/products/SortSelect'
import {
  CatalogFilterTrigger,
  CatalogFilterSidebar,
} from '@/components/products/CatalogFilters'
import ActiveFilterChips from '@/components/products/ActiveFilterChips'
import CatalogProductCard, {
  type CatalogProduct,
} from '@/components/products/CatalogProductCard'
import RecentlyViewed from '@/components/products/RecentlyViewed'
import { isAppContextServer } from '@/lib/app-context'

/**
 * /products — 카탈로그 (마켓컬리/SSF 톤 쇼핑몰).
 *
 * 레이아웃:
 *   ┌─ breadcrumb (홈 / 베스트) ─────────────────────────┐
 *   │ h1 (small) · 결과 카운트 inline · 정렬 select        │
 *   ├──────────────┬─────────────────────────────────────┤
 *   │              │ Active filter chips                  │
 *   │  Filter      │ Product grid (2~4 col)               │
 *   │  Sidebar     │ Pagination                           │
 *   │  (sticky)    │                                      │
 *   └──────────────┴─────────────────────────────────────┘
 *
 * 모바일은 사이드바 → "필터" 버튼 + bottom sheet.
 */

// 5분 ISR — 상품 카탈로그는 60s 마다 재생성할 만큼 자주 안 변함. 운영자
// admin 변경 시 revalidateTag/Path 로 즉시 무효화 가능 (출시 후 hook 추가 시).
export const revalidate = 300

const PAGE_SIZE = 12

const NEW_WINDOW_DAYS = 30

type SearchParamsT = Promise<{
  category?: string
  q?: string
  page?: string
  sort?: string
  on_sale?: string
  subscribable?: string
  price_min?: string
  price_max?: string
}>

export const metadata: Metadata = {
  title: '제품 | 파머스테일',
  description:
    '수의영양학 기반의 프리미엄 반려견 식단. 국내 농가 사람 등급 재료로 정성껏 준비합니다.',
  alternates: { canonical: '/products' },
  robots: { index: true, follow: true },
}

const ALLOWED_CATEGORIES = ['화식', '간식', '체험팩'] as const

function parseSort(raw: string | undefined): SortKey {
  switch (raw) {
    case 'new':
    case 'price_asc':
    case 'price_desc':
    case 'discount':
      return raw
    case 'best':
      return 'popular'
    default:
      return 'popular'
  }
}

function escapeIlike(q: string): string {
  return q.replace(/[\\%_,()]/g, (m) => `\\${m}`)
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParamsT
}) {
  const [raw, isApp] = await Promise.all([searchParams, isAppContextServer()])

  // ── filter / sort 파싱 ──────────────────────────────────
  const category =
    raw.category && (ALLOWED_CATEGORIES as readonly string[]).includes(raw.category)
      ? raw.category
      : ''
  const query = (raw.q ?? '').trim()
  const pageNum = Math.max(1, Number.parseInt(raw.page ?? '1', 10) || 1)
  const sortMode = parseSort(raw.sort?.toLowerCase())
  const onSaleOnly = raw.on_sale === '1'
  const subscribableOnly = raw.subscribable === '1'
  const priceMin = raw.price_min ? Number(raw.price_min) : null
  const priceMax = raw.price_max ? Number(raw.price_max) : null
  const isBest = raw.sort === 'best'

  const isSearching = query.length > 0
  const from = (pageNum - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // ── Supabase 쿼리 ───────────────────────────────────────
  const supabase = await createClient()
  let dataQuery = supabase
    .from('products')
    .select(
      'id, name, slug, short_description, price, sale_price, category, is_subscribable, image_url, stock, created_at',
      { count: 'exact' },
    )
    .eq('is_active', true)
    .range(from, to)

  // 정렬 모드별 .order 적용
  if (sortMode === 'new' || raw.sort === 'new') {
    // eslint-disable-next-line react-hooks/purity
    const nowMs = Date.now()
    const since = new Date(
      nowMs - NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString()
    dataQuery = dataQuery
      .gte('created_at', since)
      .order('created_at', { ascending: false })
  } else if (sortMode === 'price_asc') {
    dataQuery = dataQuery.order('price', { ascending: true })
  } else if (sortMode === 'price_desc') {
    dataQuery = dataQuery.order('price', { ascending: false })
  } else if (sortMode === 'discount') {
    // sale_price 가 있는 것 우선 + 큐레이션
    dataQuery = dataQuery
      .order('sale_price', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true })
  } else if (isBest) {
    // best — 실제 누적 판매량 기준. orders.payment_status='paid' 시
    // sales_count 가 자동 증가 (20260425000006_sales_count.sql 트리거).
    // 동률이면 큐레이션 sort_order 로 tiebreak.
    dataQuery = dataQuery
      .order('sales_count', { ascending: false })
      .order('sort_order', { ascending: true })
  } else {
    // popular / 기본 — 큐레이션 sort_order
    dataQuery = dataQuery.order('sort_order', { ascending: true })
  }

  if (category) dataQuery = dataQuery.eq('category', category)
  if (onSaleOnly) dataQuery = dataQuery.not('sale_price', 'is', null)
  if (subscribableOnly) dataQuery = dataQuery.eq('is_subscribable', true)
  if (priceMin !== null) dataQuery = dataQuery.gte('price', priceMin)
  if (priceMax !== null) dataQuery = dataQuery.lte('price', priceMax)
  if (isSearching) {
    const needle = `%${escapeIlike(query)}%`
    dataQuery = dataQuery.or(
      `name.ilike.${needle},short_description.ilike.${needle}`,
    )
  }

  const { data, count, error: queryErr } = await dataQuery
  if (queryErr) {
    console.error('[products] catalog query failed', {
      category,
      sort: sortMode,
      query,
      page: pageNum,
      code: queryErr.code,
      message: queryErr.message,
    })
  }
  const rows = (data ?? []) as CatalogProduct[]
  const total = count ?? rows.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // ── 헤드라인 / breadcrumb 카피 ──────────────────────────
  const isFiltered =
    !!category ||
    onSaleOnly ||
    subscribableOnly ||
    priceMin !== null ||
    priceMax !== null ||
    isSearching ||
    isBest ||
    raw.sort === 'new'

  const pageTitle = isBest
    ? '베스트'
    : raw.sort === 'new'
      ? '신상'
      : onSaleOnly
        ? '세일'
        : isSearching
          ? '검색 결과'
          : category || '전체 상품'

  // ── pagination URL builder ──────────────────────────────
  const buildPageHref = (p: number): string => {
    const sp = new URLSearchParams()
    if (category) sp.set('category', category)
    if (query) sp.set('q', query)
    if (raw.sort) sp.set('sort', raw.sort)
    if (onSaleOnly) sp.set('on_sale', '1')
    if (subscribableOnly) sp.set('subscribable', '1')
    if (priceMin !== null) sp.set('price_min', String(priceMin))
    if (priceMax !== null) sp.set('price_max', String(priceMax))
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return qs ? `/products?${qs}` : '/products'
  }

  return (
    <main
      className="pb-12 mx-auto"
      style={{ background: 'var(--bg)', maxWidth: 1280 }}
    >
      {/* ── Top toolbar: breadcrumb + h1 + count + sort ─────
          앱 컨텍스트에선 breadcrumb 생략 — 상단 헤더 + 하단 탭바가 navigation
          이미 제공. RecentlyViewed 도 앱에선 mypage 가 자체 surface. */}
      <section className="px-5 md:px-8 pt-4 md:pt-6">
        {!isApp && <Breadcrumb pageTitle={pageTitle} />}

        <div className="mt-2 md:mt-3 flex items-end justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1
              className="font-serif text-[20px] md:text-[26px]"
              style={{
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.025em',
                lineHeight: 1.1,
              }}
            >
              {pageTitle}
              <span
                className="ml-2 text-[12px] md:text-[14px] font-mono tabular-nums"
                style={{ color: 'var(--muted)', fontWeight: 500 }}
              >
                {total.toLocaleString()}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <CatalogFilterTrigger />
            <SortSelect current={sortMode} />
          </div>
        </div>

        <div className="mt-3 md:hidden">
          <SearchBar placeholder="제품명·설명으로 검색" />
        </div>
      </section>

      <hr
        className="my-4 md:my-5 mx-5 md:mx-8"
        style={{ borderColor: 'var(--rule)' }}
      />

      {/* ── 2-col layout: filter sidebar + grid ─────────────── */}
      <div className="px-5 md:px-8 md:flex md:gap-8">
        {/*
          CatalogFilters 렌더 위치:
            • 데스크톱: 사이드바는 컴포넌트 내부에서 hidden md:block 으로 자체 노출
            • 모바일: 위 toolbar 의 "필터" 버튼이 같은 컴포넌트의 sheet 트리거

          따라서 여기서는 빈 spacer 만 두고 실제 sidebar/sheet 는
          CatalogFilters 가 책임. 사이드바가 그리드 좌측에 sticky 로 떠야 하므로
          별도 grid track 을 잡지 않고 flex md 분기만 사용.
        */}
        <FilterSidebarSlot />

        <div className="flex-1 min-w-0">
          <ActiveFilterChips />

          {rows.length === 0 ? (
            <EmptyState
              isSearching={isSearching}
              isFiltered={isFiltered}
              query={query}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
                {rows.map((p, i) => {
                  const rank = isBest && pageNum === 1 ? i + 1 : null
                  const isNew = raw.sort === 'new'
                  return (
                    <CatalogProductCard
                      key={p.id}
                      product={p}
                      rank={rank}
                      isNew={isNew}
                      query={query}
                      priority={i < 4}
                    />
                  )
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <nav
                  aria-label="페이지 탐색"
                  className="mt-10 flex items-center justify-center gap-1.5"
                >
                  {pageNum > 1 ? (
                    <Link
                      href={buildPageHref(pageNum - 1)}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-md text-[13px] font-bold transition active:scale-[0.97]"
                      style={{
                        color: 'var(--text)',
                        boxShadow: 'inset 0 0 0 1px var(--rule)',
                        background: 'var(--bg)',
                      }}
                      aria-label="이전 페이지"
                    >
                      <ChevronLeft className="w-4 h-4" strokeWidth={2.4} />
                    </Link>
                  ) : (
                    <span aria-hidden className="w-9 h-9" />
                  )}

                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const p = idx + 1
                    const active = p === pageNum
                    // 압축: 1, …, current-1, current, current+1, …, total
                    const show =
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - pageNum) <= 1
                    if (!show) {
                      if (p === 2 || p === totalPages - 1) {
                        return (
                          <span
                            key={p}
                            className="text-[12px] px-1"
                            style={{ color: 'var(--muted)' }}
                          >
                            …
                          </span>
                        )
                      }
                      return null
                    }
                    return (
                      <Link
                        key={p}
                        href={buildPageHref(p)}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-md text-[13px] font-bold tabular-nums transition active:scale-[0.97]"
                        style={{
                          background: active ? 'var(--ink)' : 'var(--bg)',
                          color: active ? 'var(--bg)' : 'var(--text)',
                          boxShadow: active
                            ? 'none'
                            : 'inset 0 0 0 1px var(--rule)',
                        }}
                      >
                        {p}
                      </Link>
                    )
                  })}

                  {pageNum < totalPages ? (
                    <Link
                      href={buildPageHref(pageNum + 1)}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-md text-[13px] font-bold transition active:scale-[0.97]"
                      style={{
                        color: 'var(--text)',
                        boxShadow: 'inset 0 0 0 1px var(--rule)',
                        background: 'var(--bg)',
                      }}
                      aria-label="다음 페이지"
                    >
                      <ChevronRight className="w-4 h-4" strokeWidth={2.4} />
                    </Link>
                  ) : (
                    <span aria-hidden className="w-9 h-9" />
                  )}
                </nav>
              )}
            </>
          )}
        </div>
      </div>

      {!isApp && <RecentlyViewed />}
    </main>
  )
}

// ─────────────────────────── atoms ───────────────────────────

function FilterSidebarSlot() {
  // 데스크톱 sidebar 만 렌더 — toolbar 의 trigger 와 분리되어 중복 mount 방지.
  return <CatalogFilterSidebar />
}

function Breadcrumb({ pageTitle }: { pageTitle: string }) {
  return (
    <nav
      aria-label="현재 위치"
      className="flex items-center gap-1 text-[11px] md:text-[12px]"
      style={{ color: 'var(--muted)' }}
    >
      <Link href="/" className="hover:text-terracotta transition">
        홈
      </Link>
      <Crumb className="w-3 h-3 opacity-50" strokeWidth={2} />
      <Link href="/products" className="hover:text-terracotta transition">
        상품
      </Link>
      {pageTitle !== '전체 상품' && pageTitle !== '검색 결과' && (
        <>
          <Crumb className="w-3 h-3 opacity-50" strokeWidth={2} />
          <span style={{ color: 'var(--ink)', fontWeight: 700 }}>
            {pageTitle}
          </span>
        </>
      )}
    </nav>
  )
}

function EmptyState({
  isSearching,
  isFiltered,
  query,
}: {
  isSearching: boolean
  isFiltered: boolean
  query: string
}) {
  return (
    <div
      className="rounded-2xl py-14 md:py-20 px-6 flex flex-col items-center text-center"
      style={{ background: 'var(--bg-2)', border: '1px dashed var(--rule-2)' }}
    >
      <div
        className="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center mb-3 md:mb-4"
        style={{ background: 'var(--bg)' }}
      >
        <Search
          className="w-5 h-5 md:w-6 md:h-6"
          strokeWidth={1.8}
          color="var(--muted)"
        />
      </div>
      <p
        className="font-serif text-[16px] md:text-[20px] font-black"
        style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
      >
        {isSearching
          ? `"${query}" 와 일치하는 상품이 없어요`
          : isFiltered
            ? '조건에 맞는 상품이 없어요'
            : '아직 상품이 없어요'}
      </p>
      <p
        className="mt-2 text-[11.5px] md:text-[13px] leading-relaxed"
        style={{ color: 'var(--muted)' }}
      >
        다른 단어로 시도하거나 필터를 줄여서 다시 둘러보세요.
      </p>
      {(isSearching || isFiltered) && (
        <Link
          href="/products"
          className="mt-5 inline-block px-5 py-2 rounded-full text-[12px] font-bold"
          style={{ background: 'var(--ink)', color: 'var(--bg)' }}
        >
          전체 상품 보기
        </Link>
      )}
    </div>
  )
}
