'use client'

/**
 * Checkbox — v3 다중 선택 박스.
 *
 * **앱 컨텍스트 전용.** 알레르기 / 식이 제한 / 동의 등 다중 선택용.
 *
 * # API (controlled)
 *
 *   <Checkbox
 *     checked={agreed}
 *     onChange={setAgreed}
 *     label="개인정보 처리방침 동의"
 *   />
 *
 * # 디자인
 *
 *  - 18×18 정사각형 + rounded-sm (2px)
 *  - 체크: ink fill + paperHi check icon
 *  - 미체크: paperHi + 1.5px rule border
 *  - 라벨: 13.5px ink, 좌우 gap 10
 */

import { Check } from 'lucide-react'
import { V3, V3FontWeight, V3Radius } from '@/lib/design/tokens'

interface CheckboxProps {
  checked: boolean
  onChange: (next: boolean) => void
  label?: React.ReactNode
  description?: React.ReactNode
  disabled?: boolean
  tone?: 'ink' | 'accent' | 'sage'
  ariaLabel?: string
  /** 'card' = 카드 스타일 (radio 와 통일), 'inline' = 기본 chevron 없는 인라인. */
  variant?: 'card' | 'inline'
}

const TONE_BG: Record<NonNullable<CheckboxProps['tone']>, string> = {
  ink: V3.ink,
  accent: V3.accent,
  sage: V3.sage,
}

export default function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  tone = 'ink',
  ariaLabel,
  variant = 'inline',
}: CheckboxProps) {
  const accent = TONE_BG[tone]
  const isCard = variant === 'card'

  return (
    <label
      className="inline-flex items-start cursor-pointer transition"
      style={{
        gap: 10,
        padding: isCard ? '8px 12px' : 0,
        borderRadius: isCard ? V3Radius.sm : undefined,
        background: isCard ? (checked ? V3.paper : V3.paperHi) : undefined,
        border: isCard
          ? `1px solid ${checked ? accent : V3.rule}`
          : undefined,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        width: isCard ? '100%' : undefined,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden
        className="shrink-0 inline-flex items-center justify-center"
        style={{
          width: 18,
          height: 18,
          borderRadius: V3Radius.xs,
          border: `1.5px solid ${checked ? accent : V3.rule}`,
          background: checked ? accent : V3.paperHi,
          marginTop: 1,
          transition: 'background 160ms, border-color 160ms',
        }}
      >
        {checked && (
          <Check size={12} color={V3.paperHi} strokeWidth={3} />
        )}
      </span>
      {(label || description) && (
        <span className="flex-1 min-w-0">
          {label && (
            <span
              style={{
                display: 'block',
                fontFamily: 'var(--font-sans)',
                fontWeight: V3FontWeight.semibold,
                fontSize: 13.5,
                color: V3.ink,
                letterSpacing: '-0.01em',
                lineHeight: 1.35,
              }}
            >
              {label}
            </span>
          )}
          {description && (
            <span
              style={{
                display: 'block',
                marginTop: 2,
                fontSize: 11.5,
                color: V3.inkMute,
                lineHeight: 1.4,
              }}
            >
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  )
}
