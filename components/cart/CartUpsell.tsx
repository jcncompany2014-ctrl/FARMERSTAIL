'use client'

/**
 * CartUpsell — 모바일 장바구니 mid-section (2026-05-21).
 *
 * 핸드오프 cp-cart.jsx 의 4개 row 모음:
 *   1. Sage 정기배송 upsell 배너 (전환 → /products?subscribable=1)
 *   2. 선물 포장 toggle (로컬 client state — v2에서 결제 sync)
 *   3. 쿠폰 사용 row (→ /account/coupons)
 *   4. 적립금 사용 row (→ /account/points)
 */

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, Gift, Sparkles, ChevronRight } from 'lucide-react'
import CheckoutCouponSheet from '@/components/coupons/CheckoutCouponSheet'
import { useCartCoupon } from './CartCouponContext'

interface Props {
  /** 사용자가 보유한 쿠폰 수 (없으면 0) */
  couponCount?: number
  /** 사용자가 보유한 적립금 */
  pointsBalance?: number
  /** 적립금 사용 가능 최소 금액 */
  pointsMinUse?: number
  /** 'web' (기본) 또는 'app' — v3 톤 분기 (R14 cleanup) */
  variant?: 'web' | 'app'
}

export default function CartUpsell({
  pointsBalance = 0,
  pointsMinUse = 5000,
  variant = 'web',
}: Props) {
  const [giftWrap, setGiftWrap] = useState(false)
  // 장바구니 쿠폰(앱) — Provider 안에서만 실제 값. 밖이면 NOOP(쿠폰 없음).
  const cartCoupon = useCartCoupon()
  const isApp = variant === 'app'
  // v3 톤: 카드 radius 18 → 8, 내부 chip radius 10/12 → 4/4
  const cardRadius = isApp ? 8 : 18
  const chipRadius = isApp ? 4 : 10

  return (
    <div className="md:hidden">
      {/* 1. Sage 정기배송 upsell */}
      <section className="px-4 pt-3 pb-3">
        <Link
          href="/products?subscribable=1"
          className="relative flex items-center gap-3 overflow-hidden"
          style={{
            background: '#5d6f3f',
            borderRadius: isApp ? 8 : 20,
            padding: '14px 16px',
            color: '#fff',
          }}
        >
          <span
            className="absolute pointer-events-none"
            style={{
              right: -20,
              top: -20,
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.13)',
            }}
          />
          <Calendar size={26} color="#fff" strokeWidth={1.8} />
          <div className="flex-1 relative min-w-0">
            <div
              className="font-['Archivo_Black']"
              style={{ fontSize: 13, lineHeight: 1.15 }}
            >
              정기배송으로 바꾸면 추가 10%↓
            </div>
            <div
              className="mt-0.5"
              style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              2주마다 자동 · 언제든 일시정지
            </div>
          </div>
          <span
            className="font-bold"
            style={{
              padding: '7px 12px',
              background: '#fff',
              color: '#5d6f3f',
              borderRadius: 999,
              fontSize: 11,
              position: 'relative',
            }}
          >
            전환
          </span>
        </Link>
      </section>

      {/* 2. 선물 포장 toggle */}
      <section className="px-4 pb-3">
        <div
          className="flex items-center gap-2.5 bg-white"
          style={{
            borderRadius: cardRadius,
            padding: '12px 14px',
            boxShadow: isApp ? '0 1px 0 rgba(22,20,15,0.04)' : '0 2px 8px rgba(26,20,12,0.06)',
            border: isApp ? '1px solid var(--rule)' : undefined,
            background: isApp ? 'var(--bg-3)' : undefined,
          }}
        >
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 32,
              height: 32,
              borderRadius: chipRadius,
              background: 'rgba(220, 83, 42, 0.12)',
              color: '#dc532a',
            }}
          >
            <Gift size={18} color="#dc532a" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="font-['Archivo_Black']"
              style={{
                fontSize: 12,
                color: '#1a140c',
                letterSpacing: '-0.005em',
              }}
            >
              선물 포장 추가
            </div>
            <div className="mt-0.5" style={{ fontSize: 10, color: '#7a6d5b' }}>
              리본 + 손편지 카드 · +1,500원
            </div>
          </div>
          <button
            onClick={() => setGiftWrap((v) => !v)}
            className="flex items-center transition shrink-0"
            style={{
              width: 42,
              height: 24,
              borderRadius: 12,
              background: giftWrap ? '#dc532a' : '#fbf3df',
              padding: 2,
              justifyContent: giftWrap ? 'flex-end' : 'flex-start',
            }}
            aria-label={giftWrap ? '선물 포장 끄기' : '선물 포장 켜기'}
            aria-pressed={giftWrap}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                background: '#fff',
                boxShadow: '0 1px 3px rgba(26,20,12,0.16)',
                display: 'block',
              }}
            />
          </button>
        </div>
      </section>

      {/* 3. 쿠폰 — 인라인 시트. 쿠폰함 페이지로 튕기지 않고 그 자리에서 사용
          가능한 쿠폰이 뜨고 '적용하기' 1탭으로 적용 → 아래 영수증/결제바에 즉시
          할인 반영(체크아웃과 동일한 CheckoutCouponSheet 재사용). */}
      <section className="px-4 pb-3">
        <CheckoutCouponSheet
          subtotal={cartCoupon.subtotal}
          applied={cartCoupon.applied}
          onApply={cartCoupon.applyByCode}
          onRemove={cartCoupon.remove}
        />
      </section>

      {/* 4. 적립금 row */}
      <section className="px-4 pb-3">
        <Link
          href="/mypage/points"
          className="flex items-center gap-2.5 bg-white"
          style={{
            borderRadius: cardRadius,
            padding: '14px 16px',
            boxShadow: isApp ? '0 1px 0 rgba(22,20,15,0.04)' : '0 2px 8px rgba(26,20,12,0.06)',
            border: isApp ? '1px solid var(--rule)' : undefined,
            background: isApp ? 'var(--bg-3)' : undefined,
          }}
        >
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 36,
              height: 36,
              borderRadius: isApp ? 4 : 12,
              background: 'rgba(232, 168, 46, 0.18)',
              color: '#a87520',
            }}
          >
            <Sparkles size={18} color="#a87520" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div
              className="font-['Archivo_Black']"
              style={{
                fontSize: 12,
                color: '#1a140c',
                letterSpacing: '-0.005em',
              }}
            >
              적립금 사용
            </div>
            <div className="mt-0.5" style={{ fontSize: 10, color: '#7a6d5b' }}>
              보유{' '}
              <span style={{ color: '#1a140c', fontWeight: 700 }}>
                {pointsBalance.toLocaleString()}P
              </span>{' '}
              · {pointsMinUse.toLocaleString()}P부터 사용 가능
            </div>
          </div>
          <ChevronRight size={16} color="#7a6d5b" strokeWidth={1.8} />
        </Link>
      </section>
    </div>
  )
}
