'use client'

/**
 * Magazine primitives — Reveal / CountUp / BarFill (2026-05-21).
 *
 * Claude Design 'SURVEY TIME' handoff 의 useReveal/Reveal/CountUp/BarFill 을
 * React + TypeScript 로 포팅. iOS dialog 등장 ease-out 곡선
 * cubic-bezier(.2,.7,.2,1) 700ms 통일.
 */

import { useRef, useState, useEffect, type CSSProperties, type ReactNode } from 'react'

// ──────────────────────────────────────────────────────────────────────
// useReveal — IntersectionObserver + scroll fallback + 초기 가시성 sync 체크
// ──────────────────────────────────────────────────────────────────────

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let n = el.parentElement
  while (n && n !== document.body) {
    const s = getComputedStyle(n)
    if (/(auto|scroll|overlay)/.test(s.overflowY) && n.scrollHeight > n.clientHeight) {
      return n
    }
    n = n.parentElement
  }
  return null
}

export function useReveal(opts: IntersectionObserverInit = {}): [
  React.RefObject<HTMLDivElement | null>,
  boolean,
] {
  const ref = useRef<HTMLDivElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const root = findScrollParent(el)
    const isVisible = (): boolean => {
      const r = el.getBoundingClientRect()
      const bounds = root
        ? root.getBoundingClientRect()
        : {
            top: 0,
            bottom: window.innerHeight || document.documentElement.clientHeight,
          }
      return r.top < bounds.bottom * 0.97 && r.bottom > bounds.top
    }
    if (isVisible()) {
      // mount 시 이미 viewport 안 — 한 번에 show. IO 가 첫 frame 미리 잡아주는
      // 표준 패턴이지만 룰은 effect 내 setState 를 cascade 위험으로 분류.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(true)
      return
    }

    let io: IntersectionObserver | undefined
    try {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              setShown(true)
              io?.unobserve(el)
            }
          })
        },
        { root, threshold: 0.1, rootMargin: '0px 0px -5% 0px', ...opts },
      )
      io.observe(el)
    } catch {
      /* swallow */
    }

    const onScroll = () => {
      if (isVisible()) {
        setShown(true)
        cleanup()
      }
    }
    const scroller: HTMLElement | Window = root ?? window
    scroller.addEventListener('scroll', onScroll, { passive: true })

    const t1 = setTimeout(onScroll, 80)
    const t2 = setTimeout(onScroll, 400)

    const cleanup = () => {
      io?.disconnect()
      scroller.removeEventListener('scroll', onScroll)
      clearTimeout(t1)
      clearTimeout(t2)
    }
    return cleanup
  }, [opts])

  return [ref, shown]
}

// ──────────────────────────────────────────────────────────────────────
// Reveal — fade + lift in (700ms)
// ──────────────────────────────────────────────────────────────────────

export function Reveal({
  children,
  delay = 0,
  y = 18,
  style,
}: {
  children: ReactNode
  delay?: number
  y?: number
  style?: CSSProperties
}) {
  const [ref, shown] = useReveal()
  return (
    <div
      ref={ref}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : `translateY(${y}px)`,
        transition: `opacity 700ms cubic-bezier(.2,.7,.2,1) ${delay}ms, transform 700ms cubic-bezier(.2,.7,.2,1) ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// CountUp — 0 → value, requestAnimationFrame ease-out cubic
// ──────────────────────────────────────────────────────────────────────

export function CountUp({
  to,
  suffix = '',
  durationMs = 1200,
  decimals = 0,
  style,
}: {
  to: number
  suffix?: string
  durationMs?: number
  decimals?: number
  style?: CSSProperties
}) {
  const [ref, shown] = useReveal({ threshold: 0.4 })
  const [val, setVal] = useState(0)

  useEffect(() => {
    if (!shown) return
    let raf = 0
    const start = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / durationMs)
      const eased = 1 - Math.pow(1 - k, 3)
      // raf 안의 setVal — render 다음 frame 에 호출되므로 cascade 안 함.
      setVal(to * eased)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [shown, to, durationMs])

  return (
    <span ref={ref} style={style}>
      {decimals ? val.toFixed(decimals) : Math.round(val).toLocaleString()}
      {suffix}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────
// BarFill — width 0% → pct%, 1100ms ease-out
// ──────────────────────────────────────────────────────────────────────

export function BarFill({
  pct,
  color,
  height = 10,
  bg,
  rounded = true,
}: {
  pct: number
  color: string
  height?: number
  bg: string
  rounded?: boolean
}) {
  const [ref, shown] = useReveal({ threshold: 0.3 })
  return (
    <div
      ref={ref}
      style={{
        height,
        background: bg,
        borderRadius: rounded ? height / 2 : 4,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${shown ? pct : 0}%`,
          background: color,
          borderRadius: rounded ? height / 2 : 4,
          transition: 'width 1100ms cubic-bezier(.2,.7,.2,1) 100ms',
        }}
      />
    </div>
  )
}
