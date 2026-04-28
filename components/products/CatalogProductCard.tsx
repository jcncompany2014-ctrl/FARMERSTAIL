import Link from 'next/link'
import Image from 'next/image'
import { Soup, Cookie, PackageOpen } from 'lucide-react'
import { StockOverlay } from '@/components/ui/StockBadge'
import WishlistButton from './WishlistButton'

/**
 * CatalogProductCard — 카탈로그 그리드용 ProductCard.
 *
 * 마켓컬리/SSF 톤:
 *   • 이미지 4:5 (세로 길게) — 상품 자체에 시선 집중
 *   • 좌상단 뱃지 stack: 랭킹(1/2/3) · 신상 · 정기배송 · 한정수량
 *   • 우상단 할인율 빨간 뱃지
 *   • 텍스트 패널: 카테고리 mono kicker → 제품명 (sans bold) → 짧은 설명 →
 *     가격 위계 (할인율% + 현재가 + 정가 line-through)
 *
 * 이전 ProductCard 의 editorial serif 톤은 폐기. 쇼핑몰은 sans/mono 가 표준.
 */

export type CatalogProduct = {
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
  created_at?: string | null
}

type Props = {
  product: CatalogProduct
  /** 1, 2, 3 일 때 좌상단 ranking 뱃지. 베스트 모드에서 상위 3 위에만 부여. */
  rank?: number | null
  /** 신상 모드에서 NEW dot 강조. */
  isNew?: boolean
  /** 검색 모드일 때 highlight. */
  query?: string
  /** LCP 후보 첫 카드만 priority. */
  priority?: boolean
}

function CategoryIcon({
  category,
  className,
}: {
  category: string | null
  className?: string
}) {
  if (category === '간식') {
    return (
      <Cookie
        className={className}
        strokeWidth={1.2}
        color="var(--ink)"
        style={{ opacity: 0.32 }}
      />
    )
  }
  if (category === '체험팩') {
    return (
      <PackageOpen
        className={className}
        strokeWidth={1.2}
        color="var(--ink)"
        style={{ opacity: 0.32 }}
      />
    )
  }
  return (
    <Soup
      className={className}
      strokeWidth={1.2}
      color="var(--ink)"
      style={{ opacity: 0.32 }}
    />
  )
}

export default function CatalogProductCard({
  product,
  rank = null,
  isNew = false,
  query = '',
  priority = false,
}: Props) {
  const hasSale = product.sale_price !== null
  const effective = product.sale_price ?? product.price
  const discount = hasSale
    ? Math.round(((product.price - effective) / product.price) * 100)
    : 0

  return (
    <div className="relative group">
      {/* Wishlist heart — Link 밖에 둬서 click bubbling 분리 */}
      <WishlistButton productId={product.id} productSlug={product.slug} />
      <Link
        href={`/products/${product.slug}`}
        className="block transition active:scale-[0.99]"
      >
      <div
        className="relative aspect-[4/5] overflow-hidden rounded-lg"
        style={{ background: 'var(--bg-2)' }}
      >
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
            priority={priority}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <CategoryIcon category={product.category} className="w-10 h-10" />
          </div>
        )}

        {/* 좌상단 뱃지 stack — 랭킹 / 신상 / 할인 / 정기배송 */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start z-10">
          {hasSale && discount > 0 && (
            <span
              className="font-mono text-[10px] font-black tabular-nums px-2 py-0.5 rounded-md"
              style={{
                background: 'var(--sale)',
                color: 'var(--bg)',
                letterSpacing: '0.02em',
              }}
            >
              −{discount}%
            </span>
          )}
          {rank !== null && rank <= 3 && (
            <span
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[12px] font-black tabular-nums"
              style={{
                background: 'var(--ink)',
                color: 'var(--bg)',
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.02em',
              }}
            >
              {rank}
            </span>
          )}
          {isNew && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black tracking-widest"
              style={{
                background: 'var(--terracotta)',
                color: 'var(--bg)',
              }}
            >
              NEW
            </span>
          )}
          {product.is_subscribable && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold"
              style={{
                background: 'rgba(245,240,230,0.92)',
                color: 'var(--moss)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
              }}
            >
              정기배송
            </span>
          )}
        </div>

        <StockOverlay stock={product.stock} />
      </div>

      {/* 텍스트 패널 — sans 톤. 마켓컬리/SSF 처럼 콤팩트. */}
      <div className="pt-3 md:pt-3.5">
        {product.category && (
          <div
            className="font-mono text-[9.5px] md:text-[10.5px] mb-1"
            style={{
              color: 'var(--terracotta)',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            {product.category}
          </div>
        )}

        <h3
          className="line-clamp-2 text-[13px] md:text-[14.5px]"
          style={{
            color: 'var(--ink)',
            fontWeight: 700,
            letterSpacing: '-0.015em',
            lineHeight: 1.35,
            minHeight: 36,
          }}
        >
          <Highlight text={product.name} query={query} />
        </h3>

        {product.short_description && (
          <p
            className="mt-1 text-[11px] md:text-[12px] line-clamp-1"
            style={{ color: 'var(--muted)' }}
          >
            <Highlight text={product.short_description} query={query} />
          </p>
        )}

        <div className="mt-2 md:mt-2.5 flex items-baseline gap-1.5 flex-wrap">
          {hasSale && discount > 0 && (
            <span
              className="font-black text-[14px] md:text-[16px] tabular-nums"
              style={{ color: 'var(--sale)', letterSpacing: '-0.02em' }}
            >
              {discount}%
            </span>
          )}
          <span
            className="font-black text-[16px] md:text-[18px] tabular-nums"
            style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
          >
            {effective.toLocaleString()}
          </span>
          <span
            className="text-[11px] md:text-[12px]"
            style={{ color: 'var(--muted)' }}
          >
            원
          </span>
          {hasSale && (
            <span
              className="line-through tabular-nums text-[10.5px] md:text-[12px]"
              style={{ color: 'var(--muted)' }}
            >
              {product.price.toLocaleString()}원
            </span>
          )}
        </div>
      </div>
      </Link>
    </div>
  )
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="ft-highlight">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}
