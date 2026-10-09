/**
 * StreakRewards — B15. 연속 기록 진행 시각화.
 *
 * 7일 streak 마다 단계가 오른다(7 · 21 · 50 · 100일). 다음 단계까지 막대 + 안내 문구.
 * ★포인트/배지 지급 약속은 하지 않는다 (포인트 폐기 2026-07-16 · 감사 #9) — 연속 기록의 가치(분석 정확도)만 안내.
 * 실제 로열티 보상은 스탬프 도장판(구독 결제 기반, lib/stamps)이 담당.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 T01) + 결정 6번: 단계 영어 이름(Bronze·Silver·Gold·Platinum)을
 *   화면에서 뺐다 — "8일째 이어서 기록 중 · 다음 단계까지 13일". 회색 카드 + 머스타드 막대.
 *
 * # API
 *
 *   <StreakRewards currentStreak={12} />
 */

import { V3 } from '@/lib/design/tokens'

interface StreakRewardsProps {
  currentStreak: number
  /** 막대 아래 안내 텍스트. 기본값 사용 가능. */
  rewardText?: string
}

/** 단계 문턱(일) — 이름은 화면에 쓰지 않는다(결정 6번). */
const THRESHOLDS = [0, 7, 21, 50, 100] as const

function pickStage(streak: number): { floor: number; next: number | null } {
  let floor = 0
  for (const t of THRESHOLDS) {
    if (streak >= t) floor = t
  }
  const next = THRESHOLDS.find((t) => t > streak) ?? null
  return { floor, next }
}

export default function StreakRewards({ currentStreak, rewardText }: StreakRewardsProps) {
  const { floor, next } = pickStage(currentStreak)
  const pct = next ? Math.min(100, Math.round(((currentStreak - floor) / (next - floor)) * 100)) : 100

  return (
    <section
      aria-label="연속 기록"
      style={{
        margin: '22px 20px 0',
        padding: '16px 16px 18px',
        borderRadius: 4,
        background: V3.soft,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: V3.ink }}>{currentStreak}일째 이어서 기록 중</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: V3.inkMute, whiteSpace: 'nowrap' }}>
          {next ? `다음 단계까지 ${next - currentStreak}일` : '가장 높은 단계예요'}
        </span>
      </div>
      <span
        role="progressbar"
        aria-label="다음 단계까지 진행"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        style={{ height: 8, background: '#E5E3E4', display: 'block' }}
      >
        <span style={{ display: 'block', width: `${pct}%`, height: 8, background: V3.mustard, transition: 'width 240ms' }} />
      </span>
      <span style={{ fontSize: 15, lineHeight: 1.5, color: V3.inkSoft }}>
        {/* 포인트 전면 폐기(2026-07-16) 이후 'XXXP 보너스 + 기념 배지'는 안 주는 보상을 약속하는 거짓 문구였음
            (감사 #9 · 사장님 2026-07-22 "문구 정리"). 연속 기록의 실제 가치(분석 정확도)로 — 지키지 못할 보상 약속 X. */}
        {rewardText ?? '꾸준히 기록할수록 우리 아이 맞춤 분석이 더 정교해져요.'}
      </span>
    </section>
  )
}
