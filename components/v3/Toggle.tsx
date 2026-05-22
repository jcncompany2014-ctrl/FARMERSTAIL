'use client'

/**
 * Toggle — v3 switch (2026-05-22 R12).
 *
 * **앱 컨텍스트 전용.** on/off 설정 (push 알림, 자동 적용 등). browser-native
 * checkbox 보다 손가락 친화적 + v3 톤.
 *
 * # 디자인
 *  - track 36×20 rounded-pill
 *  - on: ink (or accent option) bg + paperHi thumb
 *  - off: rule bg + paperHi thumb
 *  - thumb 16×16 — 좌(off) 우(on) 슬라이드
 *  - disabled — opacity 50
 *
 * @example
 *   <Toggle checked={enabled} onChange={setEnabled} ariaLabel="배송 알림" />
 */

import { V3 } from '@/lib/design/tokens'

type ToggleTone = 'ink' | 'accent' | 'sage'

interface ToggleProps {
  /** 현재 on/off. controlled. */
  checked: boolean
  /** 변경 콜백. boolean 직접. */
  onChange: (next: boolean) => void
  /** 활성 색 — 기본 'ink'. accent (terracotta), sage 가능. */
  tone?: ToggleTone
  /** screen reader 라벨. 외부 라벨 없는 곳에서 필수. */
  ariaLabel?: string
  disabled?: boolean
  /** size — sm (28×16) / md (36×20 기본). */
  size?: 'sm' | 'md'
}

const TONE_COLOR: Record<ToggleTone, string> = {
  ink: V3.ink,
  accent: V3.accent,
  sage: V3.sage,
}

export default function Toggle({
  checked,
  onChange,
  tone = 'ink',
  ariaLabel,
  disabled = false,
  size = 'md',
}: ToggleProps) {
  const width = size === 'sm' ? 28 : 36
  const height = size === 'sm' ? 16 : 20
  const thumbSize = size === 'sm' ? 12 : 16
  const padding = (height - thumbSize) / 2
  const thumbLeft = checked ? width - thumbSize - padding : padding
  const onColor = TONE_COLOR[tone]

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex items-center transition disabled:opacity-50"
      style={{
        width,
        height,
        borderRadius: height / 2,
        background: checked ? onColor : V3.rule,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 160ms',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: padding,
          left: thumbLeft,
          width: thumbSize,
          height: thumbSize,
          borderRadius: thumbSize / 2,
          background: V3.paperHi,
          boxShadow: '0 1px 2px rgba(22,20,15,0.18)',
          transition: 'left 160ms',
        }}
      />
    </button>
  )
}
