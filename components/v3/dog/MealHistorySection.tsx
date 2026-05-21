/**
 * MealHistorySection — 7일 식사 기록 list (item 51).
 *
 * 핸드오프 패턴:
 *   - heading "식사 기록" + Mono mute "최근 7일"
 *   - 각 row: 일자 mono + meal slot icons (아침/저녁) + status (✓/⨯/일부) + qty
 *   - paperHi card + 1px rule + radius 4
 */

import { Check, X as XIcon, MinusCircle } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

export type MealStatus = 'full' | 'partial' | 'miss'

export interface MealDay {
  /** ISO date (or "MAY 21" 라벨). */
  date: string
  /** 일자 숫자 — 표시용. */
  day: number
  /** 요일 약어 — M/T/W/T/F/S/S. */
  weekday: string
  /** meal slots — 각 슬롯의 status. */
  morning?: MealStatus
  evening?: MealStatus
  /** 총 grams (옵션). */
  totalGrams?: number | null
}

interface MealHistorySectionProps {
  days: MealDay[]
  /** Section heading. 기본 "식사 기록". */
  heading?: string
}

function StatusIcon({ status }: { status: MealStatus | undefined }) {
  if (!status) {
    return <span style={{ width: 14, height: 14, display: 'inline-block' }} />
  }
  if (status === 'full') {
    return <Check size={14} color={V3.sage} strokeWidth={2.2} />
  }
  if (status === 'partial') {
    return <MinusCircle size={14} color={V3.yellow} strokeWidth={2} />
  }
  return <XIcon size={14} color={V3.accent} strokeWidth={2.2} />
}

export default function MealHistorySection({
  days,
  heading = '식사 기록',
}: MealHistorySectionProps) {
  if (days.length === 0) return null

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
          최근 {days.length}일
        </Mono>
      </div>

      <div className="ft-card-v3" style={{ padding: '4px 16px' }}>
        {days.map((d, i) => (
          <div
            key={d.date + i}
            className="flex items-center justify-between"
            style={{
              padding: '12px 0',
              borderTop: i === 0 ? 'none' : `1px solid ${V3.ruleSoft}`,
            }}
          >
            {/* date */}
            <div className="flex items-center" style={{ gap: 12 }}>
              <div
                style={{
                  width: 36,
                  textAlign: 'center',
                }}
              >
                <Mono color="inkMute" size="xxs" weight={500}>
                  {d.weekday}
                </Mono>
                <div
                  className="tabular-nums"
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: V3FontWeight.bold,
                    fontSize: 16,
                    color: V3.ink,
                    lineHeight: 1,
                    letterSpacing: '-0.015em',
                  }}
                >
                  {d.day}
                </div>
              </div>
              <div className="flex items-center" style={{ gap: 10 }}>
                <span className="inline-flex items-center" style={{ gap: 4 }}>
                  <Mono color="inkMute" size="xxs" weight={500}>
                    아침
                  </Mono>
                  <StatusIcon status={d.morning} />
                </span>
                <span className="inline-flex items-center" style={{ gap: 4 }}>
                  <Mono color="inkMute" size="xxs" weight={500}>
                    저녁
                  </Mono>
                  <StatusIcon status={d.evening} />
                </span>
              </div>
            </div>

            {/* total */}
            {d.totalGrams != null && (
              <Mono
                color="ink"
                size="xs"
                weight={500}
                upper={false}
                letterSpacing="0"
              >
                {d.totalGrams} g
              </Mono>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
