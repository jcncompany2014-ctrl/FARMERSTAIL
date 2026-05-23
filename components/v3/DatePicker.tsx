'use client'

/**
 * DatePicker — v3 styled native <input type="date"> wrapper.
 *
 * **앱 컨텍스트 전용.** Custom calendar 대신 native picker (iOS wheel, Android
 * dialog) 를 사용. 모바일 친숙 + 키보드 / SR 접근성 무료.
 *
 * 시각만 v3 톤 — paperHi bg + 1px rule + radius 4 + Calendar icon (right).
 *
 * # API
 *
 *   <DatePicker
 *     value="2026-05-22"
 *     onChange={(v) => setDate(v)}
 *     min="2020-01-01"
 *     max="2030-12-31"
 *   />
 *
 * # 한국어 locale
 *
 * native picker 는 OS locale 을 따른다 — 한국 기본은 yyyy. mm. dd. 표시.
 * 입력 value 는 ISO (yyyy-mm-dd) 그대로 전달 — DB 저장 시 그대로 사용.
 */

import { forwardRef, type InputHTMLAttributes } from 'react'
import { Calendar } from 'lucide-react'
import { V3, V3FontSize, V3FontWeight, V3Radius } from '@/lib/design/tokens'

interface DatePickerProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  invalid?: boolean
  sizeVariant?: 'sm' | 'md' | 'lg'
  wrapperClassName?: string
}

const sizePadding: Record<NonNullable<DatePickerProps['sizeVariant']>, string> =
  {
    sm: '6px 32px 6px 12px',
    md: '12px 40px 12px 16px',
    lg: '14px 44px 14px 18px',
  }

const sizeFontSize: Record<NonNullable<DatePickerProps['sizeVariant']>, number> =
  {
    sm: V3FontSize.sm,
    md: 13,
    lg: V3FontSize.md,
  }

const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  function DatePicker(
    {
      invalid,
      sizeVariant = 'md',
      wrapperClassName,
      disabled,
      style,
      onFocus: userOnFocus,
      onBlur: userOnBlur,
      ...rest
    },
    ref,
  ) {
    const padding = sizePadding[sizeVariant]
    const fontSize = sizeFontSize[sizeVariant]
    const borderColor = invalid ? V3.sale : V3.rule

    return (
      <div
        className={`relative ${wrapperClassName ?? ''}`}
        style={{
          display: 'inline-block',
          width: '100%',
        }}
      >
        <input
          ref={ref}
          type="date"
          disabled={disabled}
          className="w-full transition focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          {...rest}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            padding,
            fontSize,
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.medium,
            color: V3.ink,
            background: V3.paperHi,
            border: `1px solid ${borderColor}`,
            borderRadius: V3Radius.sm,
            cursor: disabled ? 'not-allowed' : 'pointer',
            letterSpacing: '-0.01em',
            ...style,
          }}
          onFocus={(e) => {
            if (!invalid) {
              e.currentTarget.style.borderColor = V3.accent
              e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${V3.accent}`
            }
            userOnFocus?.(e)
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = borderColor
            e.currentTarget.style.boxShadow = 'none'
            userOnBlur?.(e)
          }}
        />
        <Calendar
          size={14}
          color={disabled ? V3.inkFaint : V3.inkMute}
          strokeWidth={2}
          className="absolute pointer-events-none"
          style={{
            right: sizeVariant === 'sm' ? 10 : sizeVariant === 'lg' ? 14 : 12,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
      </div>
    )
  },
)

export default DatePicker
