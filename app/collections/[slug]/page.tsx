import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import CatalogProductCard, {
  type CatalogProduct,
} from '@/components/products/CatalogProductCard'
import RecentlyViewed from '@/components/products/RecentlyViewed'
import BulkAddToCart from '@/components/products/BulkAddToCart'
import ShareButton from '@/components/ShareButton'
import JsonLd from '@/components/JsonLd'
import {
  buildCollectionPageJsonLd,
  buildBreadcrumbJsonLd,
  SITE_URL,
} from '@/lib/seo/jsonld'

/**
 * /collections/[slug] — 컬렉션 상세.
 *
 * 큐레이션 banner + 큐레이터 노트 + 모음 그리드 + 추천 섹션.
 */

export const revalidate = 300

type Params = Promise<{ slug: string }>

type Collection = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  curator_note: string | null
  hero_image_url: string | null
  palette: string | null
}

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  let c: Collection | null = null
  try {
    const { data } = await supabase
      .from('collections')
      .select(
        'id, slug, title, subtitle, curator_note, hero_image_url, palette',
      )
      .eq('slug', slug)
      .eq('is_published', true)
      .single()
    c = (data as Collection) ?? null
  } catch {
    c = null
  }
  if (!c) return { title: '컬렉션을 찾을 수 없음' }
  return {
    title: `${c.title} | 파머스테일 컬렉션`,
    description: c.subtitle ?? c.curator_note ?? c.title,
    alternates: { canonical: `/collections/${slug}` },
    openGraph: {
      type: 'website',
      title: `${c.title} · ${c.subtitle ?? ''} | 파머스테일`,
      description: c.curator_note ?? c.subtitle ?? c.title,
      url: `/collections/${slug}`,
      images: c.hero_image_url ? [{ url: c.hero_image_url }] : [],
    },
    robots: { index: true, follow: true },
  }
}

const PALETTE: Record<string, { bg: string; ink: string; accent: string }> = {
  ink: { bg: 'var(--ink)', ink: 'var(--bg)', accent: 'var(--gold)' },
  terracotta: {
    bg: 'var(--terracotta)',
    ink: 'var(--bg)',
    accent: '#F5E0C2',
  },
  moss: { bg: 'var(--moss)', ink: 'var(--bg)', accent: 'var(--gold)' },
  gold: { bg: 'var(--gold)', ink: 'var(--ink)', accent: 'var(--terracotta)' },
}

export default async function CollectionDetailPage({
  params,
}: {
  params: Params
}) {
  const { slug } = await params
  const supabase = await createClient()

  let collection: Collection | null = null
  let products: CatalogProduct[] = []
  try {
    const { data: c } = await supabase
      .from('collections')
      .select(
        'id, slug, title, subtitle, curator_note, hero_image_url, palette',
      )
      .eq('slug', slug)
      .eq('is_published', true)
      .single()
    collection = (c as Collection) ?? null

    if (collection) {
      const { data: items } = await supabase
        .from('collection_items')
        .select(
          `position, products!inner (
            id, name, slug, short_description, price, sale_price,
            category, is_subscribable, image_url, stock, created_at
          )`,
        )
        .eq('collection_id', collection.id)
        .order('position', { ascending: true })

      // Supabase JS 의 1:N join 은 항상 배열을 반환 — !inner 로 단일 매칭이라도
      // 타입은 array 로 추정. 실제 첫 번째 요소만 사용.
      type Row = {
        position: number
        products: CatalogProduct | CatalogProduct[]
      }
      products = ((items ?? []) as unknown as Row[])
        .map((row) =>
          Array.isArray(row.products) ? row.products[0] : row.products,
        )
        .filter((p): p is CatalogProduct => !!p)
    }
  } catch {
    collection = null
  }

  if (!collection) notFound()

  const pal = PALETTE[collection.palette ?? 'ink'] ?? PALETTE.ink

  const collectionLd = buildCollectionPageJsonLd({
    name: collection.title,
    description:
      collection.subtitle ?? collection.curator_note ?? collection.title,
    url: `${SITE_URL}/collections/${collection.slug}`,
    items: products.map((p) => ({
      name: p.name,
      url: `${SITE_URL}/products/${p.slug}`,
      image: p.image_url ?? null,
    })),
  })
  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '컬렉션', path: '/collections' },
    { name: collection.title, path: `/collections/${collection.slug}` },
  ])

  return (
    <main className="pb-12 md:pb-20" style={{ background: 'var(--bg)' }}>
      <JsonLd id={`ld-collection-${collection.slug}`} data={collectionLd} />
      <JsonLd
        id={`ld-collection-crumbs-${collection.slug}`}
        data={crumbLd}
      />
      {/* breadcrumb */}
      <div
        className="px-5 md:px-8 pt-4 md:pt-6 mx-auto"
        style={{ maxWidth: 1280 }}
      >
        <nav
          aria-label="현재 위치"
          className="flex items-center gap-1 text-[11px] md:text-[12px]"
          style={{ color: 'var(--muted)' }}
        >
          <Link href="/" className="hover:text-terracotta transition">
            홈
          </Link>
          <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
          <Link href="/collections" className="hover:text-terracotta transition">
            컬렉션
          </Link>
          <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
          <span style={{ color: 'var(--ink)', fontWeight: 700 }}>
            {collection.title}
          </span>
        </nav>
      </div>

      {/* Hero */}
      <section
        className="relative overflow-hidden mt-3 md:mt-5 mx-auto"
        style={{
          background: pal.bg,
          color: pal.ink,
          maxWidth: 1280,
        }}
      >
        {collection.hero_image_url && (
          <>
            <Image
              src={collection.hero_image_url}
              alt={collection.title}
              fill
              priority
              sizes="(max-width: 1280px) 100vw, 1280px"
              className="object-cover"
              style={{ zIndex: 0 }}
            />
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{ background: pal.bg, opacity: 0.55, zIndex: 1 }}
            />
          </>
        )}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 115% -10%, rgba(255,255,255,0.14) 0%, transparent 55%)',
            zIndex: 2,
          }}
        />

        <div
          className="relative px-5 md:px-12 py-10 md:py-20 max-w-3xl"
          style={{ zIndex: 3 }}
        >
          <div
            className="font-mono text-[10px] md:text-[12px] tracking-[0.22em] uppercase"
            style={{ color: pal.accent }}
          >
            Collection · 큐레이션
          </div>
          <h1
            className="font-serif mt-3 md:mt-5 leading-[0.95] text-[36px] md:text-[64px] lg:text-[80px]"
            style={{
              fontWeight: 900,
              color: pal.ink,
              letterSpacing: '-0.04em',
            }}
          >
            {collection.title}
          </h1>
          {collection.subtitle && (
            <p
              className="font-serif italic mt-3 md:mt-5 text-[16px] md:text-[24px] lg:text-[28px]"
              style={{
                fontWeight: 500,
                color: pal.accent,
                letterSpacing: '-0.015em',
              }}
            >
              {collection.subtitle}
            </p>
          )}
          {collection.curator_note && (
            <p
              className="mt-5 md:mt-8 text-[13px] md:text-[16px] leading-relaxed"
              style={{ color: pal.ink, opacity: 0.92 }}
            >
              {collection.curator_note}
            </p>
          )}

          {/* 일괄 담기 CTA + 공유 — 컬렉션 hero 우측 하단. 상품이 1개 이상일 때만 노출 */}
          {products.length > 0 && (
            <div className="mt-6 md:mt-10 flex items-center gap-2 flex-wrap">
              <BulkAddToCart
                products={products.map((p) => ({
                  id: p.id,
                  name: p.name,
                  slug: p.slug,
                  price: p.price,
                  sale_price: p.sale_price,
                  stock: p.stock,
                  category: p.category,
                }))}
                collectionTitle={collection.title}
              />
              <ShareButton
                url={`/collections/${collection.slug}`}
                title={collection.title}
                description={collection.subtitle ?? collection.curator_note ?? undefined}
                imageUrl={collection.hero_image_url ?? undefined}
              />
            </div>
          )}
        </div>
      </section>

      {/* products */}
      <section
        className="px-5 md:px-8 pt-10 md:pt-14 mx-auto"
        style={{ maxWidth: 1280 }}
      >
        <div className="flex items-baseline justify-between mb-4 md:mb-6">
          <h2
            className="font-serif text-[18px] md:text-[24px]"
            style={{
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            이 컬렉션의 상품
          </h2>
          <span
            className="font-mono text-[10px] md:text-[12px] tracking-[0.18em] uppercase"
            style={{ color: 'var(--muted)' }}
          >
            {products.length} items
          </span>
        </div>

        {products.length === 0 ? (
          <div
            className="rounded-2xl py-14 px-6 text-center"
            style={{
              background: 'var(--bg-2)',
              border: '1px dashed var(--rule-2)',
            }}
          >
            <p
              className="font-serif text-[15px] md:text-[18px]"
              style={{ fontWeight: 800, color: 'var(--ink)' }}
            >
              곧 큐레이션이 채워져요
            </p>
            <p
              className="mt-2 text-[12px] md:text-[13.5px]"
              style={{ color: 'var(--muted)' }}
            >
              큐레이터가 상품을 고르는 중이에요. 카탈로그에서 다른 상품을
              둘러보실 수 있어요.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
            {products.map((p, i) => (
              // 데스크톱 4-col 첫 row(=4장) 만 LCP 후보로 priority. 그 외 lazy.
              <CatalogProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
        )}
      </section>

      <div className="mx-auto" style={{ maxWidth: 1280 }}>
        <RecentlyViewed />
      </div>
    </main>
  )
}
