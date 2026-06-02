'use client'

/**
 * RadioGroup — v3 single-select 라디오 그룹.
 *
 * **앱 컨텍스트 전용.** Select 보완 — 옵션 2~4개 일 때, 사용자가 펼치지 않고
 * 한 번에 보이는 선택지가 더 빠르다.
 *
 * # API
 *
 *   <RadioGroup
 *     name="bcs"
 *     value={bcs}
 *     onChange={setBcs}
 *     options={[
 *       { value: 'low', label: '저체중' },
 *       { value: 'ideal', label: '적정' },
 *       { value: 'high', label: '비만' },
 *     ]}
 *   />
 *
 * # 디자인
 *
 *  - layout — vertical (default) / horizontal
 *  - 원형 22×22 + ink border, 선택 시 inner accent dot
 *  - 라벨 13.5px ink, 우측 cap optional (description)
 */

import { V3, V3FontWeight, V3Radius } from '@/lib/design/tokens'

export interface RadioOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

interface RadioGroupProps {
  name: string
  value: string
  onChange: (next: string) => void
  options: RadioOption[]
  /** vertical (default) / horizontal. */
  layout?: 'vertical' | 'horizontal'
  /** tone — ink (default) / accent / sage. */
  tone?: 'ink' | 'accent' | 'sage'
  ariaLabel?: string
}

const TONE_COLOR: Record<NonNullable<RadioGroupProps['tone']>, string> = {
  ink: V3.ink,
  accent: V3.accent,
  sage: V3.sage,
}

export default function RadioGroup({
  name,
  value,
  onChange,
  options,
  layout = 'vertical',
  tone = 'ink',
  ariaLabel,
}: RadioGroupProps) {
  const accent = TONE_COLOR[tone]
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`flex ${layout === 'vertical' ? 'flex-col gap-2' : 'flex-row flex-wrap gap-3'}`}
    >
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <label
            key={opt.value}
            className="inline-flex items-start cursor-pointer transition"
            style={{
              gap: 10,
              padding: '8px 12px',
              borderRadius: V3Radius.sm,
              background: selected ? `${V3.paper}` : V3.paperHi,
              border: `1px solid ${selected ? accent : V3.rule}`,
              cursor: opt.disabled ? 'not-allowed' : 'pointer',
              opacity: opt.disabled ? 0.5 : 1,
              flex: layout === 'horizontal' ? '1 1 auto' : undefined,
              minWidth: layout === 'horizontal' ? 0 : undefined,
            }}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={selected}
              disabled={opt.disabled}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            <span
              aria-hidden
              className="shrink-0 inline-flex items-center justify-center"
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                border: `1.5px solid ${selected ? accent : V3.rule}`,
                background: V3.paperHi,
                marginTop: 1,
                transition: 'border-color 160ms',
              }}
            >
              {selected && (
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 999,
                    background: accent,
                  }}
                />
              )}
            </span>
            <span className="flex-1 min-w-0">
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
                {opt.label}
              </span>
              {opt.description && (
                <span
                  style={{
                    display: 'block',
                    marginTop: 2,
                    fontSize: 12,
                    color: V3.inkMute,
                    lineHeight: 1.4,
                  }}
                >
                  {opt.description}
                </span>
              )}
            </span>
          </label>
        )
      })}
    </div>
  )
}
