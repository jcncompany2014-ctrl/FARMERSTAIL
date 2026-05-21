'use client'

/**
 * CatalogFilters — 카테고리 chip row + "대상" (For-dog) pill.
 *
 * 핸드오프 패턴 (item 57, 58):
 *   - 상단: "제품" 24px sans 800 + 우측 "전체 N" mono mute
 *   - chip row: active=ink bg + paperHi text + 1.5px ink border,
 *               inactive=transparent + ruleSoft border.
 *               n 카운트는 mono yellow (active) / mono mute (inactive).
 *   - 아래: "대상" Mono + paperHi pill (24×24 dog thumb + 이름·품종·kg + 화살표).
 *
 * 현재 chip 클릭은 onSelect prop 으로 분리 — search params 연동은 호출자 책임.
 */

import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

export interface CatalogChip {
  /** 카테고리 label — 전체 / 레시피 / 간식 / 영양제 등. */
  label: string
  /** 해당 카테고리 N개 카운트. */
  count: number
  /** URL slug — search params 의 category 값. */
  slug?: string
}

export interface CatalogForDog {
  id: string
  name: string
  breed: string
  weightKg: number | null
  photoUrl?: string | null
  /** photo placeholder tint. */
  toneBg?: string
}

interface CatalogFiltersProps {
  /** 큰 페이지 헤딩 — 기본 "제품". */
  heading?: string
  /** 우측 카운트 라벨 — 기본 "전체 N". */
  totalLabel?: string
  /** chip 목록. 첫 chip 이 "전체". */
  chips: CatalogChip[]
  /** 현재 활성 chip slug (또는 undefined = "전체"). */
  activeSlug?: string | null
  /** chip 클릭 핸들러. */
  onSelectChip?: (chip: CatalogChip) => void
  /** For-dog pill — 현재 active 강아지. 없으면 pill 숨김. */
  forDog?: CatalogForDog | null
  /** pill 클릭 — 강아지 변경 sheet 트리거. */
  onChangeForDog?: () => void
}

export default function CatalogFilters({
  heading = '제품',
  totalLabel,
  chips,
  activeSlug = null,
  onSelectChip,
  forDog,
  onChangeForDog,
}: CatalogFiltersProps) {
  // 첫 chip 이 "전체" — totalLabel 미지정 시 그 카운트 사용.
  const totalCount = chips[0]?.count ?? 0
  const displayTotal = totalLabel ?? `전체 ${totalCount}`

  return (
    <section style={{ padding: '0 20px 18px' }}>
      <div
        className="flex items-baseline justify-between"
        style={{ marginBottom: 14 }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 24,
            color: V3.ink,
            letterSpacing: '-0.025em',
            wordBreak: 'keep-all',
          }}
        >
          {heading}
        </h2>
        <Mono color="inkMute" size="xs" weight={500} upper={false}>
          {displayTotal}
        </Mono>
      </div>

      {/* chip row — 가로 overflow scroll, margin negative 로 좌우 풀 width */}
      <div
        className="flex overflow-x-auto ft-scroll-hidden"
        style={{
          gap: 6,
          margin: '0 -20px',
          padding: '0 20px 4px',
        }}
      >
        {chips.map((c) => {
          const active = (c.slug ?? null) === (activeSlug ?? null)
          return (
            <button
              key={c.label}
              onClick={() => onSelectChip?.(c)}
              className="shrink-0 inline-flex items-center transition active:scale-[0.97]"
              style={{
                background: active ? V3.ink : 'transparent',
                color: active ? V3.paperHi : V3.ink,
                border: active
                  ? `1.5px solid ${V3.ink}`
                  : `1.5px solid ${V3.rule}`,
                borderRadius: 2,
                padding: '7px 12px',
                fontFamily: 'var(--font-sans)',
                fontWeight: V3FontWeight.bold,
                fontSize: 12,
                cursor: 'pointer',
                letterSpacing: '-0.005em',
                gap: 6,
              }}
              aria-pressed={active}
            >
              {c.label}
              <span
                style={{
                  fontFamily: "var(--font-mono, 'IBM Plex Mono'), 'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 9,
                  color: active ? V3.yellow : V3.inkMute,
                  fontWeight: 600,
                }}
              >
                {c.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* For-dog pill */}
      {forDog && (
        <div
          className="flex items-center"
          style={{ gap: 8, marginTop: 14 }}
        >
          <Mono color="inkMute" size="xs" weight={500}>
            대상
          </Mono>
          <button
            onClick={onChangeForDog}
            className="inline-flex items-center transition active:scale-[0.97]"
            style={{
              gap: 8,
              background: V3.paperHi,
              border: `1px solid ${V3.rule}`,
              padding: '4px 10px 4px 4px',
              borderRadius: 99,
              cursor: 'pointer',
            }}
          >
            <span
              className="block relative overflow-hidden"
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                background: forDog.toneBg ?? '#d6c9aa',
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)',
              }}
            >
              {forDog.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={forDog.photoUrl}
                  alt={forDog.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              )}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                color: V3.ink,
                fontWeight: 600,
                letterSpacing: '-0.005em',
              }}
            >
              {forDog.name} · {forDog.breed}
              {forDog.weightKg != null && ` · ${forDog.weightKg}kg`}
            </span>
            <svg
              width="11"
              height="11"
              viewBox="0 0 11 11"
              fill="none"
              stroke={V3.inkMute}
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M2 4l3.5 3.5L9 4" />
            </svg>
          </button>
        </div>
      )}
    </section>
  )
}
