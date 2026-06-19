/**
 * ThisWeekSection — 이번 주 7일 그리드 + Quick Action 3 chips.
 *
 * 핸드오프 패턴:
 *   - heading: "이번 주 {dogName}" + Mono sage "· 연속 N일"
 *   - 7-day grid (Mon-Sun) — 각 칸 aspect 1:1 + 상태별 색:
 *       full=ink, partial=yellow, miss=ruleSoft, today=dashed accent border
 *   - 아래 legend (완료/일부 sample) + "오늘 기록하기 →" 우측 CTA
 *   - 그 아래 3-col Quick Action chips (식사/산책/체중)
 */

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'
import QuickActionChips, { type QuickAction } from './QuickActionChips'

export type { QuickAction }

export type DayStatus = 'full' | 'partial' | 'miss' | 'today' | 'future'

export interface WeekDay {
  /** 일자 숫자 — 화면에 표시. */
  date: number
  /** 요일 약어 — M/T/W/T/F/S/S. */
  weekday: string
  status: DayStatus
}

interface ThisWeekSectionProps {
  /** 활성 강아지 id — 체중 등 퀵 시트에 전달. */
  dogId?: string
  /** 활성 강아지 이름 — heading 에 사용. */
  dogName: string
  /** 연속 기록 일수. */
  streak: number
  /** 7일 데이터 — Mon → Sun 순서. */
  days: WeekDay[]
  /** Quick action 3개. */
  quickActions: QuickAction[]
  /** "오늘 기록하기" CTA 경로. */
  recordTodayHref?: string
}

function bgForStatus(status: DayStatus): string {
  switch (status) {
    case 'full':
      return V3.ink
    case 'partial':
      return V3.yellow
    case 'today':
      return 'transparent'
    case 'miss':
    case 'future':
    default:
      return V3.ruleSoft
  }
}

function fgForStatus(status: DayStatus): string {
  switch (status) {
    case 'full':
      return V3.paper
    case 'partial':
      return V3.ink
    case 'today':
      return V3.accent
    case 'miss':
    case 'future':
    default:
      return V3.inkMute
  }
}

export default function ThisWeekSection({
  dogId,
  dogName,
  streak,
  days,
  quickActions,
  recordTodayHref,
}: ThisWeekSectionProps) {
  return (
    <section style={{ padding: '0 20px 30px' }}>
      {/* heading row */}
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
          이번 주 {dogName}
        </h2>
        <Mono color="sage" size="xs" weight={500} upper={false}>
          · 연속 {streak}일
        </Mono>
      </div>

      {/* 7-day grid card */}
      <div
        className="ft-card-v3"
        style={{ padding: '16px 14px' }}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 6,
          }}
        >
          {days.map((d) => {
            const isToday = d.status === 'today'
            return (
              <div key={`${d.date}-${d.weekday}`} className="text-center">
                <div
                  className="flex items-center justify-center ft-aspect-square"
                  style={{
                    width: '100%',
                    borderRadius: 4,
                    background: bgForStatus(d.status),
                    border: isToday ? `1.5px dashed ${V3.accent}` : 'none',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: V3FontWeight.bold,
                    fontSize: 12,
                    color: fgForStatus(d.status),
                  }}
                  aria-label={`${d.date}일 — ${d.status}`}
                >
                  {d.date}
                </div>
                <Mono
                  color="inkMute"
                  size="xxs"
                  weight={500}
                  letterSpacing="0.12em"
                  as="div"
                  style={{ marginTop: 6 }}
                >
                  {d.weekday}
                </Mono>
              </div>
            )
          })}
        </div>

        {/* legend + 오늘 기록하기 */}
        <div
          className="flex justify-between items-center"
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: `1px solid ${V3.rule}`,
          }}
        >
          <div className="flex" style={{ gap: 12 }}>
            <LegendItem color={V3.ink} label="완료" />
            <LegendItem color={V3.yellow} label="일부" />
          </div>
          {recordTodayHref && (
            <Link
              href={recordTodayHref}
              className="inline-flex items-center"
              style={{
                gap: 4,
                background: 'transparent',
                fontFamily: 'var(--font-sans)',
                fontWeight: V3FontWeight.bold,
                fontSize: 12,
                color: V3.accent,
              }}
            >
              오늘 기록하기
              <ArrowRight size={12} color={V3.accent} strokeWidth={2.2} />
            </Link>
          )}
        </div>
      </div>

      {/* Quick Action chips — 식사·산책·체중 (체중은 그 자리에서 시트). */}
      <QuickActionChips dogId={dogId} dogName={dogName} actions={quickActions} />
    </section>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center" style={{ gap: 5 }}>
      <span
        aria-hidden
        style={{ width: 8, height: 8, background: color }}
      />
      <Mono color="inkMute" size="xxs" weight={500}>
        {label}
      </Mono>
    </span>
  )
}
