'use client'

/**
 * CartAddMore — 모바일 cart 의 "ADD MORE · 함께 사면 좋아요" 가로 스크롤 (2026-05-21).
 *
 * 핸드오프 패턴: 작은 카드 (140px wide), photo + 카테고리 tag + name + price + + 버튼.
 * 카트 빈 상태 추천에 쓰는 emptyRecs query 와 동일한 source 를 재활용.
 */

import Image from 'next/image'
import Link from 'next/link'
import { ShoppingBag } from 'lucide-react'
import { BLUR_BG2 } from '@/lib/ui/blur'
import { type CatalogProduct } from '@/components/products/CatalogProductCard'
import { CAT_META, type CatKey } from '@/lib/cart/category-meta'
import CartAddMoreButton from './CartAddMoreButton'

interface Props {
  products: CatalogProduct[]
}

export default function CartAddMore({ products }: Props) {
  if (products.length === 0) return null

  return (
    <section className="md:hidden">
      <div className="px-5 pt-2 pb-3">
        <div
          style={{
            fontSize: 10,
            color: '#dc532a',
            fontWeight: 700,
            letterSpacing: 2,
            marginBottom: 3,
          }}
        >
          ADD MORE · 함께 사면 좋아요
        </div>
        <h2
          className="font-['Archivo_Black']"
          style={{
            fontSize: 22,
            color: '#1a140c',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          이런 메뉴는 어때요?
        </h2>
      </div>
      <div
        className="flex gap-2.5 overflow-x-auto pb-3 px-4"
        style={{
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {products.map((p) => {
          const cat = (p.category as CatKey | null | undefined)
            ? CAT_META[p.category as CatKey]
            : null
          const price = p.sale_price ?? p.price
          const hasSale = p.sale_price !== null
          const discountPct = hasSale
            ? Math.round(((p.price - p.sale_price!) / p.price) * 100)
            : 0
          return (
            <div
              key={p.id}
              className="shrink-0 bg-white"
              style={{
                flex: '0 0 140px',
                borderRadius: 16,
                padding: 8,
                boxShadow: '0 2px 8px rgba(26,20,12,0.04)',
              }}
            >
              <Link
                href={`/products/${p.slug}`}
                className="block relative overflow-hidden"
                style={{
                  height: 90,
                  borderRadius: 10,
                  background: '#fbf3df',
                }}
              >
                {p.image_url ? (
                  <Image
                    src={p.image_url}
                    alt={p.name}
                    fill
                    sizes="140px"
                    placeholder="blur"
                    blurDataURL={BLUR_BG2}
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag size={20} color="#7a6d5b" strokeWidth={1.5} />
                  </div>
                )}
              </Link>
              <div className="flex gap-1 flex-wrap items-center mt-2">
                {cat && (
                  <span
                    className="inline-flex items-center font-bold"
                    style={{
                      padding: '2px 6px',
                      background: cat.bg,
                      color: cat.fg,
                      borderRadius: 5,
                      fontSize: 9,
                      letterSpacing: 0.2,
                    }}
                  >
                    {cat.label}
                  </span>
                )}
                {hasSale && discountPct > 0 && (
                  <span
                    className="inline-flex items-center font-bold"
                    style={{
                      padding: '2px 6px',
                      background: '#dc532a',
                      color: '#fff',
                      borderRadius: 5,
                      fontSize: 9,
                    }}
                  >
                    −{discountPct}%
                  </span>
                )}
              </div>
              <Link
                href={`/products/${p.slug}`}
                className="font-['Archivo_Black'] block mt-1 leading-tight"
                style={{
                  fontSize: 11,
                  color: '#1a140c',
                  letterSpacing: '-0.005em',
                }}
              >
                {p.name}
              </Link>
              <div className="flex items-baseline justify-between mt-1.5">
                <span
                  className="font-['Archivo_Black'] tabular-nums"
                  style={{
                    fontSize: 13,
                    color: '#1a140c',
                  }}
                >
                  {price.toLocaleString()}
                  <span
                    style={{
                      fontSize: 9,
                      color: '#7a6d5b',
                      fontWeight: 400,
                      marginLeft: 1,
                    }}
                  >
                    원
                  </span>
                </span>
                <CartAddMoreButton productId={p.id} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
