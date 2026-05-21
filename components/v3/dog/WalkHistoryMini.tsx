/**
 * WalkHistoryMini — 산책 기록 + mini 지도 placeholder (item 52).
 *
 * 핸드오프 패턴:
 *   - heading "산책 기록" + Mono mute kicker
 *   - 각 walk row: 좌측 SVG polyline 미니 (paperHi + ink path) + 우측 거리·시간·페이스
 *   - 실제 GPS polyline 은 location 데이터가 필요 — 첫 cut 에서는 옵션 path coords prop.
 */

import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

export interface WalkEntry {
  id: string
  /** ISO 또는 "MAY 21" — date 라벨. */
  date: string
  /** 거리 (m). */
  distanceM: number
  /** 시간 (분). */
  minutes: number
  /** 평균 페이스 — "5'30/km" 등 사전 포맷. */
  paceLabel?: string
  /** SVG polyline points string — "0,30 10,15 ..." (선택). 없으면 dot 한 점. */
  polyline?: string
}

interface WalkHistoryMiniProps {
  walks: WalkEntry[]
  /** Section heading. */
  heading?: string
}

export default function WalkHistoryMini({
  walks,
  heading = '산책 기록',
}: WalkHistoryMiniProps) {
  if (walks.length === 0) return null

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
        <Mono color="inkMute" size="xs" weight={500} upper={false}>
          최근 {walks.length}회
        </Mono>
      </div>

      <div className="flex flex-col" style={{ gap: 8 }}>
        {walks.map((w) => (
          <div
            key={w.id}
            className="ft-card-v3 flex items-center"
            style={{ padding: '12px 14px', gap: 14 }}
          >
            <div
              className="shrink-0 relative overflow-hidden"
              style={{
                width: 70,
                height: 50,
                background: V3.paper,
                borderRadius: 2,
                border: `1px solid ${V3.ruleSoft}`,
              }}
              aria-hidden
            >
              <svg
                width="70"
                height="50"
                viewBox="0 0 70 50"
                style={{ display: 'block' }}
              >
                {w.polyline ? (
                  <polyline
                    points={w.polyline}
                    fill="none"
                    stroke={V3.ink}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <>
                    <line
                      x1="10"
                      y1="40"
                      x2="60"
                      y2="10"
                      stroke={V3.inkSoft}
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                    <circle cx="10" cy="40" r="3" fill={V3.accent} />
                    <circle cx="60" cy="10" r="3" fill={V3.sage} />
                  </>
                )}
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <Mono color="inkMute" size="xxs" weight={500} upper={false}>
                {w.date}
              </Mono>
              <div
                className="flex items-baseline"
                style={{ gap: 6, marginTop: 4 }}
              >
                <span
                  className="tabular-nums"
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: V3FontWeight.bold,
                    fontSize: 15,
                    color: V3.ink,
                    letterSpacing: '-0.015em',
                  }}
                >
                  {(w.distanceM / 1000).toFixed(2)} km
                </span>
                <Mono color="inkMute" size="xs" weight={500}>
                  · {w.minutes}분
                </Mono>
              </div>
            </div>
            {w.paceLabel && (
              <Mono color="ink" size="xs" weight={500} letterSpacing="0.06em">
                {w.paceLabel}
              </Mono>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
