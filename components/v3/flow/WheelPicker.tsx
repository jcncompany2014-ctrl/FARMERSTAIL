'use client'

/**
 * 휠 고르기 — 새 첫 화면 생일·몸무게(앱 새 디자인 'A 포스터', 2026-10-09 캔버스 Y2·Y5).
 *
 * 시안: 높이 168(한 줄 56 × 3) · 가운데 줄 위아래 2px 먹선 · 가운데 글자 28/800 먹색 · 나머지 21/600 #C4C0BA ·
 * 위·아래 44px 흰 흐림. 칸마다 손가락으로 굴리면 가운데에 멈춘다(scroll-snap). 누르면 그 줄이 가운데로 온다.
 * 키보드 ↑↓ 로도 바뀐다(칸 = spinbutton). 값이 바뀌는 건 멈춘 뒤 한 번만 알린다(굴리는 동안 저장이 몰리지 않게).
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import './wheel.css'

const ROW = 56

export type WheelOption = { value: string; label: string }

export function WheelColumn({
  options,
  value,
  onChange,
  label,
  align = 'center',
}: {
  options: WheelOption[]
  value: string
  onChange: (v: string) => void
  /** 읽기 프로그램용 칸 이름(예: '년'). */
  label: string
  align?: 'center' | 'start' | 'end'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const idx = Math.max(0, options.findIndex((o) => o.value === value))
  const [live, setLive] = useState(idx)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const programmatic = useRef(false)

  // 바깥 값이 바뀌면(처음·다른 칸 때문에 날짜가 바뀜 등) 그 줄로 맞춘다.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const target = idx * ROW
    if (Math.abs(el.scrollTop - target) > 1) {
      programmatic.current = true
      el.scrollTop = target
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 바깥 값에 화면 강조를 맞춘다
    setLive(idx)
  }, [idx])

  const onScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    const i = Math.min(options.length - 1, Math.max(0, Math.round(el.scrollTop / ROW)))
    setLive(i)
    if (programmatic.current) {
      programmatic.current = false
      return
    }
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      const opt = options[i]
      if (opt && opt.value !== value) onChange(opt.value)
    }, 120)
  }, [options, value, onChange])

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current)
  }, [])

  const pick = (i: number) => {
    const el = ref.current
    const opt = options[i]
    if (!el || !opt) return
    el.scrollTo({ top: i * ROW, behavior: 'smooth' })
    if (opt.value !== value) onChange(opt.value)
  }

  const justify: CSSProperties['justifyContent'] = align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center'
  return (
    <div
      ref={ref}
      className="ft-wheel-col"
      role="spinbutton"
      aria-label={label}
      aria-valuetext={options[live]?.label}
      aria-valuenow={live}
      aria-valuemin={0}
      aria-valuemax={options.length - 1}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          pick(Math.min(options.length - 1, live + 1))
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          pick(Math.max(0, live - 1))
        }
      }}
    >
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => pick(i)}
          className={'ft-wheel-row' + (i === live ? ' is-on' : '')}
          // 붙여 읽는 칸(몸무게 11 | .2)은 맞붙은 쪽 여백을 없앤다 — 시안 "11.2 kg" 처럼 한 덩어리로.
          style={{ justifyContent: justify, paddingLeft: align === 'start' ? 0 : undefined, paddingRight: align === 'end' ? 0 : undefined }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** 휠 틀 — 가운데 띠 + 위아래 흐림. 칸들은 children(가로로 나란히, 비율은 columns). */
export function WheelFrame({ columns, ariaLabel, children }: { columns: string; ariaLabel: string; children: ReactNode }) {
  return (
    <div className="ft-wheel" role="group" aria-label={ariaLabel}>
      <span aria-hidden className="ft-wheel-band" />
      <div className="ft-wheel-cols" style={{ gridTemplateColumns: columns }}>
        {children}
      </div>
      <span aria-hidden className="ft-wheel-fade is-top" />
      <span aria-hidden className="ft-wheel-fade is-bottom" />
    </div>
  )
}

/** 글자만 있는 고정 칸(예: 'kg'). 가운데 줄 높이에 맞춘다. */
export function WheelUnit({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden className="ft-wheel-unit">
      {children}
    </span>
  )
}
