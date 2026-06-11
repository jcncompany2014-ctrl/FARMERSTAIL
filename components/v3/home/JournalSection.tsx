/**
 * JournalSection — 강아지 저널 / 메모 / 활동 로그 카드.
 *
 * 핸드오프 패턴:
 *   - heading: "저널 · {dogName}의 기록" + 우측 mute "최근 N"
 *   - 각 엔트리: 좌측 ink date pillar (월 + 일자 18 bold) + 우측 tag chip + 제목 + 본문
 */

import Link from 'next/link'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

export interface JournalEntry {
  id: string
  /** ISO 날짜 (또는 "20 MAY" 같이 사전 포맷된 라벨). */
  date: string
  /** 제목. */
  title: string
  /** 본문 (1-2 줄 권장). */
  body: string
  /** 태그 라벨 — 산책 / 식사 / 병원 / 일상 등. */
  tag?: string
  /** 태그 톤 — sage / accent / yellow / ink / blue 등. */
  tagTone?: 'sage' | 'accent' | 'yellow' | 'ink' | 'blue'
  /** 클릭 시 이동할 상세 경로. */
  href?: string
}

interface JournalSectionProps {
  /** 활성 강아지 이름. */
  dogName: string
  entries: JournalEntry[]
  /** "전체보기 →" 헤더 우측 링크 (옵션). */
  viewAllHref?: string
}

const TAG_BG: Record<NonNullable<JournalEntry['tagTone']>, string> = {
  sage: V3.sage,
  accent: V3.accent,
  yellow: V3.yellow,
  ink: V3.ink,
  blue: V3.blue,
}

const TAG_FG: Record<NonNullable<JournalEntry['tagTone']>, string> = {
  sage: V3.paperHi,
  accent: V3.paperHi,
  yellow: V3.ink,
  ink: V3.paperHi,
  blue: V3.paperHi,
}

/** ISO 또는 "20 MAY" 라벨 — month 짧은 약어 + day 2자리로 분리. */
function parseDateLabel(s: string): { month: string; day: string } {
  // 이미 "20 MAY" / "MAY 20" 형식이면 단순 split.
  const parts = s.trim().split(/\s+/)
  if (parts.length === 2) {
    const a = parts[0] ?? ''
    const b = parts[1] ?? ''
    if (a && b && /^[0-9]+$/.test(a) && /^[A-Z]+$/i.test(b)) {
      return { day: a.padStart(2, '0'), month: b.toUpperCase() }
    }
    if (a && b && /^[0-9]+$/.test(b) && /^[A-Z]+$/i.test(a)) {
      return { day: b.padStart(2, '0'), month: a.toUpperCase() }
    }
  }
  // ISO 또는 Date 파싱 가능한 형식
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0')
    const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
    return { day, month }
  }
  return { day: '--', month: '---' }
}

export default function JournalSection({
  dogName,
  entries,
  viewAllHref,
}: JournalSectionProps) {
  if (entries.length === 0) return null

  return (
    <section style={{ padding: '0 20px 30px' }}>
      <div
        className="flex items-baseline justify-between"
        style={{ marginBottom: 14 }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 22,
            color: V3.ink,
            letterSpacing: '-0.025em',
            wordBreak: 'keep-all',
          }}
        >
          저널 · {dogName}의 기록
        </h2>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 13.5,
              color: V3.ink,
              fontWeight: 600,
            }}
          >
            전체보기 ›
          </Link>
        ) : (
          <Mono color="inkMute" size="xs" weight={500}>
            최근 {entries.length}
          </Mono>
        )}
      </div>

      <div className="flex flex-col" style={{ gap: 8 }}>
        {entries.map((e) => (
          <JournalCard key={e.id} entry={e} />
        ))}
      </div>
    </section>
  )
}

function JournalCard({ entry }: { entry: JournalEntry }) {
  const { day, month } = parseDateLabel(entry.date)
  const tagTone = entry.tagTone ?? 'sage'

  const card = (
    <div
      className="ft-card-v3 flex items-start"
      style={{ padding: '14px 16px', gap: 14 }}
    >
      <div
        className="shrink-0 text-center"
        style={{
          background: V3.ink,
          color: V3.paper,
          padding: '6px 8px',
          borderRadius: 2,
          minWidth: 50,
        }}
      >
        <Mono color="paper" size="xxs" weight={500} letterSpacing="0.18em">
          {month}
        </Mono>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 18,
            lineHeight: 1,
            marginTop: 2,
            letterSpacing: '-0.025em',
          }}
        >
          {day}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        {entry.tag && (
          <div className="flex items-center" style={{ gap: 8 }}>
            <span
              style={{
                background: TAG_BG[tagTone],
                color: TAG_FG[tagTone],
                fontFamily: "var(--font-mono, 'IBM Plex Mono'), 'JetBrains Mono', ui-monospace, monospace",
                fontSize: 9,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 2,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              {entry.tag}
            </span>
          </div>
        )}
        <div
          className="ft-clamp-1"
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.bold,
            fontSize: 16,
            color: V3.ink,
            marginTop: 6,
            letterSpacing: '-0.015em',
            wordBreak: 'keep-all',
          }}
        >
          {entry.title}
        </div>
        <div
          className="ft-clamp-2"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            color: V3.inkSoft,
            marginTop: 4,
            lineHeight: 1.4,
            wordBreak: 'keep-all',
          }}
        >
          {entry.body}
        </div>
      </div>
    </div>
  )
  return entry.href ? <Link href={entry.href}>{card}</Link> : card
}
