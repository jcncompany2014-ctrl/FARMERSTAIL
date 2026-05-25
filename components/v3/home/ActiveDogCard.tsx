/**
 * ActiveDogCard — "Now featuring" 활성 강아지 spotlight 카드.
 *
 * 핸드오프 패턴:
 *   - 카드: paperHi bg + 1px rule + radius 4 + overflow hidden.
 *   - 상단: Mono accent "Now featuring" + 우측 sage dot · 활성 상태.
 *   - 본문: 68×84 photo + 강아지 이름 34px sans 800 + 메타 12.5.
 *   - 하단: 4-col metric strip — 식사 / 산책 / 체중 / 연속 기록.
 *
 * 강아지 이름의 `.` 악센트는 폐기 (사용자 요청). 그냥 sans bold.
 */

import Link from 'next/link'
import Image from 'next/image'
import { Dog as DogIcon } from 'lucide-react'
import { V3, V3FontSize, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

interface DogMetric {
  /** 라벨 — Mono kicker (식사/산책/체중/연속). */
  key: string
  /** 큰 수치. 28px 정도. */
  value: string
  /** 보조 단위 — Mono (/ 2, kg, 일 등). */
  sub: string
  /** 수치 색상 — V3 token key (sage/accent/ink/yellow). */
  tone?: 'sage' | 'accent' | 'ink' | 'yellow'
}

interface ActiveDogCardProps {
  /** 강아지 이름. */
  dogName: string
  /** 강아지 메타 — 품종 + 체중 + 나이 + days. 예: "토이푸들 · 4kg · 3살 · 247일 함께" */
  metaLine: string
  /** 강아지 photo URL. 없으면 placeholder. */
  photoUrl?: string | null
  /** Active 상태 라벨 — "활성" / "쉬는중" 등. 우상단 작은 라벨. */
  statusLabel?: string
  /** Active dot tone — 기본 sage. */
  statusTone?: 'sage' | 'accent' | 'ink'
  /** 4 metric 또는 그 이하. 부족하면 빈 cell 으로 가운데 정렬. */
  metrics: DogMetric[]
  /** 카드 클릭 시 이동할 경로. 옵션. */
  href?: string
}

const TONE_COLOR: Record<NonNullable<DogMetric['tone']>, string> = {
  sage: V3.sage,
  accent: V3.accent,
  ink: V3.ink,
  yellow: V3.yellow,
}

export default function ActiveDogCard({
  dogName,
  metaLine,
  photoUrl,
  statusLabel = '활성',
  statusTone = 'sage',
  metrics,
  href,
}: ActiveDogCardProps) {
  const card = (
    <div
      className="ft-card-v3"
      style={{
        overflow: 'hidden',
      }}
    >
      {/* Top kicker row */}
      <div
        className="flex justify-between items-center"
        style={{ padding: '14px 16px 4px' }}
      >
        <Mono color="accent" size="xs" weight={600}>
          Now featuring
        </Mono>
        <span
          className="inline-flex items-center"
          style={{
            gap: 6,
            fontFamily: "var(--font-mono, 'IBM Plex Mono'), 'JetBrains Mono', ui-monospace, monospace",
            fontSize: 10,
            color: V3.inkSoft,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: TONE_COLOR[statusTone],
            }}
          />
          {statusLabel}
        </span>
      </div>

      {/* Photo + name — 2026-05-22: 68×84 (portrait 직사각) → 80×80 (정사각) */}
      <div
        className="flex items-end"
        style={{ padding: '6px 16px 14px', gap: 14 }}
      >
        <div
          className="relative shrink-0 overflow-hidden"
          style={{
            width: 80,
            height: 80,
            borderRadius: 2,
            background: '#d6c9aa',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.16)',
          }}
        >
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={dogName}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <DogIcon size={28} color={V3.inkMute} strokeWidth={1.4} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0" style={{ paddingBottom: 4 }}>
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: V3FontWeight.black,
              // R23: 34 → 22 (사용자 보고: hero 텍스트 전반 다운)
              fontSize: 22,
              color: V3.ink,
              letterSpacing: '-0.025em',
              lineHeight: 1.25,
              wordBreak: 'keep-all',
            }}
          >
            {dogName}
          </div>
          <div
            className="ft-clamp-1"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12.5,
              color: V3.inkSoft,
              marginTop: 6,
            }}
          >
            {metaLine}
          </div>
        </div>
      </div>

      {/* 4-col metric strip */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${Math.max(metrics.length, 4)}, 1fr)`,
          borderTop: `1px solid ${V3.rule}`,
        }}
      >
        {metrics.map((m, i) => (
          <div
            key={m.key}
            style={{
              padding: '12px 10px',
              borderLeft: i > 0 ? `1px solid ${V3.rule}` : 'none',
            }}
          >
            <Mono color="inkMute" size="xxs" weight={500}>
              {m.key}
            </Mono>
            <div
              className="flex items-baseline"
              style={{ marginTop: 6, gap: 4 }}
            >
              <span
                className="tabular-nums"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: V3FontWeight.black,
                  fontSize: V3FontSize.lg,
                  color: m.tone ? TONE_COLOR[m.tone] : V3.ink,
                  letterSpacing: '-0.025em',
                  lineHeight: 1,
                }}
              >
                {m.value}
              </span>
              <Mono color="inkMute" size="xs" weight={500} letterSpacing="0.06em">
                {m.sub}
              </Mono>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  if (href) {
    return (
      <section style={{ padding: '0 20px 30px' }}>
        <Link href={href} aria-label={`${dogName} 상세 보기`} className="block">
          {card}
        </Link>
      </section>
    )
  }
  return <section style={{ padding: '0 20px 30px' }}>{card}</section>
}
