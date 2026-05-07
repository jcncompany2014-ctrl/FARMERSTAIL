'use client'

import { Check, Clock, Lock, X } from 'lucide-react'

/**
 * 쿠폰 카드 — 마켓컬리 / SSF / 쿠팡 톤의 시인성 좋은 디자인.
 *
 * # 디자인
 * 좌측 60px: 큰 할인 금액 (terracotta 강조)
 * 점선 컷 (수직 점선) — 실물 쿠폰처럼 분리감
 * 우측 flex-1: 이름 / 조건 / D-day / CTA
 *
 * # 상태 (state prop)
 *  - 'available'    — 사용 가능. terracotta accent, 클릭 가능
 *  - 'unavailable'  — 조건 미충족 (min_order_amount 미달). gold accent + 안내
 *  - 'used'         — 이미 사용됨. 회색 + "사용 완료" 도장
 *  - 'expired'      — 만료. 회색 격자 패턴 + "기한 만료"
 *
 * # 액션
 *  - onApply: 적용 모드 (체크아웃 sheet 등) — 카드 자체 클릭으로 트리거
 *  - onCopy: 코드 복사 모드 (쿠폰함) — 카드 클릭 시 복사
 *  - 둘 다 없으면 read-only
 *
 * # D-day
 * expires_at 이 7일 이내면 "D-N" 빨간 배지. 만료된 건 'expired' state 로.
 */

export type CouponCardData = {
  id: string
  code: string
  name: string
  description: string | null
  discount_type: 'percent' | 'fixed'
  discount_value: number
  min_order_amount: number
  max_discount: number | null
  expires_at: string | null
}

export type CouponCardState = 'available' | 'unavailable' | 'used' | 'expired'

export type CouponCardProps = {
  coupon: CouponCardData
  state: CouponCardState
  /** state='unavailable' 일 때 표시할 한 줄 안내. 예: "5,000원 더 담으면 사용 가능". */
  unavailableHint?: string
  /** 'best deal' 뱃지 — 가장 큰 할인 자동 추천. */
  recommended?: boolean
  /** 적용 모드 — 카드 클릭 시 호출. state='available' 일 때만 활성. */
  onApply?: () => void
  /** 복사 모드 — 카드 우측에 코드 복사 버튼 노출. */
  onCopy?: () => void
  /** 복사 직후 1.5s 동안 true 로 두면 "복사됨" 표시. */
  copied?: boolean
}

function formatDiscount(c: CouponCardData): {
  big: string
  small: string
} {
  if (c.discount_type === 'percent') {
    return { big: String(c.discount_value), small: '%' }
  }
  // 만원 단위 큰 숫자는 "1만" 처럼 단위 분리.
  if (c.discount_value >= 10000) {
    const man = Math.floor(c.discount_value / 10000)
    const rest = c.discount_value % 10000
    if (rest === 0) return { big: String(man), small: '만원' }
    return { big: `${man}.${Math.floor(rest / 1000)}`, small: '만원' }
  }
  if (c.discount_value >= 1000) {
    return {
      big: `${Math.floor(c.discount_value / 1000)}`,
      small: '천원',
    }
  }
  return { big: c.discount_value.toLocaleString(), small: '원' }
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const target = new Date(iso).getTime()
  const now = Date.now()
  return Math.ceil((target - now) / 86_400_000)
}

function formatExpiry(iso: string | null): string {
  if (!iso) return '상시'
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}까지`
}

export default function CouponCard({
  coupon,
  state,
  unavailableHint,
  recommended,
  onApply,
  onCopy,
  copied,
}: CouponCardProps) {
  const { big, small } = formatDiscount(coupon)
  const days = daysUntil(coupon.expires_at)
  const isUrgent = days !== null && days >= 0 && days <= 7
  const isClickable = state === 'available' && !!onApply
  const isInactive = state === 'used' || state === 'expired'

  // 색상 매핑
  const accentColor = (() => {
    if (state === 'available') return 'var(--terracotta)'
    if (state === 'unavailable') return 'var(--gold)'
    return 'var(--muted)'
  })()
  const bg = isInactive ? 'var(--bg-2)' : 'white'
  const opacity = isInactive ? 0.55 : 1

  const handleCardClick = () => {
    if (isClickable) onApply?.()
  }

  return (
    <div
      onClick={handleCardClick}
      className={`relative overflow-hidden rounded-xl flex transition ${
        isClickable ? 'cursor-pointer hover:shadow-md active:scale-[0.99]' : ''
      }`}
      style={{
        background: bg,
        opacity,
        border: `1px solid ${
          state === 'available' ? 'var(--rule)' : 'var(--rule-2)'
        }`,
        boxShadow:
          state === 'available'
            ? '0 1px 0 rgba(30,26,20,0.02)'
            : 'none',
      }}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : -1}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onApply?.()
        }
      }}
    >
      {/* 좌측 — 할인 금액 큰 표기 */}
      <div
        className="shrink-0 w-[100px] flex flex-col items-center justify-center py-4 px-2 text-center"
        style={{
          background:
            state === 'available'
              ? 'color-mix(in srgb, var(--terracotta) 6%, white)'
              : state === 'unavailable'
                ? 'color-mix(in srgb, var(--gold) 8%, white)'
                : 'var(--bg-2)',
          borderRight: `1px dashed ${
            state === 'available' ? 'var(--rule-2)' : 'var(--rule-2)'
          }`,
        }}
      >
        <div className="flex items-baseline gap-0.5">
          <span
            className="font-serif font-black leading-none"
            style={{
              fontSize: big.length >= 4 ? 22 : 28,
              color: accentColor,
              letterSpacing: '-0.02em',
            }}
          >
            {big}
          </span>
          <span
            className="font-bold"
            style={{
              fontSize: 11,
              color: accentColor,
            }}
          >
            {small}
          </span>
        </div>
        <span
          className="kicker mt-1"
          style={{ color: accentColor, fontSize: 9 }}
        >
          DISCOUNT
        </span>
      </div>

      {/* 점선 컷 — 시각적 분리감 */}
      {/* (좌측 div 의 borderRight 가 이미 dashed 라 별도 element 없이 처리됨) */}

      {/* 우측 — 이름 / 조건 / D-day */}
      <div className="flex-1 min-w-0 px-4 py-3.5 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            {recommended && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: 'var(--terracotta)', color: 'white' }}
              >
                BEST
              </span>
            )}
            {isUrgent && state === 'available' && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-0.5"
                style={{
                  background: 'var(--sale)',
                  color: 'white',
                }}
              >
                <Clock className="w-2.5 h-2.5" strokeWidth={2.5} />
                D-{days}
              </span>
            )}
          </div>
          <h3
            className="text-[13px] font-black leading-tight"
            style={{ color: isInactive ? 'var(--muted)' : 'var(--ink)' }}
          >
            {coupon.name}
          </h3>
          <div
            className="mt-1 text-[10.5px] leading-relaxed"
            style={{ color: 'var(--muted)' }}
          >
            {coupon.min_order_amount > 0 && (
              <span>
                {coupon.min_order_amount.toLocaleString()}원 이상
              </span>
            )}
            {coupon.min_order_amount > 0 && coupon.max_discount && <span> · </span>}
            {coupon.max_discount && (
              <span>최대 {coupon.max_discount.toLocaleString()}원</span>
            )}
          </div>
        </div>

        <div className="flex items-end justify-between mt-2 gap-2">
          <span
            className="text-[10px] font-mono font-bold"
            style={{ color: 'var(--muted)' }}
          >
            {formatExpiry(coupon.expires_at)}
          </span>

          {/* 우측 액션 */}
          {state === 'available' && onApply && (
            <span
              className="shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10.5px] font-bold"
              style={{
                background: 'var(--terracotta)',
                color: 'white',
              }}
            >
              적용하기
            </span>
          )}
          {state === 'available' && !onApply && onCopy && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onCopy()
              }}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold transition"
              style={{
                borderColor: copied ? 'var(--moss)' : 'var(--rule)',
                color: copied ? 'var(--moss)' : 'var(--ink)',
              }}
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" strokeWidth={2.5} />
                  복사됨
                </>
              ) : (
                <span className="font-mono">{coupon.code}</span>
              )}
            </button>
          )}
          {state === 'unavailable' && unavailableHint && (
            <span
              className="text-[10px] font-bold"
              style={{ color: 'var(--gold)' }}
            >
              {unavailableHint}
            </span>
          )}
        </div>
      </div>

      {/* 사용 / 만료 도장 (overlay) */}
      {state === 'used' && (
        <div className="absolute top-2 right-2">
          <span
            className="inline-flex items-center gap-1 text-[9.5px] font-bold px-2 py-0.5 rounded"
            style={{
              border: '1px solid var(--muted)',
              color: 'var(--muted)',
              transform: 'rotate(-3deg)',
            }}
          >
            <Check className="w-2.5 h-2.5" strokeWidth={2.5} />
            사용완료
          </span>
        </div>
      )}
      {state === 'expired' && (
        <div className="absolute top-2 right-2">
          <span
            className="inline-flex items-center gap-1 text-[9.5px] font-bold px-2 py-0.5 rounded"
            style={{
              border: '1px solid var(--muted)',
              color: 'var(--muted)',
              transform: 'rotate(-3deg)',
            }}
          >
            <X className="w-2.5 h-2.5" strokeWidth={2.5} />
            기한 만료
          </span>
        </div>
      )}
      {state === 'unavailable' && (
        <div className="absolute top-2 right-2">
          <Lock
            className="w-3 h-3"
            style={{ color: 'var(--muted)' }}
            strokeWidth={2}
          />
        </div>
      )}
    </div>
  )
}
