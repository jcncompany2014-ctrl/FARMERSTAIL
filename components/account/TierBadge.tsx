import {
  tierMeta,
  nextTier,
  stampsToNextTier,
  type TierKey,
} from '@/lib/tiers'
import { cardProgress } from '@/lib/stamps'

/**
 * TierBadge — /account 헤더에 노출되는 회원 등급 카드.
 *
 * 보여주는 것:
 *   - 현재 등급 칩 (색 + 이름)
 *   - 모은 도장 개수
 *   - 다음 등급까지 남은 도장 + progress bar
 *   - 혜택 한 줄
 *
 * 데이터: profiles.tier + stamp_count. 구독 결제 1회 = 도장 1개(stamps 트리거)이고
 * **등급의 기준이 곧 도장 개수**다 (2026-07-16 사장님 확정 — 이전엔 누적 결제액).
 * 금액 기준이면 강아지 덩치 큰 집이 자동으로 높은 등급을 먹었다.
 * NULL/없으면 graceful degrade.
 */
export default function TierBadge({
  tier,
  stampCount,
}: {
  tier: TierKey | string | null | undefined
  /** 살아 있는 도장 개수 (profiles.stamp_count). */
  stampCount: number | null | undefined
}) {
  const meta = tierMeta(tier)
  const stamps = stampCount ?? 0
  const next = nextTier(meta.key)
  const remain = stampsToNextTier(stamps, meta.key)
  const card = cardProgress(stamps)
  const isTop = meta.key === 'mate' // 최상위 (단짝) — 진한 배경 + progress 색 반전

  // 오른쪽 "다음 등급까지" 텍스트는 카드 오른쪽(밝은 일러스트 위)에 떨어진다.
  // 흰색 ink 등급(씨앗·열매)은 밝은 일러스트 위에서 흰 글자가 안 보이므로 어두운
  // 색 + 옅은 흰 후광으로 대비 확보. 어두운 ink 등급(새싹·꽃)은 그대로 가독.
  const rightInk = meta.ink === '#FFFFFF' ? '#241E12' : meta.ink
  const rightShadow =
    meta.ink === '#FFFFFF' ? '0 1px 2px rgba(255,255,255,0.55)' : undefined

  // progress: (현재 등급 임계 + 다음까지) 사이 위치
  const lower = meta.threshold
  const upper = next?.threshold ?? meta.threshold
  const progress =
    upper > lower
      ? Math.min(100, Math.max(0, ((stamps - lower) / (upper - lower)) * 100))
      : 100

  return (
    <div
      className="rounded-2xl px-5 py-5 md:px-7 md:py-6 mb-4 md:mb-6"
      style={{
        // 등급별 수채화 일러스트(/tiers/{key}.webp)를 오른쪽에. 왼쪽은 등급색을
        // 그대로 유지(22%까지 불투명 → 78%서 투명, 사장님 22:78)해 식물이 더
        // 드러나게(사장님 2026-06-27). meta.bg 는 6자리 hex 라
        // `${meta.bg}00` 이 같은 색의 완전 투명 — transparent 로 페이드 시
        // 생기는 회색 아티팩트 방지.
        backgroundColor: meta.bg,
        backgroundImage: `linear-gradient(100deg, ${meta.bg} 0%, ${meta.bg} 22%, ${meta.bg}00 78%), url(/tiers/${meta.key}.webp)`,
        backgroundSize: 'cover',
        backgroundPosition: 'right center',
        backgroundRepeat: 'no-repeat',
        color: meta.ink,
      }}
    >
      <div className="min-w-0">
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
              도장 {stamps}개 · {card.cardNumber}번째 판
            </span>
            {next ? (
              <span style={{ opacity: 0.9, color: rightInk, textShadow: rightShadow }}>
                {next.label}까지 {remain}개
              </span>
            ) : (
              <span style={{ opacity: 0.9, color: rightInk, textShadow: rightShadow }}>
                최고 등급 도달!
              </span>
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
                background: isTop ? meta.ink : '#FFFFFF',
                opacity: isTop ? 1 : 0.92,
              }}
            />
          </div>
      </div>
    </div>
  )
}
