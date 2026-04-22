'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import CornerTicks from './CornerTicks'

export type RailProduct = {
  id: string
  href: string
  cat: string
  enName: string
  koName: string
  body: string
  price: number
  weight: string
  tint: string
  imageUrl: string | null
  tag?: string
}

// Matches the design's horizontal-scroll product rail. The page supplies
// products (Supabase-backed) or falls back to curated mock data.
export default function ProductRail({ items }: { items: RailProduct[] }) {
  const railRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const el = railRef.current
    if (!el) return
    let tid: number | null = null
    const onScroll = () => {
      if (tid) cancelAnimationFrame(tid)
      tid = requestAnimationFrame(() => {
        // Each card is ~232px wide + 14px gap. Compute index from first card's offset.
        const cards = Array.from(
          el.querySelectorAll<HTMLElement>('[data-rail-card]')
        )
        if (!cards.length) return
        const railLeft = el.scrollLeft
        let bestIdx = 0
        let bestDist = Infinity
        cards.forEach((c, i) => {
          const dist = Math.abs(c.offsetLeft - railLeft - 20) // 20 = padding
          if (dist < bestDist) {
            bestDist = dist
            bestIdx = i
          }
        })
        setActive((prev) => (prev !== bestIdx ? bestIdx : prev))
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (tid) cancelAnimationFrame(tid)
    }
  }, [])

  return (
    <>
      {/* Horizontal scroll rail */}
      <div
        ref={railRef}
        className="no-scrollbar"
        style={{
          display: 'flex',
          gap: 14,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          padding: '10px 20px 18px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {items.map((p, i) => (
          <article
            key={p.id}
            data-rail-card
            style={{
              flex: '0 0 232px',
              scrollSnapAlign: 'start',
              display: 'flex',
              flexDirection: 'column',
              background: '#fbfaf4',
              border: '1px solid var(--rule-2)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <Link
              href={p.href}
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              {/* Illustration / image tile */}
              <div
                style={{
                  position: 'relative',
                  aspectRatio: '1 / 1',
                  background: p.tint,
                  display: 'grid',
                  placeItems: 'center',
                  borderBottom: '1px solid var(--rule-2)',
                  overflow: 'hidden',
                }}
              >
                {/* subtle grain on tile */}
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage:
                      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.25'/></svg>\")",
                    mixBlendMode: 'multiply',
                    opacity: 0.18,
                    pointerEvents: 'none',
                  }}
                />
                <CornerTicks />
                {/* Index serial — top-left */}
                <div
                  className="font-mono"
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    zIndex: 3,
                    fontSize: 9,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'rgba(61,43,31,0.55)',
                  }}
                >
                  No. 0{i + 1}
                </div>
                {p.tag && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      zIndex: 4,
                      background: 'var(--ink)',
                      color: 'var(--bg)',
                      fontSize: 9,
                      letterSpacing: '0.2em',
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: 2,
                    }}
                  >
                    {p.tag}
                  </div>
                )}
                {p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
                    alt={p.koName}
                    fill
                    sizes="232px"
                    style={{ objectFit: 'cover', zIndex: 2 }}
                  />
                ) : (
                  <span
                    style={{
                      position: 'relative',
                      zIndex: 2,
                      fontSize: 12,
                      letterSpacing: '0.05em',
                      color: 'rgba(61,43,31,0.55)',
                    }}
                  >
                    일러스트
                  </span>
                )}
              </div>

              {/* Text block */}
              <div
                style={{
                  padding: '16px 16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div
                  className="font-mono"
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'var(--terracotta)',
                  }}
                >
                  {p.cat}
                </div>
                <div
                  className="font-serif"
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    color: 'var(--ink)',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.15,
                  }}
                >
                  {p.enName}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -2 }}>
                  {p.koName}
                </div>
                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: 12,
                    lineHeight: 1.55,
                    color: 'var(--text)',
                    minHeight: 54,
                  }}
                >
                  {p.body}
                </p>
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 10,
                    borderTop: '1px solid var(--rule-2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <span
                    className="font-serif tnum"
                    style={{
                      fontSize: 17,
                      fontWeight: 800,
                      color: 'var(--ink)',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    ₩{p.price.toLocaleString()}
                  </span>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      color: 'var(--muted)',
                    }}
                  >
                    {p.weight}
                  </span>
                </div>
              </div>
            </Link>
          </article>
        ))}

        {/* Trailing peek — "view all" tile */}
        <Link
          href="/products"
          style={{
            flex: '0 0 140px',
            scrollSnapAlign: 'start',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: '1px dashed var(--rule-2)',
            borderRadius: 12,
            padding: '18px 16px',
            color: 'var(--ink)',
            textDecoration: 'none',
            background: 'transparent',
          }}
        >
          <div
            className="font-mono"
            style={{
              fontSize: 9,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
            }}
          >
            The Full
            <br />
            Pantry
          </div>
          <div
            className="font-serif"
            style={{
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            전체
            <br />
            보기
            <br />
            <span
              className="font-serif"
              style={{
                fontWeight: 500,
                color: 'var(--terracotta)',
                fontSize: 16,
              }}
            >
              →
            </span>
          </div>
        </Link>
      </div>

      {/* Scroll indicator: elongated dot on active + counter */}
      <div
        style={{
          padding: '0 20px',
          marginTop: 6,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          {items.map((p, i) => (
            <span
              key={p.id}
              style={{
                width: i === active ? 18 : 6,
                height: 2,
                background: i === active ? 'var(--ink)' : 'var(--rule-2)',
                transition: 'all .2s',
              }}
            />
          ))}
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: 9,
            letterSpacing: '0.2em',
            color: 'var(--muted)',
            textTransform: 'uppercase',
          }}
        >
          ← Swipe · {String(active + 1).padStart(2, '0')} /{' '}
          {String(items.length).padStart(2, '0')}
        </div>
      </div>
    </>
  )
}
