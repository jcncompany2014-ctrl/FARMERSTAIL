import { Crown, Sparkles } from 'lucide-react'
import {
  tierMeta,
  nextTier,
  spendToNextTier,
  type TierKey,
} from '@/lib/tiers'

/**
 * TierBadge — /account 헤더에 노출되는 회원 등급 카드.
 *
 * 보여주는 것:
 *   - 현재 등급 칩 (색 + 이름)
 *   - 누적 결제 (KRW)
 *   - 다음 등급까지 남은 금액 + progress bar
 *   - 혜택 한 줄
 *
 * 데이터: profiles.tier + cumulative_spend (마이그레이션 20260425000011 으로
 * 자동 갱신). 두 컬럼이 NULL/없으면 graceful degrade.
 */
export default function TierBadge({
  tier,
  cumulativeSpend,
}: {
  tier: TierKey | string | null | undefined
  cumulativeSpend: number | null | undefined
}) {
  const meta = tierMeta(tier)
  const spend = cumulativeSpend ?? 0
  const next = nextTier(meta.key)
  const remain = spendToNextTier(spend, meta.key)
  const isVip = meta.key === 'vip'

  // progress: (현재 등급 임계 + 다음까지) 사이 위치
  const lower = meta.threshold
  const upper = next?.threshold ?? meta.threshold
  const progress =
    upper > lower
      ? Math.min(100, Math.max(0, ((spend - lower) / (upper - lower)) * 100))
      : 100

  return (
    <div
      className="rounded-2xl px-5 py-5 md:px-7 md:py-6 mb-4 md:mb-6"
      style={{ background: meta.bg, color: meta.ink }}
    >
      <div className="flex items-start gap-4">
        <div
          className="shrink-0 inline-flex w-10 h-10 md:w-12 md:h-12 rounded-full items-center justify-center"
          style={{
            background: isVip ? meta.ink : 'rgba(255,255,255,0.15)',
            color: isVip ? meta.bg : meta.ink,
          }}
        >
          {isVip ? (
            <Crown className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2} />
          ) : (
            <Sparkles className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="font-mono text-[10px] md:text-[11px] tracking-[0.22em] uppercase"
            style={{ opacity: 0.75 }}
          >
            Member · {meta.en}
          </div>
          <h2
            className="font-serif mt-1 text-[20px] md:text-[26px]"
            style={{ fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            {meta.label} 등급
          </h2>
          <p
            className="mt-1.5 text-[12px] md:text-[13.5px]"
            style={{ opacity: 0.85 }}
          >
            {meta.benefit}
          </p>

          <div className="mt-4 flex items-center justify-between text-[11px] md:text-[12px] font-mono tabular-nums">
            <span style={{ opacity: 0.85 }}>
              누적 {spend.toLocaleString('ko-KR')}원
            </span>
            {next ? (
              <span style={{ opacity: 0.85 }}>
                {next.label}까지 {remain.toLocaleString('ko-KR')}원
              </span>
            ) : (
              <span style={{ opacity: 0.85 }}>최고 등급 도달!</span>
            )}
          </div>

          <div
            className="mt-2 h-1.5 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.25)' }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${progress}%`,
                background: isVip ? meta.ink : '#FFFFFF',
                opacity: isVip ? 1 : 0.92,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
