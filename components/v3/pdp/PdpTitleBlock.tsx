/**
 * PdpTitleBlock — PDP 헤로 아래 제목 + 메타 + 가격 row.
 *
 * 핸드오프 패턴 (item 62):
 *   - kicker accent "For · {dogName} · {breed}" (강아지 맞춤 표시)
 *   - 32px sans 900 name (마지막 `.` accent — italic 폐기)
 *   - meta mono mute "단백질 28% · 4kg 토이푸들 맞춤"
 *   - 가격: 큰 sans 900 + 정가 line-through + 단위 mono
 */

import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

interface PdpTitleBlockProps {
  /** 제품명. */
  name: string
  /** Kicker — "For · pur · 토이푸들" 같이. 옵션. */
  kicker?: string
  /** Meta line — "단백질 28% · 4kg 토이푸들 맞춤". */
  meta?: string
  /** 가격 (할인가 적용 — 노출가). */
  price: number
  /** 정가 (line-through). 없으면 표시 안 함. */
  originalPrice?: number | null
  /** "1.5kg" / "1팩" / "120g x 7팩" — 단위. */
  unit?: string
  /** 추가 sub line — 알러지/원산지 등. */
  sub?: string
}

export default function PdpTitleBlock({
  name,
  kicker,
  meta,
  price,
  originalPrice,
  unit,
  sub,
}: PdpTitleBlockProps) {
  const hasDiscount = originalPrice != null && originalPrice > price
  const discountPct = hasDiscount
    ? Math.round(((originalPrice! - price) / originalPrice!) * 100)
    : 0

  return (
    <section style={{ padding: '20px 20px 14px' }}>
      {kicker && (
        <Mono color="accent" size="xs" weight={600}>
          {kicker}
        </Mono>
      )}
      <h1
        style={{
          margin: kicker ? '10px 0 0' : 0,
          fontFamily: 'var(--font-sans)',
          fontWeight: V3FontWeight.black,
          fontSize: 32,
          color: V3.ink,
          lineHeight: 1.05,
          letterSpacing: '-0.025em',
          wordBreak: 'keep-all',
          textWrap: 'balance',
        }}
      >
        {name}
      </h1>
      {meta && (
        <div
          className="ft-clamp-2"
          style={{
            marginTop: 8,
            fontFamily: 'var(--font-sans)',
            fontSize: 13.5,
            color: V3.inkSoft,
            lineHeight: 1.4,
            wordBreak: 'keep-all',
          }}
        >
          {meta}
        </div>
      )}
      {sub && (
        <Mono
          color="inkMute"
          size="xs"
          weight={500}
          upper={false}
          letterSpacing="0.04em"
          style={{ display: 'block', marginTop: 4 }}
        >
          {sub}
        </Mono>
      )}

      <div
        className="flex items-baseline"
        style={{
          marginTop: 14,
          gap: 8,
          paddingTop: 14,
          borderTop: `1px solid ${V3.rule}`,
        }}
      >
        {hasDiscount && discountPct > 0 && (
          <span
            className="tabular-nums"
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: V3FontWeight.black,
              fontSize: 22,
              color: V3.sale,
              letterSpacing: '-0.025em',
            }}
          >
            {discountPct}%
          </span>
        )}
        <span
          className="tabular-nums"
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 28,
            color: V3.ink,
            letterSpacing: '-0.025em',
            lineHeight: 1,
          }}
        >
          {price.toLocaleString()}원
        </span>
        {unit && (
          <Mono color="inkMute" size="xs" weight={500} letterSpacing="0.06em">
            / {unit}
          </Mono>
        )}
        {hasDiscount && (
          <span
            className="tabular-nums"
            style={{
              marginLeft: 'auto',
              fontFamily: 'var(--font-sans)',
              fontSize: 13.5,
              color: V3.inkMute,
              textDecoration: 'line-through',
            }}
          >
            {originalPrice!.toLocaleString()}원
          </span>
        )}
      </div>
    </section>
  )
}
