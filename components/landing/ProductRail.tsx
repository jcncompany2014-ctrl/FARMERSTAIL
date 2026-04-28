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
          // 20 = rail 좌측 padding. 카드 offset 에서 이 값을 빼야
          // "화면 기준 첫 카드가 0px 위치" 가 되고, 스크롤 인덱스가 정확.
          // 본문은 20px 에 정렬되지만, 카드는 이미지 타일 + border 가 시각
          // 무게가 커서 본문과 같은 20px 에 두면 phone frame 에 붙어 보인다.
          // 그래서 한 단계 더 들여 20px — 본문 정렬선 안쪽에 여백이 생겨
          // "카드가 지면 안으로 들어와 앉은" 형태가 된다.
          const dist = Math.abs(c.offsetLeft - railLeft - 20)
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
      {/* Horizontal scroll rail.
          좌우 padding 20px — 위 ProductsSection header 본문과 동일한
          정렬선을 공유한다. "PANTRY MIX & GOURMET TOPPERS" 카피가
          시작되는 x 축과 카드 왼쪽 엣지가 같은 라인에 떨어져야 지면이
          한 그리드로 읽힌다.

          scrollPaddingLeft 를 같이 지정하는 이유:
          scroll-snap-align: start 는 기본적으로 scrollport 의 실제 시작
          지점에 snap 하는데, Safari/일부 Chrome 에서 padding 을 무시하고
          "패딩 포함된 scrollport edge(=0)" 에 snap 해버리는 quirk 가 있다.
          그러면 초기 상태에서 첫 카드가 패딩을 뚫고 edge 에 붙어보이는
          현상이 생긴다. scroll-padding-left 를 padding-left 와 동일하게
          박으면 snap 기준 자체가 20px 로 옮겨져 안정적이다. */}
      <div
        ref={railRef}
        className="no-scrollbar gap-3.5 md:gap-5 px-5 md:px-12 py-2.5 md:py-4 pb-4 md:pb-6"
        style={{
          display: 'flex',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          scrollPaddingLeft: 20,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {items.map((p, i) => (
          <article
            key={p.id}
            data-rail-card
            className="w-[232px] md:w-[300px] lg:w-[320px] shrink-0"
            style={{
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
                    sizes="(max-width: 768px) 232px, 320px"
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
              <div className="p-4 md:p-5 pb-[18px] md:pb-6 flex flex-col gap-1.5 md:gap-2">
                <div
                  className="font-mono text-[9px] md:text-[10.5px]"
                  style={{
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'var(--terracotta)',
                  }}
                >
                  {p.cat}
                </div>
                <div
                  className="font-serif text-[17px] md:text-[20px]"
                  style={{
                    fontWeight: 800,
                    color: 'var(--ink)',
                    letterSpacing: '-0.015em',
                    lineHeight: 1.15,
                  }}
                >
                  {p.enName}
                </div>
                <div
                  className="text-[12px] md:text-[13.5px] -mt-0.5"
                  style={{ color: 'var(--muted)' }}
                >
                  {p.koName}
                </div>
                <p
                  className="mt-1.5 md:mt-2 text-[12px] md:text-[13.5px] leading-relaxed min-h-[54px] md:min-h-[60px]"
                  style={{
                    color: 'var(--text)',
                  }}
                >
                  {p.body}
                </p>
                <div
                  className="mt-2 md:mt-3 pt-2.5 md:pt-3.5 flex justify-between items-baseline"
                  style={{
                    borderTop: '1px solid var(--rule-2)',
                  }}
                >
                  <span
                    className="font-serif tnum text-[17px] md:text-[22px]"
                    style={{
                      fontWeight: 800,
                      color: 'var(--ink)',
                      letterSpacing: '-0.015em',
                    }}
                  >
                    ₩{p.price.toLocaleString()}
                  </span>
                  <span
                    className="font-mono text-[10px] md:text-[11.5px]"
                    style={{
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
          className="w-[140px] md:w-[180px] shrink-0 p-[18px_16px] md:p-7"
          style={{
            scrollSnapAlign: 'start',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: '1px dashed var(--rule-2)',
            borderRadius: 12,
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

      {/* Scroll indicator: elongated dot on active + counter.
          rail 과 동일하게 좌우 padding — 카드 엣지와 같은 정렬선을
          공유해야 active dot 이 첫 카드 아래 정확히 떨어진다. */}
      <div
        className="px-5 md:px-12 mt-2 md:mt-3 flex justify-between items-center"
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
