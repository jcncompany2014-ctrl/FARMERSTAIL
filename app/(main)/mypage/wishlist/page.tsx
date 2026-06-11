import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Heart, Soup } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { V3, V3FontWeight, V3LetterSpacing, V3Radius } from '@/lib/design/tokens'
import { Mono, Badge } from '@/components/v3'
import WishlistRemoveButton from './WishlistRemoveButton'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '찜한 상품',
  robots: { index: false, follow: false },
}

/**
 * /mypage/wishlist — 찜한 상품 그리드 (v3 reskin, 2026-05-22 R9-6).
 *
 * 2-col grid, 카드: aspect-square 이미지 + 이름 + 가격 + remove 버튼.
 * 톤은 CatalogProductCard 와 통일 — paperHi + 1px ink rule + radius 4.
 */
export default async function WishlistPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/wishlist')

  const { data: rows } = await supabase
    .from('wishlists')
    .select(
      `product_id, created_at,
       products ( id, name, slug, short_description, price, sale_price, image_url, is_active, is_subscribable, category )`
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (rows ?? []) as any[]

  return (
    <div style={{ paddingBottom: 32 }}>
      <section style={{ padding: '24px 20px 8px' }}>
        <Mono color="inkMute" size="xs" weight={500}>
          Wishlist · 찜한 상품
        </Mono>
        <h1
          style={{
            margin: '6px 0 0',
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 28,
            lineHeight: 1,
            color: V3.ink,
            letterSpacing: V3LetterSpacing.heading,
          }}
        >
          찜한 상품
        </h1>
        <Mono
          color="inkMute"
          size="xxs"
          weight={500}
          letterSpacing="0.08em"
          style={{ marginTop: 6, display: 'inline-block' }}
        >
          ({String(items.length).padStart(2, '0')})
        </Mono>
      </section>

      {items.length === 0 ? (
        <section style={{ padding: '20px 20px 0' }}>
          <div
            className="text-center"
            style={{
              borderRadius: V3Radius.sm,
              border: `1.5px dashed ${V3.rule}`,
              padding: '48px 24px',
              background: V3.paperHi,
            }}
          >
            <div
              className="mx-auto flex items-center justify-center"
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: V3.paper,
                border: `1px solid ${V3.rule}`,
                marginBottom: 14,
              }}
            >
              <Heart size={24} color={V3.accent} strokeWidth={1.5} />
            </div>
            <Mono color="accent" size="xxs" weight={600}>
              Empty
            </Mono>
            <h3
              style={{
                margin: '8px 0 0',
                fontFamily: 'var(--font-sans)',
                fontWeight: V3FontWeight.black,
                fontSize: 18,
                color: V3.ink,
                letterSpacing: '-0.02em',
              }}
            >
              찜한 상품이 없어요
            </h3>
            <p
              style={{
                fontSize: 12,
                color: V3.inkMute,
                marginTop: 8,
                lineHeight: 1.55,
                maxWidth: 240,
                marginInline: 'auto',
              }}
            >
              마음에 드는 상품에 하트를 눌러 나만의 위시리스트를 만들어보세요
            </p>
            <Link
              href="/products"
              className="inline-flex items-center active:scale-[0.98] transition"
              style={{
                marginTop: 20,
                padding: '12px 22px',
                fontSize: 12,
                fontWeight: V3FontWeight.bold,
                borderRadius: V3Radius.pill,
                background: V3.ink,
                color: V3.paperHi,
                textDecoration: 'none',
              }}
            >
              상품 둘러보기
            </Link>
          </div>
        </section>
      ) : (
        <section
          className="grid grid-cols-2"
          style={{ padding: '12px 20px 0', gap: 10 }}
        >
          {items.map((w) => {
            const p = w.products
            if (!p) return null
            const hasSale = p.sale_price !== null
            const discount = hasSale
              ? Math.round(((p.price - (p.sale_price ?? p.price)) / p.price) * 100)
              : 0
            return (
              <div
                key={p.id}
                className="relative overflow-hidden flex flex-col"
                style={{
                  background: V3.paperHi,
                  border: `1px solid ${V3.rule}`,
                  borderRadius: V3Radius.sm,
                  height: '100%',
                }}
              >
                <Link
                  href={`/products/${p.slug}`}
                  className="block"
                  style={{ textDecoration: 'none', color: V3.ink }}
                >
                  <div
                    className="relative overflow-hidden"
                    style={{
                      aspectRatio: '1 / 1',
                      background: V3.paper,
                    }}
                  >
                    {p.image_url ? (
                      <Image
                        src={p.image_url}
                        alt={p.name}
                        fill
                        sizes="(max-width: 768px) 50vw, 224px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Soup size={40} color={V3.inkMute} strokeWidth={1.2} />
                      </div>
                    )}
                    {hasSale && discount > 0 && (
                      <div
                        className="absolute"
                        style={{ top: 8, left: 8 }}
                      >
                        <Badge tone="accent" filled size="sm">
                          {discount}%
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      borderTop: `1px solid ${V3.rule}`,
                      padding: '10px 12px',
                    }}
                  >
                    <div
                      className="line-clamp-2"
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 12,
                        fontWeight: V3FontWeight.bold,
                        color: V3.ink,
                        lineHeight: 1.35,
                        letterSpacing: '-0.01em',
                        minHeight: 30,
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      className="flex items-baseline tabular-nums"
                      style={{ marginTop: 8, gap: 3 }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: 13.5,
                          fontWeight: V3FontWeight.black,
                          color: hasSale ? V3.accent : V3.ink,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {(hasSale ? p.sale_price ?? p.price : p.price).toLocaleString()}
                      </span>
                      <Mono color="inkMute" size="xxs" weight={500}>
                        원
                      </Mono>
                    </div>
                  </div>
                </Link>
                <WishlistRemoveButton productId={p.id} />
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}
