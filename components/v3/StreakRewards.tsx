/**
 * StreakRewards — B15. 연속 체크인 보상 시각화.
 *
 * 7일 streak 마다 stage up — Bronze / Silver / Gold / Platinum.
 * 다음 단계까지 progress bar + 다음 보상 안내.
 *
 * # API
 *
 *   <StreakRewards currentStreak={12} />
 */

import { Award } from 'lucide-react'
import { V3, V3FontWeight, V3Radius } from '@/lib/design/tokens'

interface StreakRewardsProps {
  currentStreak: number
  /** 다음 단계 진입 시 보상 안내 텍스트. 기본값 사용 가능. */
  rewardText?: string
}

interface Stage {
  name: string
  threshold: number
  tone: string
}

const STAGES: Stage[] = [
  { name: '시작', threshold: 0, tone: V3.inkFaint },
  { name: 'Bronze', threshold: 7, tone: '#8b6f3a' },
  { name: 'Silver', threshold: 21, tone: '#9da7b3' },
  { name: 'Gold', threshold: 50, tone: V3.yellow },
  { name: 'Platinum', threshold: 100, tone: V3.sage },
]

function pickStage(streak: number): { stage: Stage; next: Stage | null } {
  let stage = STAGES[0]!
  for (const s of STAGES) {
    if (streak >= s.threshold) stage = s
  }
  const next = STAGES.find((s) => s.threshold > streak) ?? null
  return { stage, next }
}

export default function StreakRewards({
  currentStreak,
  rewardText,
}: StreakRewardsProps) {
  const { stage, next } = pickStage(currentStreak)
  const pct = next
    ? Math.min(
        100,
        Math.round(
          ((currentStreak - stage.threshold) /
            (next.threshold - stage.threshold)) *
            100,
        ),
      )
    : 100

  return (
    <div
      style={{
        background: V3.paperHi,
        border: `1px solid ${V3.rule}`,
        borderLeft: `4px solid ${stage.tone}`,
        borderRadius: V3Radius.sm,
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Award size={20} color={stage.tone} strokeWidth={2} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              fontWeight: V3FontWeight.bold,
              color: stage.tone,
              letterSpacing: '0.16em',
              wordSpacing: '-0.12em',
              textTransform: 'uppercase',
            }}
          >
            {stage.name} · {currentStreak}일 연속
          </span>
          <p
            style={{
              marginTop: 4,
              fontFamily: 'var(--font-sans)',
              fontSize: 13.5,
              fontWeight: V3FontWeight.bold,
              color: V3.ink,
              letterSpacing: '-0.01em',
              lineHeight: 1.3,
            }}
          >
            {next
              ? `${next.name} 까지 ${next.threshold - currentStreak}일`
              : '최고 단계 도달'}
          </p>
        </div>
      </div>
      {next && (
        <>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            style={{
              marginTop: 10,
              height: 6,
              borderRadius: 999,
              background: V3.paperDeep,
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                display: 'block',
                width: `${pct}%`,
                height: '100%',
                background: stage.tone,
                transition: 'width 240ms',
              }}
            />
          </div>
          <p
            style={{
              marginTop: 8,
              fontSize: 10.5,
              color: V3.inkMute,
              lineHeight: 1.4,
            }}
          >
            {rewardText ??
              `다음 단계 도달 시 ${(next.threshold - stage.threshold) * 100}P 보너스 + 기념 배지`}
          </p>
        </>
      )}
    </div>
  )
}
