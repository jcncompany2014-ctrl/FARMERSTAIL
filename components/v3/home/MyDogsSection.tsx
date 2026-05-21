/**
 * MyDogsSection — 내 아이들 asymmetric 카드 carousel.
 *
 * 핸드오프 패턴:
 *   - heading: "내 아이들 (03)" + 우측 "전체보기"
 *   - 가로 스크롤 카드들 (168×auto) + active 강아지는 2px ink border + ACTIVE ribbon.
 *   - 각 카드: photo 130h + name 22 + breed·kg + 식사/산책 mono stat row.
 *   - 마지막 슬롯: 100px dashed "아이 추가" placeholder.
 */

import Link from 'next/link'
import Image from 'next/image'
import { Plus, Dog as DogIcon } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

export interface DogCardData {
  id: string
  name: string
  /** 품종. */
  breed: string
  /** 체중 kg — number 또는 미입력 시 '--'. */
  weightKg: number | null
  /** 가족 번호 (01 / 02 / 03 …). */
  number: string
  /** 카드 색 tint — photo placeholder bg. 강아지별 다양화. */
  toneBg: string
  photoUrl?: string | null
  /** active 강아지 여부. */
  active?: boolean
  /** 식사 상태 — "2/2", "1/2" 등. */
  mealStat?: string
  /** 산책 상태 — "○" / "✓". */
  walkStat?: string
}

interface MyDogsSectionProps {
  dogs: DogCardData[]
  /** 전체보기 링크 — 옵션. */
  viewAllHref?: string
  /** 강아지 추가 링크. */
  addDogHref?: string
  /** 각 카드 클릭 시 상세로 이동 — 함수형 builder. */
  dogHref?: (dog: DogCardData) => string
}

export default function MyDogsSection({
  dogs,
  viewAllHref,
  addDogHref = '/dogs/new',
  dogHref,
}: MyDogsSectionProps) {
  const formattedCount = String(dogs.length).padStart(2, '0')

  return (
    <section style={{ padding: '0 0 30px' }}>
      <div
        className="flex items-end justify-between"
        style={{ padding: '0 20px 16px' }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 32,
            lineHeight: 1,
            color: V3.ink,
            letterSpacing: '-0.025em',
            wordBreak: 'keep-all',
          }}
        >
          내 아이들
          <Mono
            color="inkMute"
            size="sm"
            upper={false}
            letterSpacing="0"
            style={{ marginLeft: 8, verticalAlign: 'middle', fontWeight: 500 }}
          >
            ({formattedCount})
          </Mono>
        </h2>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="ft-nowrap"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              color: V3.ink,
              fontWeight: 600,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            전체보기
          </Link>
        )}
      </div>

      <div
        className="flex overflow-x-auto ft-scroll-hidden"
        style={{
          gap: 10,
          padding: '0 20px 6px',
        }}
      >
        {dogs.map((d) => {
          const href = dogHref ? dogHref(d) : `/dogs/${d.id}`
          return (
            <Link
              key={d.id}
              href={href}
              className="shrink-0 relative"
              style={{
                width: 168,
                background: V3.paperHi,
                borderRadius: 4,
                padding: '14px 14px 16px',
                border: d.active
                  ? `2px solid ${V3.ink}`
                  : `1px solid ${V3.rule}`,
                color: V3.ink,
                textDecoration: 'none',
              }}
            >
              {d.active && (
                <span
                  className="absolute"
                  style={{
                    top: -8,
                    left: 14,
                    background: V3.accent,
                    color: V3.paperHi,
                    fontFamily: "var(--font-mono, 'IBM Plex Mono'), 'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '3px 7px',
                    letterSpacing: 1,
                    borderRadius: 2,
                  }}
                  aria-hidden
                >
                  ACTIVE
                </span>
              )}
              {/* 2026-05-22: 130h 직사각 → 1:1 정사각형 (aspect-square) */}
              <div
                className="relative overflow-hidden ft-aspect-square"
                style={{
                  width: '100%',
                  borderRadius: 2,
                  background: d.toneBg,
                  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.18)',
                }}
              >
                {d.photoUrl ? (
                  <Image
                    src={d.photoUrl}
                    alt={d.name}
                    fill
                    sizes="168px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <DogIcon size={36} color={V3.inkMute} strokeWidth={1.4} />
                  </div>
                )}
              </div>

              <div
                className="flex justify-between items-baseline"
                style={{ marginTop: 12 }}
              >
                <span
                  className="ft-clamp-1"
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: V3FontWeight.black,
                    fontSize: 22,
                    color: V3.ink,
                    letterSpacing: '-0.025em',
                    wordBreak: 'keep-all',
                  }}
                >
                  {d.name}
                </span>
                <Mono color="inkMute" size="xs" weight={500}>
                  {d.number}
                </Mono>
              </div>
              <div
                className="ft-clamp-1"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  color: V3.inkSoft,
                  marginTop: 2,
                }}
              >
                {d.breed}
                {d.weightKg !== null && ` · ${d.weightKg}kg`}
              </div>
              {(d.mealStat || d.walkStat) && (
                <div
                  className="flex justify-between items-center"
                  style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: `1px solid ${V3.rule}`,
                  }}
                >
                  {d.mealStat && (
                    <Mono color="sage" size="xs" weight={500}>
                      · 식사 {d.mealStat}
                    </Mono>
                  )}
                  {d.walkStat && (
                    <Mono
                      color={d.walkStat.includes('✓') ? 'sage' : 'accent'}
                      size="xs"
                      weight={500}
                    >
                      · 산책 {d.walkStat}
                    </Mono>
                  )}
                </div>
              )}
            </Link>
          )
        })}

        {/* dashed "아이 추가" 슬롯 */}
        <Link
          href={addDogHref}
          className="shrink-0 flex flex-col items-center justify-center"
          style={{
            width: 100,
            borderRadius: 4,
            background: 'transparent',
            border: `1.5px dashed ${V3.rule}`,
            gap: 8,
            padding: '14px 12px',
            color: V3.inkMute,
            textDecoration: 'none',
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: V3.paperHi,
              border: `1px solid ${V3.rule}`,
            }}
          >
            <Plus size={18} color={V3.ink} strokeWidth={1.75} />
          </div>
          <span
            className="ft-balance"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 11,
              color: V3.inkMute,
              textAlign: 'center',
              lineHeight: 1.3,
            }}
          >
            아이 추가
          </span>
        </Link>
      </div>
    </section>
  )
}
