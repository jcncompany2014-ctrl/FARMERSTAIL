/**
 * FeaturedRow — Catalog 페이지의 "Featured / Best" 가로 스크롤 row.
 *
 * 핸드오프 패턴 (item 59):
 *   - heading row: kicker + 22px sans 800 + 우측 mono cursor
 *   - 가로 스크롤 카드들 — 각 카드 160×auto, photo + For·xx kicker + 이름 + 가격 + + 버튼.
 *
 * 데이터: ForFeaturedProduct[] — 카드 별 photo placeholder bg tone, kicker label.
 */

import Link from 'next/link'
import Image from 'next/image'
import { Plus, ShoppingBag } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

export interface FeaturedProduct {
  id: string
  name: string
  slug: string
  price: number
  /** 정가 (할인 라인). */
  originalPrice?: number | null
  /** For·xx kicker — 추천 사유 한 줄 (예: "BEST · 베스트"). */
  kicker?: string
  /** 카테고리 라벨 — 카드 좌상단 chip. */
  category?: string | null
  imageUrl?: string | null
  /** photo placeholder bg tone. */
  toneBg?: string
}

interface FeaturedRowProps {
  /** 우측 kicker — "WEEKLY · 이번 주" 등. */
  kicker?: string
  /** Heading. */
  heading: string
  /** 카운트 cursor — "12개" / "01 / 12". */
  cursor?: string
  products: FeaturedProduct[]
  /** "+" 버튼 클릭 — 호출자가 cart 처리. */
  onAdd?: (p: FeaturedProduct) => void
}

const DEFAULT_TONES = ['#d4b88c', '#c9b8a0', '#dec5a4', '#c4b694']

export default function FeaturedRow({
  kicker,
  heading,
  cursor,
  products,
  onAdd,
}: FeaturedRowProps) {
  if (products.length === 0) return null

  return (
    <section style={{ padding: '0 0 24px' }}>
      <div
        className="flex items-baseline justify-between"
        style={{ padding: '0 20px 14px' }}
      >
        <div className="min-w-0">
          {kicker && (
            <Mono color="accent" size="xs" weight={600}>
              {kicker}
            </Mono>
          )}
          <h2
            style={{
              margin: kicker ? '6px 0 0' : 0,
              fontFamily: 'var(--font-sans)',
              fontWeight: V3FontWeight.black,
              fontSize: 22,
              color: V3.ink,
              letterSpacing: '-0.025em',
              wordBreak: 'keep-all',
            }}
          >
            {heading}
          </h2>
        </div>
        {cursor && (
          <Mono color="inkMute" size="xs" weight={500}>
            {cursor}
          </Mono>
        )}
      </div>

      <div
        className="flex overflow-x-auto ft-scroll-hidden"
        style={{
          gap: 10,
          padding: '0 20px 6px',
        }}
      >
        {products.map((p, i) => (
          <FeaturedCard
            key={p.id}
            product={p}
            toneIndex={i}
            onAdd={() => onAdd?.(p)}
          />
        ))}
      </div>
    </section>
  )
}

function FeaturedCard({
  product,
  toneIndex,
  onAdd,
}: {
  product: FeaturedProduct
  toneIndex: number
  onAdd?: () => void
}) {
  const tone = product.toneBg ?? DEFAULT_TONES[toneIndex % DEFAULT_TONES.length]
  const hasDiscount =
    product.originalPrice != null && product.originalPrice > product.price
  const discountPct = hasDiscount
    ? Math.round(
        ((product.originalPrice! - product.price) / product.originalPrice!) *
          100,
      )
    : 0

  return (
    <div
      className="shrink-0"
      style={{
        width: 160,
        background: V3.paperHi,
        borderRadius: 4,
        padding: 10,
        border: `1px solid ${V3.rule}`,
      }}
    >
      <Link
        href={`/products/${product.slug}`}
        className="block relative overflow-hidden ft-aspect-square"
        style={{
          width: '100%',
          borderRadius: 2,
          background: tone,
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.16)',
        }}
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="160px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag size={28} color={V3.inkMute} strokeWidth={1.4} />
          </div>
        )}
        {hasDiscount && discountPct > 0 && (
          <span
            className="absolute"
            style={{
              top: 6,
              left: 6,
              background: V3.accent,
              color: V3.paperHi,
              fontFamily: "var(--font-mono, 'IBM Plex Mono'), 'JetBrains Mono', ui-monospace, monospace",
              fontSize: 9,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 2,
              letterSpacing: 0,
            }}
          >
            −{discountPct}%
          </span>
        )}
      </Link>

      {product.kicker && (
        <Mono
          color="accent"
          size="xxs"
          weight={600}
          style={{ display: 'block', marginTop: 10 }}
        >
          {product.kicker}
        </Mono>
      )}
      <Link
        href={`/products/${product.slug}`}
        className="block ft-clamp-2"
        style={{
          marginTop: 4,
          fontFamily: 'var(--font-sans)',
          fontWeight: V3FontWeight.bold,
          fontSize: 13.5,
          color: V3.ink,
          letterSpacing: '-0.015em',
          lineHeight: 1.3,
          wordBreak: 'keep-all',
        }}
      >
        {product.name}
      </Link>

      <div
        className="flex items-baseline justify-between"
        style={{
          marginTop: 8,
          paddingTop: 8,
          borderTop: `1px solid ${V3.rule}`,
        }}
      >
        <span
          className="tabular-nums"
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 13.5,
            color: V3.ink,
            letterSpacing: '-0.015em',
          }}
        >
          {product.price.toLocaleString()}원
        </span>
        <button
          onClick={onAdd}
          className="flex items-center justify-center transition active:scale-90"
          style={{
            width: 26,
            height: 26,
            borderRadius: 4,
            background: V3.ink,
            border: 'none',
            cursor: 'pointer',
          }}
          aria-label={`${product.name} 장바구니에 담기`}
        >
          <Plus size={14} color={V3.paperHi} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  )
}
