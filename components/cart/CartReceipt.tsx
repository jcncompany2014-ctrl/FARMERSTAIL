'use client'

/**
 * CartReceipt — 모바일 카트 결제 미리보기 카드 (2026-05-21).
 *
 * 핸드오프 패턴:
 *   - "RECEIPT · 결제 미리보기" kicker + breakdown rows
 *   - hairline divider → 총 결제 금액 큰 숫자 (terracotta)
 *   - "결제 시 NP 적립 예정" sage tinted banner
 *   - 실제 결제 진입은 CartStickyCTA(하단 고정 "결제하기")가 담당
 *
 * # variant prop (R14 cleanup)
 *
 * web / app 톤 분기. 같은 컴포넌트 안에서 styling 만 다르게 — 코드 fork
 * 없이 web editorial 톤 보존 + app v3 톤 적용.
 *
 *   - web (default): borderRadius 22/14, archivo black 폰트, 기존 톤
 *   - app: borderRadius 12/4 (V3Radius.md/sm), sans 폰트 통일, v3 grammar
 */

import { Sparkles } from 'lucide-react'

interface Props {
  subtotal: number
  shipping: number
  /** 1% 자동 적립 추정치 (체크아웃에서 실제 결제 후 적립 확정) */
  pointsEarned: number
  /** 무료배송까지 모자란 금액 — 0 이면 무료 */
  remainingToFree: number
  /** 'web' (기본) 또는 'app' — v3 톤 분기. */
  variant?: 'web' | 'app'
}

export default function CartReceipt({
  subtotal,
  shipping,
  pointsEarned,
  remainingToFree,
  variant = 'web',
}: Props) {
  const total = subtotal + shipping
  const isFreeShipping = shipping === 0
  const isApp = variant === 'app'

  // v3 톤은 둥근 모서리 ↓ + 그림자 ↓ + 폰트 sans 통일.
  const cardRadius = isApp ? 12 : 22
  const cardBg = isApp ? 'var(--bg-3)' : '#ffffff'
  const cardShadow = isApp
    ? '0 1px 0 rgba(22,20,15,0.04)'
    : '0 4px 16px rgba(26,20,12,0.06), 0 2px 8px rgba(26,20,12,0.04)'
  const totalFontFamily = isApp
    ? "var(--font-sans), 'Pretendard', sans-serif"
    : undefined
  const totalLetterSpacing = isApp ? '-0.015em' : '-0.025em'

  return (
    <div className="md:hidden">
      <section className="px-4 pt-3 pb-3">
        <div
          style={{
            background: cardBg,
            borderRadius: cardRadius,
            padding: 16,
            boxShadow: cardShadow,
            border: isApp ? '1px solid var(--rule)' : undefined,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: '#dc532a',
              fontWeight: 700,
              letterSpacing: 2,
              marginBottom: 12,
            }}
          >
            RECEIPT · 결제 미리보기
          </div>

          <ReceiptRow label="상품 금액" value={`${subtotal.toLocaleString()}원`} />
          <ReceiptRow
            label="배송비"
            value={isFreeShipping ? '무료' : `+${shipping.toLocaleString()}원`}
            valueColor={isFreeShipping ? '#5d6f3f' : undefined}
          />
          {!isFreeShipping && remainingToFree > 0 && (
            <div
              className="text-right tabular-nums"
              style={{ fontSize: 10, color: '#7a6d5b', marginTop: -4 }}
            >
              {remainingToFree.toLocaleString()}원 더 담으면 무료
            </div>
          )}

          <div
            style={{
              height: 1,
              background: 'rgba(26,20,12,0.07)',
              margin: '10px 0',
            }}
          />

          <div className="flex justify-between items-baseline">
            <span
              className={isApp ? undefined : "font-['Archivo_Black']"}
              style={{
                fontSize: 16,
                color: '#1a140c',
                fontFamily: totalFontFamily,
                fontWeight: isApp ? 900 : undefined,
                letterSpacing: isApp ? '-0.015em' : undefined,
              }}
            >
              총 결제 금액
            </span>
            <div className="text-right">
              <div
                className={`${isApp ? '' : "font-['Archivo_Black']"} tabular-nums`}
                style={{
                  fontSize: 28,
                  color: '#dc532a',
                  lineHeight: 1,
                  letterSpacing: totalLetterSpacing,
                  fontFamily: totalFontFamily,
                  fontWeight: isApp ? 900 : undefined,
                }}
              >
                {total.toLocaleString()}
                <span
                  style={{
                    fontSize: 14,
                    color: '#7a6d5b',
                    marginLeft: 2,
                    fontWeight: 400,
                  }}
                >
                  원
                </span>
              </div>
            </div>
          </div>

          <div
            className="flex items-center gap-1.5 mt-2.5"
            style={{
              padding: '8px 12px',
              background: 'rgba(93, 111, 63, 0.13)',
              borderRadius: isApp ? 4 : 10,
              fontSize: 11,
              color: '#5d6f3f',
              fontWeight: 700,
            }}
          >
            <Sparkles size={14} color="#5d6f3f" strokeWidth={1.8} />
            결제 시 {pointsEarned.toLocaleString()}P 적립 예정
          </div>
        </div>
      </section>

    </div>
  )
}

function ReceiptRow({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div className="flex justify-between" style={{ padding: '7px 0' }}>
      <span style={{ fontSize: 13, color: '#7a6d5b' }}>{label}</span>
      <span
        className="tabular-nums"
        style={{
          fontSize: 13,
          color: valueColor ?? '#1a140c',
          fontWeight: 600,
        }}
      >
        {value}
      </span>
    </div>
  )
}
