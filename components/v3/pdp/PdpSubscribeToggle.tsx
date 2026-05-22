'use client'

/**
 * PdpSubscribeToggle — PDP 의 일회구매 vs 정기구독 인터랙티브 토글
 * (2026-05-22 R11-1).
 *
 * # 왜 만들었나
 *
 * 이전: PDP 의 "정기배송 — 최대 10% 추가 할인" 은 정적 label. 구독 CTA 가
 * 페이지 어디에도 없어서 사용자는 따로 /subscribe/[slug] 경로를 찾아야 했음.
 *
 * 이후: 가격 옆에 2개 옵션 카드 — 한 번 보고 선택. 구독 클릭하면 CTA 라벨이
 * "정기배송 신청" 으로 바뀌고 cart 가 아닌 subscribe 페이지로 라우팅.
 *
 * # 디자인 핸드오프
 *
 *   ┌────────────────────────────────────┬────────────────────────────────────┐
 *   │ ○ 한 번만 구매                       │ ● 정기배송  [-10%]                 │
 *   │   ₩29,000                           │   ₩26,100                          │
 *   │   1.5kg                             │   격주 자동 배송                    │
 *   └────────────────────────────────────┴────────────────────────────────────┘
 *
 * - 활성 카드: 1.5px ink border + paperHi bg + 우상단 radio dot.
 * - 비활성: 1px rule + paper bg (살짝 차분).
 * - 구독 카드 우상단에 yellow "-10%" Badge.
 *
 * # API
 *
 *   <PdpSubscribeToggle
 *     value={mode}
 *     onChange={setMode}
 *     oneTimePrice={29000}
 *     subscribePrice={26100}
 *     subscribeDiscountPct={10}
 *     unit="1.5kg"
 *   />
 */

import { V3, V3FontWeight, V3Radius } from '@/lib/design/tokens'
import { Mono, Badge } from '@/components/v3'

export type PurchaseMode = 'one-time' | 'subscribe'

interface PdpSubscribeToggleProps {
  /** 현재 선택된 모드. */
  value: PurchaseMode
  /** 모드 변경 콜백. */
  onChange: (mode: PurchaseMode) => void
  /** 일회 구매 가격 (할인 적용 후). */
  oneTimePrice: number
  /** 정기 구독 가격 (oneTimePrice 에서 추가 할인 적용 후). */
  subscribePrice: number
  /** 정기 구독 추가 할인율 % — Badge 표시용. 기본 10. */
  subscribeDiscountPct?: number
  /** 단위 표시 (1.5kg, 500g 등). 옵션. */
  unit?: string
  /** 정기 배송 주기 라벨. 기본 "격주 자동 배송". */
  cadenceLabel?: string
}

export default function PdpSubscribeToggle({
  value,
  onChange,
  oneTimePrice,
  subscribePrice,
  subscribeDiscountPct = 10,
  unit,
  cadenceLabel = '격주 자동 배송',
}: PdpSubscribeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="구매 방식"
      className="grid grid-cols-2"
      style={{ gap: 8 }}
    >
      <ModeCard
        active={value === 'one-time'}
        onClick={() => onChange('one-time')}
        label="한 번만 구매"
        price={oneTimePrice}
        sub={unit ?? '단품'}
      />
      <ModeCard
        active={value === 'subscribe'}
        onClick={() => onChange('subscribe')}
        label="정기배송"
        price={subscribePrice}
        sub={cadenceLabel}
        accentBadge={`-${subscribeDiscountPct}%`}
      />
    </div>
  )
}

function ModeCard({
  active,
  onClick,
  label,
  price,
  sub,
  accentBadge,
}: {
  active: boolean
  onClick: () => void
  label: string
  price: number
  sub: string
  accentBadge?: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className="relative text-left transition active:scale-[0.99]"
      style={{
        padding: '12px 14px',
        borderRadius: V3Radius.sm,
        background: active ? V3.paperHi : V3.paper,
        border: active ? `1.5px solid ${V3.ink}` : `1px solid ${V3.rule}`,
        cursor: 'pointer',
      }}
    >
      {/* radio dot 우상단 */}
      <span
        aria-hidden
        className="absolute"
        style={{
          top: 12,
          right: 12,
          width: 14,
          height: 14,
          borderRadius: 7,
          background: active ? V3.ink : 'transparent',
          border: active ? 'none' : `1.5px solid ${V3.inkMute}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {active && (
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              background: V3.paperHi,
            }}
          />
        )}
      </span>

      {/* 할인 badge */}
      {accentBadge && (
        <div
          className="absolute"
          style={{ top: -8, left: 12 }}
        >
          <Badge tone="yellow" filled size="sm">
            {accentBadge}
          </Badge>
        </div>
      )}

      {/* 라벨 */}
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          fontWeight: V3FontWeight.bold,
          color: V3.ink,
          letterSpacing: '-0.01em',
          paddingRight: 22, // radio dot 자리
        }}
      >
        {label}
      </div>

      {/* 가격 */}
      <div
        className="flex items-baseline tabular-nums"
        style={{ marginTop: 6, gap: 3 }}
      >
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 18,
            fontWeight: V3FontWeight.black,
            color: V3.ink,
            letterSpacing: '-0.025em',
            lineHeight: 1,
          }}
        >
          ₩{price.toLocaleString()}
        </span>
      </div>

      {/* 보조 라벨 */}
      <Mono
        color="inkMute"
        size="xxs"
        weight={500}
        letterSpacing="0.06em"
        style={{ marginTop: 6, display: 'inline-block' }}
      >
        {sub}
      </Mono>
    </button>
  )
}
