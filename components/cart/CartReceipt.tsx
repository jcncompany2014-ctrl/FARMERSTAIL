'use client'

/**
 * CartReceipt — 모바일 카트 결제 미리보기 카드 + Quick pay (2026-05-21).
 *
 * 핸드오프 패턴:
 *   - "RECEIPT · 결제 미리보기" kicker + breakdown rows
 *   - hairline divider → 총 결제 금액 큰 숫자 (terracotta)
 *   - "결제 시 NP 적립 예정" sage tinted banner
 *   - QUICK PAY 4 buttons (시각만, 모두 /checkout 로)
 */

import Link from 'next/link'
import { Sparkles } from 'lucide-react'

interface Props {
  subtotal: number
  shipping: number
  /** 1% 자동 적립 추정치 (체크아웃에서 실제 결제 후 적립 확정) */
  pointsEarned: number
  /** 무료배송까지 모자란 금액 — 0 이면 무료 */
  remainingToFree: number
}

const QUICK_PAY: Array<{ label: string; bg: string; fg: string }> = [
  { label: '카카오페이', bg: '#fee500', fg: '#3c1e1e' },
  { label: '토스페이', bg: '#0064ff', fg: '#fff' },
  { label: '네이버페이', bg: '#03c75a', fg: '#fff' },
  { label: '카드', bg: '#fbf3df', fg: '#1a140c' },
]

export default function CartReceipt({
  subtotal,
  shipping,
  pointsEarned,
  remainingToFree,
}: Props) {
  const total = subtotal + shipping
  const isFreeShipping = shipping === 0

  return (
    <div className="md:hidden">
      <section className="px-4 pt-2 pb-0">
        <div
          className="bg-white"
          style={{
            borderRadius: 22,
            padding: 18,
            boxShadow:
              '0 4px 16px rgba(26,20,12,0.06), 0 2px 8px rgba(26,20,12,0.04)',
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
              className="font-['Archivo_Black']"
              style={{ fontSize: 16, color: '#1a140c' }}
            >
              총 결제 금액
            </span>
            <div className="text-right">
              <div
                className="font-['Archivo_Black'] tabular-nums"
                style={{
                  fontSize: 28,
                  color: '#dc532a',
                  lineHeight: 1,
                  letterSpacing: '-0.025em',
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
              borderRadius: 10,
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

      {/* QUICK PAY */}
      <section className="px-4 pt-4">
        <div
          style={{
            fontSize: 10,
            color: '#7a6d5b',
            fontWeight: 700,
            letterSpacing: 2,
            marginBottom: 8,
          }}
        >
          QUICK PAY · 빠른 결제
        </div>
        <div className="grid grid-cols-4 gap-2">
          {QUICK_PAY.map((p) => (
            <Link
              key={p.label}
              href="/checkout"
              className="text-center font-bold transition active:scale-95"
              style={{
                background: p.bg,
                color: p.fg,
                borderRadius: 14,
                padding: '12px 6px',
                fontSize: 11,
              }}
            >
              {p.label}
            </Link>
          ))}
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
