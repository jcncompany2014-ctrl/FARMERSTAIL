/**
 * StreakBadge — 연속 기록 카운터 + 마일스톤 축하 배너 (item 77).
 *
 * 핸드오프 패턴:
 *   - 작은 인라인 form: sage dot + Mono "연속 N일" — heading 옆에 inline.
 *   - 마일스톤 도달 시 (7 / 30 / 100 / 365) 풀 카드:
 *       ink-bg + yellow Mono kicker + 큰 sans 800 수치 + 축하 메시지 + sparkle.
 *
 * 마일스톤 정의는 호출자가 결정 — passing milestone prop 으로.
 */

import { Sparkles } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

interface StreakBadgeProps {
  /** 현재 연속 일수. */
  currentStreak: number
  /** 활성 강아지 이름 — 마일스톤 메시지에 사용. */
  dogName?: string
  /** 마일스톤 임계치 list. 기본 [7, 30, 100, 365]. */
  milestones?: number[]
  /** 'inline' (단일 row) / 'card' (큰 카드). 자동: streak === milestone 시 'card'. */
  variant?: 'inline' | 'card' | 'auto'
}

const DEFAULT_MILESTONES = [7, 30, 100, 365] as const

export default function StreakBadge({
  currentStreak,
  dogName,
  milestones = DEFAULT_MILESTONES as unknown as number[],
  variant = 'auto',
}: StreakBadgeProps) {
  const isMilestone = milestones.includes(currentStreak)
  const effectiveVariant =
    variant === 'auto' ? (isMilestone ? 'card' : 'inline') : variant

  if (currentStreak < 2 && effectiveVariant === 'inline') return null

  if (effectiveVariant === 'card') {
    return (
      <section style={{ padding: '0 20px 24px' }}>
        <div
          className="ft-card-ink relative overflow-hidden"
          style={{ padding: '20px 22px' }}
        >
          <div
            className="absolute"
            style={{
              top: 16,
              right: 16,
              color: V3.yellow,
            }}
            aria-hidden
          >
            <Sparkles size={36} strokeWidth={1.4} />
          </div>
          <Mono color="yellow" size="xs" weight={600}>
            축하해요 · MILESTONE
          </Mono>
          <div
            className="tabular-nums"
            style={{
              marginTop: 10,
              fontFamily: 'var(--font-sans)',
              fontWeight: V3FontWeight.display,
              fontSize: 54,
              color: V3.paper,
              lineHeight: 0.9,
              letterSpacing: '-0.045em',
            }}
          >
            {currentStreak}
            <span
              style={{
                fontSize: 22,
                fontWeight: V3FontWeight.bold,
                color: V3.yellow,
                marginLeft: 6,
                letterSpacing: '-0.02em',
              }}
            >
              일
            </span>
          </div>
          <p
            style={{
              margin: '14px 0 0',
              fontFamily: 'var(--font-sans)',
              fontSize: 13.5,
              color: 'rgba(244,237,224,0.78)',
              lineHeight: 1.5,
              wordBreak: 'keep-all',
              maxWidth: 280,
            }}
          >
            {dogName ? `${dogName}와 ` : ''}연속 {currentStreak}일 기록 달성!
            매일의 작은 한 끼가 큰 차이를 만들어요.
          </p>
        </div>
      </section>
    )
  }

  return (
    <span className="inline-flex items-center" style={{ gap: 6 }}>
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          background: V3.sage,
        }}
      />
      <Mono color="sage" size="xs" weight={500} upper={false}>
        · 연속 {currentStreak}일
      </Mono>
    </span>
  )
}
