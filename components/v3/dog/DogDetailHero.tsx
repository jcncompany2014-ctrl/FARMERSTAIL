/**
 * DogDetailHero — 강아지 상세 페이지 hero (item 46 + 47).
 *
 * 핸드오프 패턴:
 *   - 280h 큰 사진 + 좌하단 ribbon chips (FAMILY №NN / SINCE 'YY·MM)
 *   - 우상단 paperHi pill "1 / N" 갤러리 카운터
 *   - 사진 아래: 좌측 kicker accent "{breed} · 활성" + 58px sans 900 name
 *               우측 "247일 함께" mute + 3살·♂ Pretendard italic (no serif)
 */

import Image from 'next/image'
import { Dog as DogIcon } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono, RibbonChip } from '@/components/v3'

interface DogDetailHeroProps {
  /** 강아지 이름. */
  name: string
  /** 품종 라벨 — "토이푸들" 등. */
  breed: string
  /** 활성 상태 라벨 — "활성" / "쉬는중". */
  statusLabel?: string
  /** 함께한 일수. */
  daysWith: number
  /** 나이 (살). */
  ageYears: number | null
  /** 성별 — '♂' / '♀' / null. */
  gender?: '♂' | '♀' | null
  /** Family №NN ribbon — 등록 순서. */
  familyNumber: string
  /** SINCE 'YY·MM ribbon — 등록 시점. */
  sinceLabel?: string
  /** Hero photo URL. 없으면 placeholder. */
  photoUrl?: string | null
  /** photo placeholder bg. */
  toneBg?: string
  /** Gallery count — N장 사진이면 "1 / N" 카운터 표시. */
  galleryCount?: number
}

export default function DogDetailHero({
  name,
  breed,
  statusLabel = '활성',
  daysWith,
  ageYears,
  gender = null,
  familyNumber,
  sinceLabel,
  photoUrl,
  toneBg = '#d6c9aa',
  galleryCount = 1,
}: DogDetailHeroProps) {
  return (
    <section style={{ padding: '14px 20px 24px' }}>
      <div className="relative">
        <div
          className="relative overflow-hidden"
          style={{
            width: '100%',
            height: 280,
            background: toneBg,
            borderRadius: 2,
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.2)',
          }}
        >
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={name}
              fill
              sizes="448px"
              priority
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <DogIcon size={64} color={V3.inkMute} strokeWidth={1.2} />
            </div>
          )}
        </div>

        {/* 좌하단 ribbon chips */}
        <div
          className="absolute flex"
          style={{ left: 12, bottom: 12, gap: 6 }}
        >
          <RibbonChip kicker="FAMILY" value={familyNumber} tone="ink" size="sm" />
          {sinceLabel && (
            <RibbonChip kicker="SINCE" value={sinceLabel} tone="ink" size="sm" />
          )}
        </div>

        {/* 우상단 paperHi 카운터 */}
        {galleryCount > 1 && (
          <div
            className="absolute"
            style={{
              top: 12,
              right: 12,
              background: V3.paperHi,
              padding: '5px 8px',
              borderRadius: 2,
            }}
          >
            <Mono color="ink" size="xs" weight={600} letterSpacing="0.06em">
              1 / {galleryCount}
            </Mono>
          </div>
        )}
      </div>

      {/* Name + meta row */}
      <div
        className="flex justify-between items-end"
        style={{ marginTop: 18, gap: 14 }}
      >
        <div className="min-w-0">
          <Mono color="accent" size="xs" weight={600}>
            {breed} · {statusLabel}
          </Mono>
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: V3FontWeight.display, // 900
              fontSize: 58,
              color: V3.ink,
              lineHeight: 0.9,
              letterSpacing: '-0.045em',
              marginTop: 6,
              wordBreak: 'keep-all',
              // 긴 이름(영문/4+음절)이 옆 메타 컬럼을 밀어 가로 오버플로 나는 것
              // 방지 — min-w-0 부모 안에서 1줄 말줄임.
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </div>
        </div>
        <div className="text-right shrink-0">
          <Mono color="inkMute" size="xs" weight={500}>
            {daysWith}일 함께
          </Mono>
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontStyle: 'italic',
              fontWeight: V3FontWeight.semibold,
              fontSize: 16,
              color: V3.ink,
              marginTop: 4,
              letterSpacing: '-0.015em',
            }}
          >
            {ageYears != null && `${ageYears}살`}
            {gender && ` · ${gender}`}
          </div>
        </div>
      </div>
    </section>
  )
}
