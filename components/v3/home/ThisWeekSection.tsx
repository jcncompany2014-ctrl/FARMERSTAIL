/**
 * ThisWeekSection — "이번 주 {아이}" 7일 칸 + 식사·산책·체중 빠른 기록 3칸.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 AppHome):
 *   · 제목(제목 글꼴 26) + 오른쪽 "연속 N일"
 *   · 이번 주 일~토 7칸 — 요일이 위, 날짜 칸이 아래(큰 숫자 Anton). 기록한 날 = 먹색 칸,
 *     오늘(아직 안 남김) = 먹색 점선, 그 밖(안 남긴 날·아직 안 온 날) = 옅은 회색.
 *     (예전엔 '오늘까지 지난 7일'이었다 — 제목이 "이번 주"라 달력 한 주(일~토)로 맞췄다.)
 *   · 범례(완료·미기록) + "오늘 기록하기 →"
 *   · 빠른 기록 3칸(회색 칸 + 위 6px 색 띠) — 아래 QuickActionChips
 *   · 기준 한 줄 "식사·산책·체중 중 하나만 남겨도 그날은 완료예요."
 *   (2026-07-17: 하루 한 번이라도 기록하면 완료. partial 등급 폐지 — 이진.)
 */

import Link from 'next/link'
import { V3 } from '@/lib/design/tokens'
import QuickActionChips, { type QuickAction } from './QuickActionChips'

export type { QuickAction }

export type DayStatus = 'full' | 'partial' | 'miss' | 'today' | 'future'

export interface WeekDay {
  /** 일자 숫자 — 화면에 표시. */
  date: number
  /** 요일 — 일/월/화/수/목/금/토. */
  weekday: string
  status: DayStatus
  /** 오늘인가 — 오늘을 이미 기록해 status 가 full 이어도 요일 글자를 진하게. */
  isToday?: boolean
}

interface ThisWeekSectionProps {
  /** 활성 강아지 id — 퀵 시트에 전달. */
  dogId?: string
  /** 활성 강아지 이름 — 제목에 사용. */
  dogName: string
  /** 연속 기록 일수. */
  streak: number
  /** 7일 — 일 → 토 순서. */
  days: WeekDay[]
  /** Quick action 3개. */
  quickActions: QuickAction[]
  /** "오늘 기록하기" 경로. */
  recordTodayHref?: string
}

const TILE: Record<DayStatus, { border: string; bg: string; fg: string }> = {
  full: { border: `2px solid ${V3.ink}`, bg: V3.ink, fg: '#FFFFFF' },
  partial: { border: `2px solid ${V3.ink}`, bg: V3.ink, fg: '#FFFFFF' },
  today: { border: `2px dashed ${V3.ink}`, bg: '#FFFFFF', fg: V3.ink },
  miss: { border: '2px solid #EFEDEE', bg: '#EFEDEE', fg: '#9A9A9A' },
  future: { border: '2px solid #EFEDEE', bg: '#EFEDEE', fg: '#9A9A9A' },
}

/** 스크린리더용 상태 한국어 라벨 — aria-label 에 내부 enum 대신 사용. */
const STATUS_LABEL_KO: Record<DayStatus, string> = {
  full: '완료',
  partial: '일부 기록',
  miss: '기록 없음',
  today: '오늘',
  future: '예정',
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
    <section aria-labelledby="week-title" style={{ padding: '36px 20px 0', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <h2 id="week-title" style={{ margin: 0, fontSize: 26, color: V3.ink, wordBreak: 'keep-all' }}>
          이번 주 {dogName}
        </h2>
        <span style={{ fontSize: 15, fontWeight: 800, color: V3.ink, whiteSpace: 'nowrap' }}>연속 {streak}일</span>
      </div>

      <ol
        aria-label="이번 주 기록"
        style={{
          margin: '14px 0 0',
          padding: 0,
          listStyle: 'none',
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: 5,
          textAlign: 'center',
        }}
      >
        {days.map((d) => {
          const t = TILE[d.status]
          // 오늘 요일 글자는 진하게 — 오늘을 이미 기록했으면(status full) isToday 로 안다.
          const isToday = d.isToday ?? d.status === 'today'
          return (
            <li key={`${d.date}-${d.weekday}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: isToday ? V3.ink : V3.inkMute }}>{d.weekday}</span>
              <span
                className="ft-num"
                aria-label={`${d.date}일 — ${STATUS_LABEL_KO[d.status]}`}
                style={{
                  height: 44,
                  boxSizing: 'border-box',
                  borderRadius: 4,
                  border: t.border,
                  background: t.bg,
                  color: t.fg,
                  fontSize: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {d.date}
              </span>
            </li>
          )
        })}
      </ol>

      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: V3.inkMute }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span aria-hidden style={{ width: 10, height: 10, background: V3.ink }} />
            완료
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span aria-hidden style={{ width: 10, height: 10, background: '#EFEDEE' }} />
            미기록
          </span>
        </span>
        {recordTodayHref && (
          <Link
            href={recordTodayHref}
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: V3.ink,
              minHeight: 40,
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            오늘 기록하기 →
          </Link>
        )}
      </div>

      <QuickActionChips dogId={dogId} dogName={dogName} actions={quickActions} />

      {/* 기준 설명 — "정확히 뭘 해야 의미 있는지 모르겠다"(사장님) 해소. */}
      <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.55, color: V3.inkMute, wordBreak: 'keep-all' }}>
        식사·산책·체중 중 하나만 남겨도 그날은 완료예요.
      </p>
    </section>
  )
}
