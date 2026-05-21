'use client'

/**
 * PdpHeroGallery — PDP 상단 hero gallery (스와이프 + 카운터 + ribbon chips).
 *
 * 핸드오프 패턴 (item 61):
 *   - 1:1 풀폭 사진 + 스크롤 스냅 carousel
 *   - 우상단: paperHi pill "1 / 5" mono 카운터
 *   - 좌상단: ribbon chip stack (BEST / NEW / 정기배송 / -N%)
 *   - 카운터/리본 클릭은 비-인터랙티브 (시각만)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ShoppingBag } from 'lucide-react'
import { V3 } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

export interface PdpHeroChip {
  /** 좌상단 ribbon 라벨 — BEST / NEW / 정기배송 / -50%. */
  label: string
  /** ribbon tone. */
  tone: 'ink' | 'accent' | 'yellow' | 'sage' | 'paper'
}

interface PdpHeroGalleryProps {
  /** 이미지 URL 목록. 최소 1장. */
  images: string[]
  /** alt — 제품명. */
  alt: string
  /** 좌상단 ribbon chips. */
  chips?: PdpHeroChip[]
  /** photo placeholder bg (이미지 빈 슬롯). */
  toneBg?: string
}

const CHIP_BG: Record<PdpHeroChip['tone'], string> = {
  ink: V3.ink,
  accent: V3.accent,
  yellow: V3.yellow,
  sage: V3.sage,
  paper: V3.paperHi,
}

const CHIP_FG: Record<PdpHeroChip['tone'], string> = {
  ink: V3.paperHi,
  accent: V3.paperHi,
  yellow: V3.ink,
  sage: V3.paperHi,
  paper: V3.ink,
}

export default function PdpHeroGallery({
  images,
  alt,
  chips = [],
  toneBg = '#d6c9aa',
}: PdpHeroGalleryProps) {
  const slides = images.length > 0 ? images : [null]
  const [active, setActive] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    if (idx >= 0 && idx < slides.length) {
      setActive(idx)
    }
  }, [slides.length])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // ResizeObserver — viewport 변경 시 active 보정.
    const ro = new ResizeObserver(() => onScroll())
    ro.observe(el)
    return () => ro.disconnect()
  }, [onScroll])

  return (
    <section style={{ position: 'relative' }}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory ft-scroll-hidden"
        style={{ gap: 0 }}
      >
        {slides.map((src, i) => (
          <div
            key={i}
            className="shrink-0 snap-start relative ft-aspect-square overflow-hidden"
            style={{
              flex: '0 0 100%',
              width: '100%',
              background: toneBg,
            }}
          >
            {src ? (
              <Image
                src={src}
                alt={i === 0 ? alt : `${alt} ${i + 1}`}
                fill
                sizes="100vw"
                priority={i === 0}
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingBag size={64} color={V3.inkMute} strokeWidth={1.2} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 좌상단 ribbon chips stack */}
      {chips.length > 0 && (
        <div
          className="absolute flex flex-col"
          style={{ top: 14, left: 14, gap: 4, zIndex: 5 }}
        >
          {chips.map((c, i) => (
            <span
              key={i}
              style={{
                background: CHIP_BG[c.tone],
                color: CHIP_FG[c.tone],
                fontFamily: "var(--font-mono, 'IBM Plex Mono'), 'JetBrains Mono', ui-monospace, monospace",
                fontSize: 9,
                fontWeight: 700,
                padding: '3px 7px',
                letterSpacing: 1,
                borderRadius: 2,
                textTransform: 'uppercase',
              }}
            >
              {c.label}
            </span>
          ))}
        </div>
      )}

      {/* 우상단 paperHi 카운터 — 1 / N */}
      {slides.length > 1 && (
        <div
          className="absolute"
          style={{
            top: 14,
            right: 14,
            background: V3.paperHi,
            padding: '5px 8px',
            borderRadius: 2,
            zIndex: 5,
            boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
          }}
        >
          <Mono color="ink" size="xs" weight={600} letterSpacing="0.06em">
            {active + 1} / {slides.length}
          </Mono>
        </div>
      )}
    </section>
  )
}
