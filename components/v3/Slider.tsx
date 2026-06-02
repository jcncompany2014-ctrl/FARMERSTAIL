'use client'

/**
 * Slider — v3 range 슬라이더.
 *
 * **앱 컨텍스트 전용.** 체중 / BCS / 알레르기 강도 등 연속값 입력.
 *
 * # API
 *
 *   <Slider value={weight} onChange={setWeight} min={1} max={50} step={0.1} unit="kg" />
 *
 * # 디자인
 *
 *  - track 4px paperDeep + 1.5px ruleSoft
 *  - fill ink (or accent/sage)
 *  - thumb 20×20 paperHi + 2px ink ring
 *  - value bubble — focus 시 thumb 위에 px+unit 표시
 *
 * # 접근성
 *
 *  - native <input type=range> 활용 — 키보드 (arrow) 및 SR 모두 무료.
 *  - aria-valuetext = `${value} ${unit}` 으로 SR 친화.
 */

import { type ChangeEvent } from 'react'
import { V3, V3FontWeight } from '@/lib/design/tokens'

interface SliderProps {
  value: number
  onChange: (next: number) => void
  min: number
  max: number
  step?: number
  unit?: string
  tone?: 'ink' | 'accent' | 'sage'
  disabled?: boolean
  ariaLabel?: string
  /** 우상단에 현재값 표시. 기본 true. */
  showValue?: boolean
}

const TONE_COLOR: Record<NonNullable<SliderProps['tone']>, string> = {
  ink: V3.ink,
  accent: V3.accent,
  sage: V3.sage,
}

export default function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  tone = 'ink',
  disabled = false,
  ariaLabel,
  showValue = true,
}: SliderProps) {
  const fillColor = TONE_COLOR[tone]
  const pct = ((value - min) / (max - min)) * 100

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const next = Number(e.target.value)
    if (Number.isFinite(next)) onChange(next)
  }

  return (
    <div className="w-full">
      {showValue && (
        <div className="flex items-center justify-between mb-1.5">
          <span
            style={{
              fontSize: 10.5,
              color: V3.inkMute,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {ariaLabel ?? ''}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: V3FontWeight.black,
              fontSize: 16,
              color: V3.ink,
              letterSpacing: '-0.01em',
            }}
          >
            {value}
            {unit && (
              <span
                style={{
                  marginLeft: 3,
                  fontSize: 10.5,
                  fontWeight: V3FontWeight.medium,
                  color: V3.inkMute,
                }}
              >
                {unit}
              </span>
            )}
          </span>
        </div>
      )}
      <div
        className="relative"
        style={{
          height: 20,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* track */}
        <div
          aria-hidden
          className="absolute left-0 right-0"
          style={{
            height: 4,
            background: V3.paperDeep,
            border: `1px solid ${V3.ruleSoft}`,
            borderRadius: 999,
          }}
        />
        {/* fill */}
        <div
          aria-hidden
          className="absolute left-0"
          style={{
            height: 4,
            width: `${pct}%`,
            background: fillColor,
            borderRadius: 999,
            transition: 'width 120ms',
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-valuetext={unit ? `${value} ${unit}` : `${value}`}
          onChange={handleChange}
          className="ft-slider-input absolute inset-0 w-full appearance-none bg-transparent cursor-pointer disabled:cursor-not-allowed"
          style={{
            WebkitAppearance: 'none',
            opacity: 0,
            height: 20,
            zIndex: 2,
          }}
        />
        {/* thumb visual — 사용자가 native thumb 을 잡고 드래그하지만 보이는 건 이 element */}
        <span
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            left: `calc(${pct}% - 10px)`,
            width: 20,
            height: 20,
            borderRadius: 999,
            background: V3.paperHi,
            border: `2px solid ${fillColor}`,
            boxShadow: '0 1px 3px rgba(22,20,15,0.18)',
            transition: 'left 120ms',
          }}
        />
      </div>
    </div>
  )
}
