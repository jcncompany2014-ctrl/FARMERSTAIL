import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronRight, Soup, Cookie, PackageOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

/**
 * /compare?ids=A,B,C — 상품 비교 페이지 (최대 4개).
 *
 * 각 상품의 가격 / 할인 / 카테고리 / 정기배송 / 재고 / 태그 를 한 표에 정리.
 * URL 단일 진실원: `?ids=slug1,slug2,...` 콤마 구분. 빈 ids 면 안내 페이지.
 *
 * 마켓컬리/SSF 의 상품 비교 동선은 카탈로그 카드의 체크박스에서 시작하지만
 * 1차는 URL 만 지원 — 다음 라운드에 카드 단의 "비교 담기" UI 추가.
 */

// 5분 ISR — 비교 페이지 콘텐츠는 product 변경 시에만 영향 받아 60s 너무 짧음.
export const revalidate = 300

const MAX_COMPARE = 4

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
  stock: number
  tags: string[] | null
}

export const metadata: Metadata = {
  title: '상품 비교 | 파머스테일',
  description: '여러 상품을 한눈에 비교해 보세요.',
  alternates: { canonical: '/compare' },
  robots: { index: false, follow: true },
}

type SearchParamsT = Promise<{ ids?: string }>

function CategoryIcon({
  category,
  size = 28,
}: {
  category: string | null
  size?: number
}) {
  const sx = { strokeWidth: 1.4, color: 'var(--ink)', style: { opacity: 0.32, width: size, height: size } } as const
  if (category === '간식') return <Cookie {...sx} />
  if (category === '체험팩') return <PackageOpen {...sx} />
  return <Soup {...sx} />
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: SearchParamsT
}) {
  const raw = await searchParams
  const slugs = (raw.ids ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_COMPARE)

  let products: Product[] = []
  if (slugs.length > 0) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('products')
      .select(
        'id, name, slug, short_description, price, sale_price, category, is_subscribable, image_url, stock, tags',
      )
      .in('slug', slugs)
      .eq('is_active', true)
    if (data) {
      // URL 순서대로 정렬
      const byslug = new Map<string, Product>(
        (data as Product[]).map((p) => [p.slug, p]),
      )
      products = slugs
        .map((s) => byslug.get(s))
        .filter((p): p is Product => !!p)
    }
  }

  return (
    <main
      className="pb-12 md:pb-20 mx-auto"
      style={{ background: 'var(--bg)', maxWidth: 1280 }}
    >
      <div className="px-5 md:px-8 pt-4 md:pt-6">
        <nav
          aria-label="현재 위치"
          className="flex items-center gap-1 text-[11px] md:text-[12px]"
          style={{ color: 'var(--muted)' }}
        >
          <Link href="/" className="hover:text-terracotta transition">
            홈
          </Link>
          <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
          <Link href="/products" className="hover:text-terracotta transition">
            상품
          </Link>
          <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
          <span style={{ color: 'var(--ink)', fontWeight: 700 }}>비교</span>
        </nav>
      </div>

      <section className="px-5 md:px-8 pt-4 md:pt-8 pb-6 md:pb-10">
        <span
          className="font-mono text-[10px] md:text-[12px] tracking-[0.22em] uppercase"
          style={{ color: 'var(--terracotta)' }}
        >
          Compare · 상품 비교
        </span>
        <h1
          className="font-serif mt-2 md:mt-3 text-[24px] md:text-[40px] lg:text-[48px]"
          style={{
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
          }}
        >
          한눈에 비교
        </h1>
        <p
          className="mt-2 md:mt-3 text-[12px] md:text-[14.5px]"
          style={{ color: 'var(--muted)' }}
        >
          최대 {MAX_COMPARE}개 상품을 가격 / 할인 / 카테고리 / 재고로 한 번에
          비교할 수 있어요.
        </p>
      </section>

      {products.length === 0 ? (
        <EmptyState />
      ) : (
        <section className="px-5 md:px-8">
          <div className="ft-compare-table-wrap">
            <CompareTable products={products} />
          </div>
        </section>
      )}
    </main>
  )
}

function EmptyState() {
  return (
    <section className="px-5 md:px-8">
      <div
        className="rounded-2xl py-14 md:py-20 px-6 text-center"
        style={{ background: 'var(--bg-2)', border: '1px dashed var(--rule-2)' }}
      >
        <p
          className="font-serif text-[16px] md:text-[20px]"
          style={{
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          비교할 상품이 없어요
        </p>
        <p
          className="mt-2 text-[12px] md:text-[13.5px]"
          style={{ color: 'var(--muted)' }}
        >
          상품 목록에서 둘러본 뒤 다시 시도해 주세요.
        </p>
        <Link
          href="/products"
          className="mt-5 inline-block px-5 py-2.5 rounded-full text-[12px] md:text-[13px] font-bold"
          style={{ background: 'var(--ink)', color: 'var(--bg)' }}
        >
          제품 둘러보기
        </Link>
      </div>
    </section>
  )
}

function CompareTable({ products }: { products: Product[] }) {
  const cols = products.length

  function renderHasSale(p: Product) {
    const hasSale = p.sale_price !== null
    const eff = p.sale_price ?? p.price
    const discount = hasSale
      ? Math.round(((p.price - eff) / p.price) * 100)
      : 0
    return (
      <div className="flex flex-col gap-0.5">
        {hasSale && discount > 0 && (
          <span
            className="font-mono text-[11px] md:text-[12px] font-black tabular-nums"
            style={{ color: 'var(--sale)' }}
          >
            −{discount}%
          </span>
        )}
        <div className="flex items-baseline gap-1">
          <span
            className="font-black text-[16px] md:text-[18px] tabular-nums"
            style={{
              color: hasSale ? 'var(--sale)' : 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            {eff.toLocaleString()}
          </span>
          <span
            className="text-[10px] md:text-[11px]"
            style={{ color: 'var(--muted)' }}
          >
            원
          </span>
        </div>
        {hasSale && (
          <span
            className="text-[10px] md:text-[11px] line-through tabular-nums"
            style={{ color: 'var(--muted)' }}
          >
            {p.price.toLocaleString()}원
          </span>
        )}
      </div>
    )
  }

  function stockLabel(stock: number) {
    if (stock <= 0)
      return <span style={{ color: 'var(--sale)' }}>품절</span>
    if (stock < 5)
      return <span style={{ color: 'var(--sale)' }}>{stock}개 남음</span>
    return <span style={{ color: 'var(--moss)' }}>충분</span>
  }

  // Header (image + name) + rows
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--bg-2)',
        boxShadow: 'inset 0 0 0 1px var(--rule)',
      }}
    >
      {/* Header row — 이미지 + 제품명 + PDP link */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `120px repeat(${cols}, minmax(0, 1fr))`,
        }}
      >
        <div
          className="px-3 md:px-5 py-4 md:py-5 font-mono text-[10px] md:text-[11px] tracking-[0.18em] uppercase"
          style={{
            color: 'var(--muted)',
            background: 'var(--bg)',
          }}
        >
          항목
        </div>
        {products.map((p) => (
          <Link
            key={p.id}
            href={`/products/${p.slug}`}
            className="block group p-3 md:p-5 transition active:scale-[0.99]"
            style={{ background: 'var(--bg)' }}
          >
            <div
              className="relative aspect-[4/5] rounded-lg overflow-hidden mb-3"
              style={{ background: 'var(--bg-2)' }}
            >
              {p.image_url ? (
                <Image
                  src={p.image_url}
                  alt={p.name}
                  fill
                  sizes="(max-width: 768px) 50vw, 240px"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <CategoryIcon category={p.category} size={36} />
                </div>
              )}
            </div>
            <div
              className="font-serif text-[13px] md:text-[15px] line-clamp-2"
              style={{
                fontWeight: 700,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              {p.name}
            </div>
          </Link>
        ))}
      </div>

      {/* Rows */}
      <Row label="가격" cols={cols}>
        {products.map((p) => (
          <Cell key={p.id}>{renderHasSale(p)}</Cell>
        ))}
      </Row>
      <Row label="카테고리" cols={cols}>
        {products.map((p) => (
          <Cell key={p.id}>
            <span
              className="font-mono text-[10px] md:text-[11px] tracking-[0.18em] uppercase"
              style={{ color: 'var(--terracotta)', fontWeight: 700 }}
            >
              {p.category ?? '-'}
            </span>
          </Cell>
        ))}
      </Row>
      <Row label="정기배송" cols={cols}>
        {products.map((p) => (
          <Cell key={p.id}>
            <span
              className="text-[12px] md:text-[14px]"
              style={{
                color: p.is_subscribable ? 'var(--moss)' : 'var(--muted)',
                fontWeight: p.is_subscribable ? 700 : 500,
              }}
            >
              {p.is_subscribable ? '가능' : '미지원'}
            </span>
          </Cell>
        ))}
      </Row>
      <Row label="재고" cols={cols}>
        {products.map((p) => (
          <Cell key={p.id}>
            <span
              className="text-[12px] md:text-[14px]"
              style={{ fontWeight: 700 }}
            >
              {stockLabel(p.stock)}
            </span>
          </Cell>
        ))}
      </Row>
      <Row label="태그" cols={cols} last>
        {products.map((p) => (
          <Cell key={p.id}>
            <div className="flex flex-wrap gap-1">
              {(p.tags ?? []).slice(0, 4).map((t) => (
                <span
                  key={t}
                  className="text-[10px] md:text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: 'var(--bg-2)',
                    boxShadow: 'inset 0 0 0 1px var(--rule)',
                    color: 'var(--text)',
                  }}
                >
                  #{t}
                </span>
              ))}
              {!p.tags?.length && (
                <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  -
                </span>
              )}
            </div>
          </Cell>
        ))}
      </Row>
    </div>
  )
}

function Row({
  label,
  cols,
  last,
  children,
}: {
  label: string
  cols: number
  last?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `120px repeat(${cols}, minmax(0, 1fr))`,
        borderTop: '1px solid var(--rule-2)',
        ...(last ? {} : {}),
      }}
    >
      <div
        className="px-3 md:px-5 py-3 md:py-4 font-mono text-[10px] md:text-[11px] tracking-[0.18em] uppercase"
        style={{ color: 'var(--muted)', background: 'var(--bg)' }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-3 md:px-5 py-3 md:py-4 flex items-center"
      style={{
        background: 'var(--bg)',
        borderLeft: '1px solid var(--rule-2)',
      }}
    >
      {children}
    </div>
  )
}
