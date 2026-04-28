import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronRight, ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import JsonLd from '@/components/JsonLd'
import {
  buildItemListJsonLd,
  buildBreadcrumbJsonLd,
  SITE_URL,
} from '@/lib/seo/jsonld'

/**
 * /collections — 큐레이션 컬렉션 인덱스.
 *
 * 마켓컬리/SSG 의 "큐레이션 모음전" 동선:
 *   "첫 화식 입문 / 노령견 식단 / 다이어트 식단 / 알레르기 케어" 같은 큰 카드
 *   각 카드 = 큰 hero 이미지 + 큐레이터 코멘트 + slug → /collections/[slug]
 *
 * 테이블이 아직 없거나(=마이그레이션 미적용) RLS 거부면 조용히 빈 list 로 폴백.
 */

export const revalidate = 300

type Collection = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  curator_note: string | null
  hero_image_url: string | null
  card_image_url: string | null
  palette: string | null
}

export const metadata: Metadata = {
  title: '큐레이션 컬렉션 | 파머스테일',
  description:
    '수의영양사·반려인 큐레이터가 직접 묶은 식단 컬렉션. 첫 화식 입문, 노령견 식단, 체중 관리, 알레르기 케어.',
  alternates: { canonical: '/collections' },
  robots: { index: true, follow: true },
}

const PALETTE: Record<
  string,
  { bg: string; ink: string; accent: string }
> = {
  ink: {
    bg: 'var(--ink)',
    ink: 'var(--bg)',
    accent: 'var(--gold)',
  },
  terracotta: {
    bg: 'var(--terracotta)',
    ink: 'var(--bg)',
    accent: '#F5E0C2',
  },
  moss: {
    bg: 'var(--moss)',
    ink: 'var(--bg)',
    accent: 'var(--gold)',
  },
  gold: {
    bg: 'var(--gold)',
    ink: 'var(--ink)',
    accent: 'var(--terracotta)',
  },
}

export default async function CollectionsPage() {
  const supabase = await createClient()
  let collections: Collection[] = []
  try {
    const { data, error } = await supabase
      .from('collections')
      .select(
        'id, slug, title, subtitle, curator_note, hero_image_url, card_image_url, palette',
      )
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
    if (!error && data) collections = data as Collection[]
  } catch {
    // table doesn't exist yet — graceful empty state
  }

  const itemListLd = buildItemListJsonLd({
    name: '큐레이션 컬렉션',
    url: `${SITE_URL}/collections`,
    items: collections.map((c) => ({
      name: c.title,
      url: `${SITE_URL}/collections/${c.slug}`,
      image: c.card_image_url ?? c.hero_image_url ?? null,
    })),
  })
  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '컬렉션', path: '/collections' },
  ])

  return (
    <main
      className="pb-12 md:pb-20 mx-auto"
      style={{ background: 'var(--bg)', maxWidth: 1280 }}
    >
      <JsonLd id="ld-collections" data={itemListLd} />
      <JsonLd id="ld-collections-crumbs" data={crumbLd} />
      {/* breadcrumb */}
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
          <span style={{ color: 'var(--ink)', fontWeight: 700 }}>컬렉션</span>
        </nav>
      </div>

      {/* hero */}
      <section className="px-5 md:px-8 pt-4 md:pt-8 pb-6 md:pb-10">
        <span
          className="font-mono text-[10px] md:text-[12px] tracking-[0.22em] uppercase"
          style={{ color: 'var(--terracotta)' }}
        >
          Curated · 큐레이션 모음
        </span>
        <h1
          className="font-serif mt-2 md:mt-3 text-[26px] md:text-[44px] lg:text-[52px]"
          style={{
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
          }}
        >
          이 한 끼,
          <br />
          <span style={{ color: 'var(--terracotta)' }}>큐레이터가 묶었어요</span>
        </h1>
        <p
          className="mt-3 md:mt-4 text-[12.5px] md:text-[15px] leading-relaxed max-w-xl"
          style={{ color: 'var(--muted)' }}
        >
          수의영양사·반려인 큐레이터가 직접 골라 한 묶음으로 정리했어요. 입문 ·
          노령 · 다이어트 · 알레르기 — 우리 아이에게 맞는 식단부터 시작해 보세요.
        </p>
      </section>

      {/* grid */}
      {collections.length === 0 ? (
        <section className="px-5 md:px-8">
          <div
            className="rounded-2xl py-14 md:py-20 px-6 text-center"
            style={{
              background: 'var(--bg-2)',
              border: '1px dashed var(--rule-2)',
            }}
          >
            <p
              className="font-serif text-[16px] md:text-[20px]"
              style={{
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.02em',
              }}
            >
              곧 새 큐레이션이 시작돼요
            </p>
            <p
              className="mt-2 text-[12px] md:text-[13.5px]"
              style={{ color: 'var(--muted)' }}
            >
              첫 큐레이션 컬렉션이 준비되는 동안 카탈로그에서 둘러보실 수 있어요.
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
      ) : (
        <section className="px-5 md:px-8">
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {collections.map((c, i) => {
              const pal =
                PALETTE[c.palette ?? 'ink'] ?? PALETTE.ink
              const num = String(i + 1).padStart(2, '0')
              return (
                <li key={c.id}>
                  <Link
                    href={`/collections/${c.slug}`}
                    className="group relative block overflow-hidden rounded-2xl transition active:scale-[0.99]"
                    style={{
                      background: pal.bg,
                      color: pal.ink,
                      minHeight: 260,
                    }}
                  >
                    {c.card_image_url && (
                      <Image
                        src={c.card_image_url}
                        alt={c.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 600px"
                        className="object-cover opacity-70 group-hover:scale-[1.03] transition-transform duration-500"
                      />
                    )}

                    <div
                      aria-hidden
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          c.card_image_url
                            ? `linear-gradient(180deg, transparent 0%, ${pal.bg} 95%)`
                            : 'radial-gradient(ellipse at 115% -10%, rgba(255,255,255,0.14) 0%, transparent 55%)',
                      }}
                    />

                    <div className="relative h-full flex flex-col justify-between p-5 md:p-7 z-10 min-h-[260px] md:min-h-[320px]">
                      <div className="flex items-center justify-between">
                        <span
                          className="font-mono text-[10px] tracking-[0.22em] uppercase"
                          style={{ color: pal.accent }}
                        >
                          No. {num}
                        </span>
                        <span
                          className="inline-flex items-center gap-1 text-[10.5px] font-bold"
                          style={{ color: pal.ink, opacity: 0.7 }}
                        >
                          큐레이션
                        </span>
                      </div>

                      <div>
                        <div
                          className="font-mono text-[10px] md:text-[11px] tracking-[0.18em] uppercase mb-2"
                          style={{ color: pal.accent }}
                        >
                          Collection
                        </div>
                        <h2
                          className="font-serif text-[26px] md:text-[36px] lg:text-[42px] leading-[1.05]"
                          style={{
                            fontWeight: 900,
                            color: pal.ink,
                            letterSpacing: '-0.035em',
                          }}
                        >
                          {c.title}
                        </h2>
                        {c.subtitle && (
                          <p
                            className="font-serif italic mt-2 md:mt-3 text-[14px] md:text-[17px]"
                            style={{
                              fontWeight: 500,
                              color: pal.accent,
                              letterSpacing: '-0.01em',
                            }}
                          >
                            {c.subtitle}
                          </p>
                        )}
                        <div
                          className="mt-4 md:mt-5 inline-flex items-center gap-1.5 text-[12px] md:text-[13px] font-bold"
                          style={{ color: pal.ink }}
                        >
                          모음 보기
                          <ArrowUpRight
                            className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
                            strokeWidth={2.5}
                          />
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </main>
  )
}
