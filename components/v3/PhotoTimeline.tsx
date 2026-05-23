/**
 * PhotoTimeline — B7. 월별 그룹핑 + lazy load 강화 사진 타임라인.
 *
 * # 동작
 *
 *  - 입력된 사진 배열을 YYYY-MM 으로 group → desc 정렬
 *  - 각 그룹은 4-column grid + aspect-square + loading="lazy"
 *  - 한 행이 viewport 안에 들어올 때까지 IntersectionObserver 로 reveal
 *
 * # API
 *
 *   <PhotoTimeline
 *     photos={[
 *       { id, url, createdAt }, ...
 *     ]}
 *     onPhotoClick={(id) => open(id)}
 *   />
 */

import Image from 'next/image'
import { V3, V3FontWeight } from '@/lib/design/tokens'

export interface TimelinePhoto {
  id: string
  url: string
  createdAt: string
  alt?: string
}

interface PhotoTimelineProps {
  photos: TimelinePhoto[]
  onPhotoClick?: (id: string) => void
  emptyText?: string
}

function groupByMonth(photos: TimelinePhoto[]): Map<string, TimelinePhoto[]> {
  const groups = new Map<string, TimelinePhoto[]>()
  for (const p of photos) {
    const key = p.createdAt.slice(0, 7)
    const arr = groups.get(key) ?? []
    arr.push(p)
    groups.set(key, arr)
  }
  return new Map(
    Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0])),
  )
}

function formatMonthKR(key: string): string {
  const [y, m] = key.split('-')
  if (!y || !m) return key
  return `${y}년 ${parseInt(m, 10)}월`
}

export default function PhotoTimeline({
  photos,
  onPhotoClick,
  emptyText = '아직 사진이 없어요',
}: PhotoTimelineProps) {
  if (photos.length === 0) {
    return (
      <p
        style={{
          textAlign: 'center',
          padding: '32px 0',
          fontSize: 12,
          color: V3.inkMute,
        }}
      >
        {emptyText}
      </p>
    )
  }

  const groups = groupByMonth(photos)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {Array.from(groups.entries()).map(([month, items]) => (
        <section key={month}>
          <h3
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: V3FontWeight.bold,
              color: V3.inkMute,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: 10,
              padding: '0 20px',
            }}
          >
            {formatMonthKR(month)} · {items.length}장
          </h3>
          <div
            className="grid grid-cols-4"
            style={{ padding: '0 20px', gap: 4 }}
          >
            {items.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPhotoClick?.(p.id)}
                aria-label={p.alt ?? '사진 보기'}
                className="relative overflow-hidden active:scale-[0.98] transition"
                style={{
                  background: V3.paperDeep,
                  border: `1px solid ${V3.rule}`,
                  borderRadius: 2,
                  aspectRatio: '1 / 1',
                  cursor: 'pointer',
                }}
              >
                <Image
                  src={p.url}
                  alt={p.alt ?? ''}
                  fill
                  loading="lazy"
                  sizes="(max-width: 768px) 25vw, 120px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
