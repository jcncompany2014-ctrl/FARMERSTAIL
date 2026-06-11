/**
 * MemoTimeline — 메모 / 일지 / 사진 timeline (item 53).
 *
 * 핸드오프 패턴:
 *   - 각 메모: 60×60 사진 thumb (radius 2) + 본문 + ink date pill (좌하단)
 *   - 사진 없으면 paperHi square + 작은 작성자 이니셜
 *   - 본문 limit 4줄, 길면 "더 보기" link
 */

import Image from 'next/image'
import { Camera } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

export interface Memo {
  id: string
  /** 본문 — 200자 권장. */
  body: string
  /** ISO 또는 "MAY 21" 라벨. */
  date: string
  /** 사진 URL. 옵션. */
  photoUrl?: string | null
  /** 작성자 표시명. */
  author?: string
}

interface MemoTimelineProps {
  memos: Memo[]
  /** Section heading. */
  heading?: string
  /** "전체 보기" link href. */
  viewAllHref?: string
}

export default function MemoTimeline({
  memos,
  heading = '메모',
  viewAllHref,
}: MemoTimelineProps) {
  if (memos.length === 0) return null

  return (
    <section style={{ padding: '0 20px 28px' }}>
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
          }}
        >
          {heading}
        </h2>
        {viewAllHref ? (
          <a
            href={viewAllHref}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              color: V3.ink,
              fontWeight: 600,
            }}
          >
            전체보기 ›
          </a>
        ) : (
          <Mono color="inkMute" size="xs" weight={500} upper={false}>
            최근 {memos.length}
          </Mono>
        )}
      </div>

      <div className="flex flex-col" style={{ gap: 10 }}>
        {memos.map((m) => (
          <div
            key={m.id}
            className="ft-card-v3 flex items-start"
            style={{ padding: '14px 16px', gap: 14 }}
          >
            <div
              className="shrink-0 relative overflow-hidden"
              style={{
                width: 60,
                height: 60,
                background: '#d6c9aa',
                borderRadius: 2,
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.16)',
              }}
            >
              {m.photoUrl ? (
                <Image
                  src={m.photoUrl}
                  alt=""
                  fill
                  sizes="60px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Camera size={22} color={V3.inkMute} strokeWidth={1.6} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="ft-clamp-3"
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13.5,
                  color: V3.ink,
                  lineHeight: 1.5,
                  wordBreak: 'keep-all',
                }}
              >
                {m.body}
              </p>
              <div
                className="flex items-center"
                style={{ gap: 8, marginTop: 8 }}
              >
                <span
                  style={{
                    background: V3.ink,
                    color: V3.paper,
                    padding: '3px 7px',
                    borderRadius: 2,
                    fontFamily:
                      "var(--font-mono, 'IBM Plex Mono'), 'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  {m.date}
                </span>
                {m.author && (
                  <Mono color="inkMute" size="xxs" weight={500} upper={false}>
                    by {m.author}
                  </Mono>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
