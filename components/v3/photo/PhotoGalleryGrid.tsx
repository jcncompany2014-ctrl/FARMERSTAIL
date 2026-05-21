'use client'

/**
 * PhotoGalleryGrid — 강아지 사진 갤러리 (item 81).
 *
 * 핸드오프 패턴:
 *   - 월별 sticky 헤더 — Mono mute "MAY 2026"
 *   - 3-col grid (각 1:1) — 사진 thumbnail
 *   - 첫 best-shot (옵션) — 좌측 1.5fr 큰 카드 + 우측 0.5fr 작은 stack
 *   - 무한 스크롤 hook (IntersectionObserver) — onLoadMore prop
 *
 * 사진 클릭 → lightbox (별도 컴포넌트, 호출자 책임).
 */

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

export interface GalleryPhoto {
  id: string
  /** 사진 URL. */
  src: string
  /** alt. */
  alt?: string
  /** ISO 날짜 — YYYY-MM-DD. 월 그룹핑에 사용. */
  date: string
  /** best-shot 표시 여부 — 큰 cell 후보. */
  best?: boolean
}

interface PhotoGalleryGridProps {
  photos: GalleryPhoto[]
  /** 추가 로드 — 무한 스크롤. */
  onLoadMore?: () => void
  /** 사진 클릭 — lightbox 트리거. */
  onSelect?: (photo: GalleryPhoto, index: number) => void
  /** 더 로드할 게 남았는지. */
  hasMore?: boolean
}

/** 월 키 — "2026-05" → "MAY 2026" 등. */
function monthLabel(yyyyMm: string): string {
  const parts = yyyyMm.split('-')
  const year = parts[0] ?? ''
  const monthIdx = parseInt(parts[1] ?? '1', 10) - 1
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${MONTHS[monthIdx] ?? '---'} ${year}`
}

export default function PhotoGalleryGrid({
  photos,
  onLoadMore,
  onSelect,
  hasMore = false,
}: PhotoGalleryGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  // 무한 스크롤 — sentinel 가 viewport 에 들어오면 onLoadMore.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !onLoadMore || !hasMore) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore()
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [onLoadMore, hasMore])

  // 월별 그룹.
  const groups = new Map<string, GalleryPhoto[]>()
  for (const p of photos) {
    const yyyyMm = p.date.slice(0, 7)
    if (!groups.has(yyyyMm)) groups.set(yyyyMm, [])
    groups.get(yyyyMm)!.push(p)
  }
  // 최신 월 먼저.
  const sortedMonths = Array.from(groups.keys()).sort((a, b) =>
    b.localeCompare(a),
  )

  if (photos.length === 0) {
    return (
      <section style={{ padding: '40px 20px', textAlign: 'center' }}>
        <Mono color="inkMute" size="xs" weight={500}>
          아직 사진이 없어요
        </Mono>
        <p
          style={{
            margin: '10px 0 0',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            color: V3.inkSoft,
          }}
        >
          첫 사진을 등록해보세요.
        </p>
      </section>
    )
  }

  return (
    <section style={{ padding: '0 20px 28px' }}>
      {sortedMonths.map((yyyyMm) => {
        const monthPhotos = groups.get(yyyyMm)!
        return (
          <div key={yyyyMm} style={{ marginBottom: 24 }}>
            <div
              className="sticky"
              style={{
                top: 0,
                background: V3.paper,
                padding: '8px 0',
                zIndex: 2,
              }}
            >
              <Mono
                color="inkMute"
                size="xs"
                weight={600}
                letterSpacing="0.16em"
              >
                {monthLabel(yyyyMm)}
              </Mono>
              <div
                aria-hidden
                style={{
                  marginTop: 4,
                  height: 1,
                  background: V3.rule,
                }}
              />
            </div>
            <div
              className="grid"
              style={{
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 4,
                marginTop: 8,
              }}
            >
              {monthPhotos.map((p, idx) => (
                <button
                  key={p.id}
                  onClick={() => onSelect?.(p, idx)}
                  className="relative overflow-hidden ft-aspect-square"
                  style={{
                    width: '100%',
                    background: '#d6c9aa',
                    border: 'none',
                    borderRadius: 2,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  aria-label={`${p.alt ?? '사진'} ${idx + 1}`}
                >
                  <Image
                    src={p.src}
                    alt={p.alt ?? ''}
                    fill
                    sizes="148px"
                    className="object-cover"
                  />
                  {p.best && (
                    <span
                      className="absolute"
                      style={{
                        top: 4,
                        right: 4,
                        background: V3.yellow,
                        color: V3.ink,
                        fontFamily:
                          "var(--font-mono, 'IBM Plex Mono'), 'JetBrains Mono', ui-monospace, monospace",
                        fontSize: 8,
                        fontWeight: V3FontWeight.bold,
                        padding: '2px 5px',
                        borderRadius: 2,
                        letterSpacing: 0.6,
                      }}
                    >
                      BEST
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {hasMore && (
        <div ref={sentinelRef} style={{ height: 32, marginTop: 8 }} />
      )}
    </section>
  )
}
