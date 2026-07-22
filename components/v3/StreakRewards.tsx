/**
 * StreakRewards — B15. 연속 기록 진행 시각화.
 *
 * 7일 streak 마다 stage up — Bronze / Silver / Gold / Platinum.
 * 다음 단계까지 progress bar + 안내 문구. ★포인트/배지 지급 약속은 하지 않는다
 * (포인트 폐기 2026-07-16 · 감사 #9) — 연속 기록의 가치(분석 정확도)만 안내.
 * 실제 로열티 보상은 스탬프 도장판(구독 결제 기반, lib/stamps)이 담당.
 *
 * # API
 *
 *   <StreakRewards currentStreak={12} />
 */

import { Award } from 'lucide-react'
import { V3, V3FontWeight, V3FontSize, V3Radius } from '@/lib/design/tokens'

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
              fontSize: V3FontSize.xs,
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
              fontSize: V3FontSize.base,
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
            aria-label="다음 단계까지 진행률"
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
              fontSize: V3FontSize.xs,
              color: V3.inkMute,
              lineHeight: 1.4,
            }}
          >
            {/* 포인트 전면 폐기(2026-07-16) 이후 'XXXP 보너스 + 기념 배지'는 안 주는
                보상을 약속하는 거짓 문구였음(감사 #9 · 사장님 2026-07-22 "문구 정리").
                연속 기록의 실제 가치(분석 정확도)로 교체 — 지키지 못할 보상 약속 X. */}
            {rewardText ?? '꾸준히 기록할수록 우리 아이 맞춤 분석이 더 정교해져요.'}
          </p>
        </>
      )}
    </div>
  )
}
