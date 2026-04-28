'use client'

import { useEffect, useRef, useState } from 'react'
import CornerTicks from './CornerTicks'

type Slide = {
  n: string
  en: string
  ko: string
  tint: string
  caption: string
  sub: string
}

const SLIDES: Slide[] = [
  {
    n: '01',
    en: 'FARM',
    ko: '농장',
    tint: '#D7C9A8',
    caption: '강원 평창 · 새벽 수확',
    sub: 'The Farm',
  },
  {
    n: '02',
    en: 'TAIL',
    ko: '꼬리',
    tint: '#E4CBB2',
    caption: '반려견의 하루',
    sub: 'The Tail',
  },
  {
    n: '03',
    en: 'BOWL',
    ko: '그릇',
    tint: '#CDD3B4',
    caption: '오늘의 한 끼',
    sub: 'The Bowl',
  },
]

// Darken a hex color by `amt` points on each channel.
function shade(hex: string, amt: number) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const cl = (v: number) => Math.max(0, Math.min(255, v + amt))
  return (
    '#' +
    [cl(r), cl(g), cl(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  )
}

export default function HeroSlideshow() {
  const [idx, setIdx] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)

  // Sync slide index with scroll position (snap-stop friendly).
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    let tid: number | null = null
    const onScroll = () => {
      if (tid) cancelAnimationFrame(tid)
      tid = requestAnimationFrame(() => {
        const i = Math.round(el.scrollLeft / el.clientWidth)
        setIdx((prev) => (prev !== i ? i : prev))
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (tid) cancelAnimationFrame(tid)
    }
  }, [])

  const goTo = (i: number) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className="px-5 md:px-6 pt-3 md:pt-5">
      <div
        ref={trackRef}
        className="no-scrollbar md:rounded-2xl"
        style={{
          display: 'flex',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          borderRadius: 2,
        }}
      >
        {SLIDES.map((s) => (
          <div
            key={s.n}
            style={{
              flex: '0 0 100%',
              scrollSnapAlign: 'start',
              position: 'relative',
            }}
          >
            <div
              className="ph"
              style={{
                aspectRatio: '16 / 10',
                width: '100%',
                position: 'relative',
                background: `repeating-linear-gradient(135deg, ${s.tint} 0 8px, ${shade(
                  s.tint,
                  -8
                )} 8px 16px)`,
              }}
            >
              <CornerTicks />
              {/* Top-left serial */}
              <div className="absolute top-2.5 left-2.5 md:top-5 md:left-5 z-[3] flex items-baseline gap-1 md:gap-2">
                <span
                  className="font-serif text-[13px] md:text-[18px]"
                  style={{
                    color: 'rgba(61,43,31,0.6)',
                    fontWeight: 500,
                  }}
                >
                  No.
                </span>
                <span
                  className="font-serif text-[13px] md:text-[18px]"
                  style={{
                    fontWeight: 800,
                    color: 'rgba(61,43,31,0.8)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {s.n}
                </span>
              </div>
              {/* Oversized EN label */}
              <div
                className="font-serif absolute bottom-2.5 right-3 md:bottom-5 md:right-6 z-[3] text-[22px] md:text-[60px] lg:text-[80px]"
                style={{
                  fontWeight: 800,
                  color: 'rgba(61,43,31,0.18)',
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                }}
              >
                {s.en}
              </div>
              {/* Mono caption */}
              <div
                className="font-mono absolute bottom-2.5 left-2.5 md:bottom-5 md:left-5 z-[3] text-[8.5px] md:text-[11px]"
                style={{
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'rgba(61,43,31,0.65)',
                }}
              >
                {s.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Caption + progress row */}
      <div className="mt-2 md:mt-4">
        <div className="flex justify-between items-baseline mb-1.5 md:mb-2.5">
          <div>
            <span
              className="font-serif text-[12px] md:text-[16px]"
              style={{
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.01em',
              }}
            >
              {SLIDES[idx].ko}
            </span>
            <span
              className="font-serif text-[12px] md:text-[15px] ml-1.5"
              style={{
                color: 'var(--muted)',
              }}
            >
              — {SLIDES[idx].caption}
            </span>
          </div>
          <div
            className="font-mono text-[9px] md:text-[11px]"
            style={{
              letterSpacing: '0.14em',
              color: 'var(--muted)',
              textTransform: 'uppercase',
            }}
          >
            {String(idx + 1).padStart(2, '0')} /{' '}
            {String(SLIDES.length).padStart(2, '0')}
          </div>
        </div>

        {/* Segmented progress bar — click to jump */}
        <div className="flex gap-1 md:gap-1.5">
          {SLIDES.map((s, i) => (
            <button
              key={s.n}
              aria-label={`Slide ${i + 1}`}
              onClick={() => goTo(i)}
              className="flex-1 h-[2px] md:h-[3px] p-0 border-0 cursor-pointer transition-colors"
              style={{
                background: i <= idx ? 'var(--ink)' : 'var(--rule-2)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
