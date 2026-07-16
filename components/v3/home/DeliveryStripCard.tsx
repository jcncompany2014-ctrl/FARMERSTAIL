/**
 * DeliveryStripCard — 다음 정기배송 D-1 가로 strip 카드.
 *
 * 핸드오프 패턴:
 *   - paperHi card + 1px rule
 *   - 좌측: 38×38 ink square + yellow truck icon
 *   - 본문: D-N accent + "· 정기배송" mute → "내일 새벽 도착 · 닭가슴살 1.5kg"
 *   - 우측: chevron arrow
 */

import Link from 'next/link'
import { Truck, ArrowRight } from 'lucide-react'
import { V3, V3FontWeight, V3FontSize } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

interface DeliveryStripCardProps {
  /** "D-1" / "D-Day" / "D-3" 등. */
  dLabel: string
  /** "정기배송" / "이번 주문" 등. */
  channelLabel?: string
  /** 도착 라벨 — "내일 새벽 도착". */
  arrivalLabel: string
  /** 도착 상품 — "닭가슴살 1.5kg" 등. */
  itemLabel: string
  /** 상세로 이동할 href. */
  href?: string
}

export default function DeliveryStripCard({
  dLabel,
  channelLabel = '정기배송',
  arrivalLabel,
  itemLabel,
  // 정기배송 관리 정본 라우트 = /account/subscriptions (옛 /mypage/subscriptions 는
  // 이 경로로 리다이렉트되는 호환용). 호출부 미지정 시에도 안전한 정본 기본값.
  href = '/account/subscriptions',
}: DeliveryStripCardProps) {
  const inner = (
    <div
      className="ft-card-v3 flex items-center"
      style={{ padding: '12px 14px', gap: 12 }}
    >
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: 38,
          height: 38,
          borderRadius: 4,
          background: V3.ink,
        }}
        aria-hidden
      >
        <Truck size={18} color={V3.yellow} strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center" style={{ gap: 6 }}>
          <Mono color="accent" size="xxs" weight={700}>
            {dLabel}
          </Mono>
          <Mono color="inkMute" size="xxs" weight={500}>
            · {channelLabel}
          </Mono>
        </div>
        <div
          className="ft-clamp-1"
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.bold,
            fontSize: V3FontSize.base,
            color: V3.ink,
            marginTop: 3,
            letterSpacing: '-0.015em',
            wordBreak: 'keep-all',
          }}
        >
          {arrivalLabel} · {itemLabel}
        </div>
      </div>
      <ArrowRight size={14} color={V3.inkMute} strokeWidth={2} />
    </div>
  )
  return (
    <section style={{ padding: '0 20px 30px' }}>
      {href ? (
        <Link href={href} className="block transition-transform active:scale-[0.99]">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </section>
  )
}
