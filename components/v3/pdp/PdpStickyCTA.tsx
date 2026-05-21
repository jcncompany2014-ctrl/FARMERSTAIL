'use client'

/**
 * PdpStickyCTA — PDP 하단 고정 dual-pane CTA.
 *
 * 핸드오프 패턴 (item 65):
 *   - 좌측 가격 column: 정가 line-through (작은 mute) + sale 큰 ink + unit kicker.
 *   - 우측 큰 ink 버튼 "장바구니" + heart icon (옆에).
 *   - paperHi bg + 1px ink top + safe-area 보호.
 *
 * 사용자가 좋아요(heart) / 장바구니 액션을 한 곳에서 처리. heart 는 상태 토글.
 */

import { useState } from 'react'
import { Heart, ShoppingBag } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

interface PdpStickyCTAProps {
  /** 현재 가격 (할인가 적용). */
  price: number
  /** 정가 (line-through). 없으면 표시 안 함. */
  originalPrice?: number | null
  /** 단위 — "1.5kg" 등. */
  unit?: string
  /** 장바구니 버튼 라벨. 기본 "장바구니에 담기". */
  ctaLabel?: string
  /** 장바구니 클릭. */
  onAddToCart?: () => void
  /** 현재 wishlist 여부 (서버 props 기반 default). */
  initialWishlisted?: boolean
  /** wishlist 토글. */
  onToggleWish?: (next: boolean) => void
  /** 품절 상태 — true 면 버튼 비활성 + 텍스트 "품절". */
  soldOut?: boolean
}

export default function PdpStickyCTA({
  price,
  originalPrice,
  unit,
  ctaLabel = '장바구니에 담기',
  onAddToCart,
  initialWishlisted = false,
  onToggleWish,
  soldOut = false,
}: PdpStickyCTAProps) {
  const [wished, setWished] = useState(initialWishlisted)
  const hasDiscount = originalPrice != null && originalPrice > price

  function toggleWish() {
    const next = !wished
    setWished(next)
    onToggleWish?.(next)
  }

  return (
    <div
      className="md:hidden fixed left-0 right-0 z-50"
      style={{
        bottom: 0,
        background: V3.paperHi,
        borderTop: `1px solid ${V3.ink}`,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 12,
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
      }}
    >
      <div className="flex items-center" style={{ gap: 12 }}>
        {/* 좌측 가격 column */}
        <div className="flex flex-col min-w-0" style={{ flex: '0 0 auto' }}>
          {hasDiscount && (
            <span
              className="tabular-nums"
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 11,
                color: V3.inkMute,
                textDecoration: 'line-through',
                lineHeight: 1,
              }}
            >
              ₩ {originalPrice!.toLocaleString()}
            </span>
          )}
          <div
            className="flex items-baseline"
            style={{ marginTop: hasDiscount ? 2 : 0, gap: 4 }}
          >
            <span
              className="tabular-nums"
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: V3FontWeight.black,
                fontSize: 22,
                color: V3.ink,
                lineHeight: 1,
                letterSpacing: '-0.025em',
              }}
            >
              ₩ {price.toLocaleString()}
            </span>
            {unit && (
              <Mono color="inkMute" size="xs" weight={500} letterSpacing="0.06em">
                / {unit}
              </Mono>
            )}
          </div>
        </div>

        {/* 우측 wish + 장바구니 버튼 */}
        <button
          onClick={toggleWish}
          className="shrink-0 flex items-center justify-center transition active:scale-90"
          style={{
            width: 48,
            height: 48,
            borderRadius: 4,
            background: V3.paperHi,
            border: `1px solid ${V3.rule}`,
            cursor: 'pointer',
          }}
          aria-label={wished ? '찜 해제' : '찜하기'}
          aria-pressed={wished}
        >
          <Heart
            size={20}
            color={wished ? V3.accent : V3.ink}
            fill={wished ? V3.accent : 'none'}
            strokeWidth={2}
          />
        </button>
        <button
          onClick={onAddToCart}
          disabled={soldOut}
          className="flex-1 flex items-center justify-center transition active:scale-[0.98]"
          style={{
            height: 48,
            borderRadius: 4,
            background: soldOut ? V3.inkMute : V3.ink,
            color: V3.paperHi,
            border: 'none',
            cursor: soldOut ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.bold,
            fontSize: 14,
            letterSpacing: '-0.005em',
            gap: 8,
          }}
        >
          {!soldOut && <ShoppingBag size={16} color={V3.paperHi} strokeWidth={2} />}
          {soldOut ? '품절' : ctaLabel}
        </button>
      </div>
    </div>
  )
}
