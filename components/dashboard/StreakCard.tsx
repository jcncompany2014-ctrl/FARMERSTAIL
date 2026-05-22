import { Flame, PartyPopper } from 'lucide-react'
import type { StreakInfo } from '@/lib/dashboard/streaks'

/**
 * StreakCard — 체크인 연속 cycle 표시.
 *
 * # 노출 조건 (호출처가 결정)
 * - currentStreak >= 2 일 때만 보여줌. 0 / 1 일 때 카드 표시는 압박이 됨.
 * - reachedMilestone 이 있으면 강조 (불꽃 → 폭죽 아이콘 swap).
 *
 * # voice-guidelines §10
 * "연속 N회 채우세요!" 같은 압박 X. "함께 했어요" 톤. 끊겨도 부정적
 * 카피 X — 카드 자체를 안 보여주면 됨.
 *
 * # 디자인
 * - terracotta 8% 배경, 진행 바는 그라데이션 X (디자인 일관성 — 단색 채움)
 * - 진행 바 ARIA: role=progressbar + aria-valuemin/max/now
 */
export default function StreakCard({
  streak,
  dogName,
}: {
  streak: StreakInfo
  dogName: string | null
}) {
  if (streak.currentStreak < 2) return null

  const accent = 'var(--terracotta)'
  const reached = streak.reachedMilestone

  // 진행률 표시 (다음 마일스톤 없으면 100%)
  const pct = Math.round(streak.progressToNext * 100)

  const headline = reached
    ? `${dogName ? `${dogName}의 ` : ''}${reached.label}`
    : `${dogName ? `${dogName}와 ` : ''}${streak.currentStreak} cycle 연속 함께`

  const subtitle = streak.nextMilestone
    ? `다음 마일스톤까지 ${streak.nextMilestone.count - streak.currentStreak} cycle 남았어요`
    : '오래도록 함께 해주셔서 고마워요'

  return (
    <section className="px-5 mt-3" aria-label="체크인 스트릭">
      <div
        className="rounded px-5 py-4"
        style={{
          background: `color-mix(in srgb, ${accent} 8%, white)`,
          border: `1px solid color-mix(in srgb, ${accent} 28%, transparent)`,
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: accent, color: 'white' }}
            aria-hidden
          >
            {reached ? (
              <PartyPopper className="w-5 h-5" strokeWidth={2} />
            ) : (
              <Flame className="w-5 h-5" strokeWidth={2} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="kicker" style={{ color: accent }}>
              {reached ? '함께한 시간' : '연속 체크인'}
            </span>
            <p
              className="font-sans mt-1.5 leading-snug"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--ink)',
                letterSpacing: '-0.01em',
              }}
            >
              {headline}
            </p>
            <p
              className="mt-1 text-[12px] leading-relaxed"
              style={{ color: 'var(--muted)' }}
            >
              {subtitle}
            </p>

            {/* 진행 바 — 다음 마일스톤까지. 마지막 마일스톤 후엔 안 보임. */}
            {streak.nextMilestone && (
              <div
                className="mt-3"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label={`다음 마일스톤 ${streak.nextMilestone.count} cycle 까지 ${pct}%`}
              >
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{
                    background: `color-mix(in srgb, ${accent} 15%, white)`,
                  }}
                >
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{
                      width: `${pct}%`,
                      background: accent,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
