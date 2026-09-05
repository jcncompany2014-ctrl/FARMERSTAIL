import Link from 'next/link'
import { Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import ProductRowActions from './ProductRowActions'
import AdminPagination from '@/components/admin/AdminPagination'
import { Hl, Warn, LoadError, FilterChip } from '@/components/admin/ui'

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
  if (error) console.error('[admin-products] 상품 목록 조회 실패:', error.message)
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Package className="size-5 text-primary" strokeWidth={2} />
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">
              제품 관리
            </h1>
          </div>
          <p className="text-[13px] text-muted-foreground mt-1">
            {/*
              ★ 문구를 사실에 맞췄다 (2026-07-31). 예전엔 "가격을 바꾸면 새
              결제부터 바로 반영"이라고 적혀 있었는데 **기존 구독은 안 바뀐다.**
              청구는 `subscriptions.total_amount`(가입·승인 시점에 굳은 값)로
              나간다(규칙5 — 저장값으로 청구). 실제로 갱신되는 곳은
              `/api/personalization/approve` 한 곳뿐이다.
              동작을 바꾸는 게 아니라 문구를 고치는 게 맞다: 기존 구독 금액을
              말없이 따라 올리면 고객이 동의한 적 없는 금액이 빠져나간다 —
              그래서 금액 변경엔 동의 모달이 따로 있다.
            */}
            판매하는 화식 레시피(제품)를 관리하는 곳이에요. 여기 등록된{' '}
            <Hl>100g 단가가 고객 청구 금액의 기준(정본)</Hl>이지만,{' '}
            <Warn>이미 구독 중인 분의 금액은 바뀌지 않아요</Warn> — 새로
            신청하는 분부터 적용되고, 기존 구독은 다음 처방을 고객이 승인할 때
            새 가격으로 바뀌어요(금액이 달라지면 고객 동의를 받아요). — 총{' '}
            {total.toLocaleString()}개
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="shrink-0 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
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
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-ring'
              }`}
            >
              {f.key === 'own' ? '🏠 ' : f.key === 'external' ? '🛒 ' : ''}
              {f.label}
            </Link>
          )
        })}
        <span className="self-center text-[11px] text-muted-foreground ml-1">
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
              <FilterChip
                key={f.key}
                href={`/admin/products?${sp.toString()}`}
                active={isActive}
                label={f.label}
              />
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
            className="px-3 py-1.5 rounded-full text-xs bg-card border border-border focus:outline-none focus:border-primary w-56"
          />
          <button
            type="submit"
            className="px-4 py-1.5 rounded-full text-xs font-semibold bg-primary text-white hover:opacity-90 transition"
          >
            검색
          </button>
        </form>
      </div>

      <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
        {error ? (
          // 원시 error.message 대신 사람 말 — 상세는 서버 로그(규칙1).
          <LoadError what="상품 목록" />
        ) : !products || products.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">
            {q || active !== 'all'
              ? '조건에 맞는 상품이 없어요'
              : '등록된 상품이 없어요'}
          </p>
        ) : (
          <>
          {/* 모바일: 카드 리스트 — 재고 ±·활성 토글을 폰에서도 바로
              (7열 테이블은 가로 스크롤. 2026-09-05 개편). */}
          <ul className="space-y-3 md:hidden">
            {(products as ProductRow[]).map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-border bg-card p-3.5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="text-lg">🐾</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.category ?? '-'} ·{' '}
                      {p.sale_price ? (
                        <span className="font-semibold text-primary">
                          {p.sale_price.toLocaleString()}원
                        </span>
                      ) : (
                        <span className="font-semibold text-foreground">
                          {p.price.toLocaleString()}원
                        </span>
                      )}
                    </p>
                  </div>
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="shrink-0 text-[11px] font-semibold text-primary hover:underline"
                  >
                    편집 →
                  </Link>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                  <ProductRowActions
                    productId={p.id}
                    field="stock"
                    initialValue={p.stock ?? 0}
                  />
                  <ProductRowActions
                    productId={p.id}
                    field="is_active"
                    initialValue={p.is_active ?? false}
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted-foreground border-b border-border">
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
                    className="border-b border-border/60 hover:bg-secondary/50 transition"
                  >
                    <td className="py-3">
                      <div className="w-12 h-12 rounded-lg bg-secondary overflow-hidden flex items-center justify-center">
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
                      <p className="text-foreground font-medium">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {p.slug}
                      </p>
                    </td>
                    <td className="py-3 text-foreground text-xs">
                      {p.category ?? '-'}
                    </td>
                    <td className="py-3 text-right">
                      {p.sale_price ? (
                        <div>
                          <p className="text-[10px] text-muted-foreground line-through">
                            {p.price.toLocaleString()}원
                          </p>
                          <p className="font-semibold text-primary">
                            {p.sale_price.toLocaleString()}원
                          </p>
                        </div>
                      ) : (
                        <p className="font-semibold text-foreground">
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
                        className="text-[11px] text-primary hover:underline font-semibold"
                      >
                        편집 →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
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