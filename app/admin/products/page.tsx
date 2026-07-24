import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import ProductRowActions from './ProductRowActions'
import AdminPagination from '@/components/admin/AdminPagination'

export const dynamic = 'force-dynamic'

const PER_PAGE = 50

// sales_channel 은 마이그레이션 20260719120000 신설 — generated types 재생성
// 전까지 로컬 확장. own=자사몰 구독(화식), external=외부 채널(스마트스토어·쿠팡).
type ProductRow = Database['public']['Tables']['products']['Row'] & {
  sales_channel: 'own' | 'external'
}

type SearchParams = Promise<{
  q?: string
  active?: string
  channel?: string
  page?: string
}>

const ACTIVE_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'active', label: '판매 중' },
  { key: 'hidden', label: '숨김' },
]

// 판매 채널 탭 — 자사몰(구독 화식)과 외부 채널(스마트스토어·쿠팡 등) 상품을
// 분리 관리(2026-07-19 사장님). 자사몰/앱 노출은 slug 화이트리스트 기반이라
// external 이 고객에게 새어나갈 일은 없고, 이 탭은 admin 관리 편의.
const CHANNEL_FILTERS = [
  { key: 'own', label: '자사몰 구독' },
  { key: 'external', label: '외부 채널' },
  { key: 'all', label: '전체' },
]

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const {
    q = '',
    active = 'all',
    channel: channelRaw = 'own',
    page: pageRaw,
  } = await searchParams
  const channel = ['own', 'external', 'all'].includes(channelRaw)
    ? channelRaw
    : 'own'
  const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1)

  const supabase = await createClient()

  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)

  if (channel !== 'all') query = query.eq('sales_channel', channel)
  if (active === 'active') query = query.eq('is_active', true)
  else if (active === 'hidden') query = query.eq('is_active', false)

  const trimmed = q.trim()
  if (trimmed) {
    const escaped = trimmed.replace(/[\\%_,()]/g, (m) => `\\${m}`)
    query = query.or(
      [
        `name.ilike.%${escaped}%`,
        `slug.ilike.%${escaped}%`,
        `category.ilike.%${escaped}%`,
      ].join(','),
    )
  }

  const { data: products, error, count } = await query
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 leading-tight">
            제품 관리
          </h1>
          <p className="text-[13px] text-zinc-500 mt-1">
            판매하는 화식 레시피(제품)를 관리하는 곳이에요. 여기 등록된 100g
            단가가 고객 청구 금액의 기준(정본)이라, 가격을 바꾸면 새 결제부터
            바로 반영돼요. — 총 {total.toLocaleString()}개
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="px-4 py-2 rounded-full bg-terracotta text-white text-xs font-semibold hover:bg-[#8A3822] transition"
        >
          + 새 상품 등록
        </Link>
      </div>

      {/* 채널 탭 — 자사몰 구독(화식) vs 외부 채널(스마트스토어·쿠팡). */}
      <div className="mb-3 flex gap-1.5 flex-wrap">
        {CHANNEL_FILTERS.map((f) => {
          const isActive = channel === f.key
          const sp = new URLSearchParams()
          sp.set('channel', f.key)
          if (active !== 'all') sp.set('active', active)
          if (q) sp.set('q', q)
          return (
            <Link
              key={f.key}
              href={`/admin/products?${sp.toString()}`}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition border ${
                isActive
                  ? 'bg-terracotta text-white border-terracotta'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
              }`}
            >
              {f.key === 'own' ? '🏠 ' : f.key === 'external' ? '🛒 ' : ''}
              {f.label}
            </Link>
          )
        })}
        <span className="self-center text-[11px] text-zinc-400 ml-1">
          외부 채널 상품은 자사몰·앱에 노출되지 않아요
        </span>
      </div>

      {/* 필터 + 검색 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {ACTIVE_FILTERS.map((f) => {
            const isActive = active === f.key
            const sp = new URLSearchParams()
            sp.set('channel', channel)
            if (f.key !== 'all') sp.set('active', f.key)
            if (q) sp.set('q', q)
            return (
              <Link
                key={f.key}
                href={`/admin/products?${sp.toString()}`}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  isActive
                    ? 'bg-[#2A2118] text-white'
                    : 'bg-white text-text border border-zinc-200 hover:border-terracotta'
                }`}
              >
                {f.label}
              </Link>
            )
          })}
        </div>
        <form
          action="/admin/products"
          method="get"
          className="flex gap-2 items-center"
        >
          <input type="hidden" name="channel" value={channel} />
          {active !== 'all' && (
            <input type="hidden" name="active" value={active} />
          )}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="상품명 · slug · 카테고리"
            autoComplete="off"
            className="px-3 py-1.5 rounded-full text-xs bg-white border border-zinc-200 focus:outline-none focus:border-terracotta w-56"
          />
          <button
            type="submit"
            className="px-4 py-1.5 rounded-full text-xs font-semibold bg-terracotta text-white hover:bg-[#8A3822] transition"
          >
            검색
          </button>
        </form>
      </div>

      <div className="p-6 rounded-lg bg-white border border-zinc-200">
        {error ? (
          <p className="text-sale text-sm">에러: {error.message}</p>
        ) : !products || products.length === 0 ? (
          <p className="text-center text-sm text-muted py-10">
            {q || active !== 'all'
              ? '조건에 맞는 상품이 없어요'
              : '등록된 상품이 없어요'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted border-b border-zinc-200">
                  <th className="text-left py-2 font-medium w-16">이미지</th>
                  <th className="text-left py-2 font-medium">상품명</th>
                  <th className="text-left py-2 font-medium">카테고리</th>
                  <th className="text-right py-2 font-medium">가격</th>
                  <th className="text-center py-2 font-medium">재고</th>
                  <th className="text-center py-2 font-medium">활성</th>
                  <th className="text-center py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {(products as ProductRow[]).map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-200/50 hover:bg-bg transition"
                  >
                    <td className="py-3">
                      <div className="w-12 h-12 rounded-lg bg-bg overflow-hidden flex items-center justify-center">
                        {p.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-lg">🐾</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3">
                      <p className="text-ink font-medium">{p.name}</p>
                      <p className="text-[10px] text-muted font-mono mt-0.5">
                        {p.slug}
                      </p>
                    </td>
                    <td className="py-3 text-text text-xs">
                      {p.category ?? '-'}
                    </td>
                    <td className="py-3 text-right">
                      {p.sale_price ? (
                        <div>
                          <p className="text-[10px] text-muted line-through">
                            {p.price.toLocaleString()}원
                          </p>
                          <p className="font-semibold text-terracotta">
                            {p.sale_price.toLocaleString()}원
                          </p>
                        </div>
                      ) : (
                        <p className="font-semibold text-ink">
                          {p.price.toLocaleString()}원
                        </p>
                      )}
                    </td>
                    <td className="py-3">
                      <ProductRowActions
                        productId={p.id}
                        field="stock"
                        initialValue={p.stock ?? 0}
                      />
                    </td>
                    <td className="py-3">
                      <ProductRowActions
                        productId={p.id}
                        field="is_active"
                        initialValue={p.is_active ?? false}
                      />
                    </td>
                    <td className="py-3 text-center">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="text-[11px] text-terracotta hover:underline font-semibold"
                      >
                        편집 →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!error && (
        <AdminPagination
          page={page}
          totalPages={totalPages}
          basePath="/admin/products"
          params={{
            q: q || undefined,
            channel,
            active: active !== 'all' ? active : undefined,
          }}
          total={total}
        />
      )}
    </div>
  )
}