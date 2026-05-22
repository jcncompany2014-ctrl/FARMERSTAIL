'use client'

/**
 * Select — v3 styled native <select> wrapper (2026-05-22 R10-4).
 *
 * # 왜 native <select> 위에 wrap 하나
 *
 * Custom dropdown (Headless UI, Radix Select) 도 가능하지만:
 *   - 모바일에서 OS picker (iOS wheel, Android dialog) 가 사용자 친숙
 *   - 키보드 / screen reader 접근성 무료
 *   - 옵션 100+ 같은 long list 도 native scroll 빠름
 *
 * 시각만 v3 톤 (paperHi bg / 1px rule / radius 4 / ChevronDown) — 동작은 그대로.
 *
 * # API
 *
 *   <Select value={breed} onChange={(e) => setBreed(e.target.value)}>
 *     <option value="">선택해주세요</option>
 *     <option value="poodle">푸들</option>
 *     ...
 *   </Select>
 *
 * 또는 options prop 으로:
 *
 *   <Select
 *     value={tier}
 *     onChange={(e) => setTier(e.target.value)}
 *     options={[
 *       { value: '', label: '선택' },
 *       { value: 'gold', label: 'GOLD' },
 *     ]}
 *   />
 *
 * # 디자인 핸드오프
 *
 *   - 컨테이너: paperHi bg + 1px ink rule + radius 4
 *   - hover: rule → ink (darker)
 *   - focus: 1.5px accent ring
 *   - 우측에 ChevronDown 12px (native arrow 숨김)
 *   - invalid: 1px sale red border
 */

import { forwardRef, type SelectHTMLAttributes, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { V3, V3FontSize, V3FontWeight, V3Radius } from '@/lib/design/tokens'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  /** option 배열 — 단순 케이스용. 복잡한 그룹은 children 으로. */
  options?: SelectOption[]
  /** options 대신 직접 <option> 들. options 와 children 동시엔 children 우선. */
  children?: ReactNode
  /** 에러 상태 — 1px sale red border 적용. */
  invalid?: boolean
  /** size — sm / md (default) / lg. controlBase 와 통일성. */
  sizeVariant?: 'sm' | 'md' | 'lg'
  /** wrapper className — margin 등 호출처 조정용. */
  wrapperClassName?: string
}

const sizePadding: Record<NonNullable<SelectProps['sizeVariant']>, string> = {
  sm: '6px 32px 6px 10px',
  md: '10px 36px 10px 12px',
  lg: '12px 40px 12px 14px',
}

const sizeFontSize: Record<NonNullable<SelectProps['sizeVariant']>, number> = {
  sm: V3FontSize.sm,
  md: V3FontSize.base,
  lg: V3FontSize.md,
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    options,
    children,
    invalid,
    sizeVariant = 'md',
    wrapperClassName,
    disabled,
    style,
    // 사용자 핸들러는 분리 — {...rest} 가 내 핸들러 override 하지 않게.
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
      <select
        ref={ref}
        disabled={disabled}
        className="w-full transition focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        {...rest}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
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
      >
        {children ??
          options?.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              disabled={opt.disabled}
            >
              {opt.label}
            </option>
          ))}
      </select>
      {/* Chevron 아이콘 — native arrow 가려진 자리 표시. pointer-events 차단 안 함
          (native select 가 클릭 처리). */}
      <ChevronDown
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
})

export default Select
