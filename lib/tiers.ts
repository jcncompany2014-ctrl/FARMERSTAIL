/**
 * 회원 등급 메타데이터 — DB CHECK 제약과 1:1 매칭.
 *
 * 등급 이름은 DB 와 동일 (소문자). UI 표시명 / 색 / 혜택 텍스트는 여기서.
 */

export type TierKey = 'bronze' | 'silver' | 'gold' | 'vip'

export type TierMeta = {
  key: TierKey
  /** 표시명 */
  label: string
  /** 영문 short */
  en: string
  /** 도달 임계값 (KRW) */
  threshold: number
  /** 색 토큰 — chip background */
  bg: string
  /** 색 토큰 — chip ink */
  ink: string
  /** 혜택 1줄 */
  benefit: string
  /** 적립율 (%) — checkout 적립 계산에서 활용 가능 */
  earnRate: number
}

export const TIERS: TierMeta[] = [
  {
    key: 'bronze',
    label: '브론즈',
    en: 'BRONZE',
    threshold: 0,
    bg: '#C49A6C',
    ink: '#FFFFFF',
    benefit: '기본 구매 적립 1%',
    earnRate: 1,
  },
  {
    key: 'silver',
    label: '실버',
    en: 'SILVER',
    threshold: 100_000,
    bg: '#A8A8AE',
    ink: '#1E1A14',
    benefit: '구매 적립 1.5% · 무료배송 임계 인하',
    earnRate: 1.5,
  },
  {
    key: 'gold',
    label: '골드',
    en: 'GOLD',
    threshold: 500_000,
    bg: '#D4A94A',
    ink: '#1E1A14',
    benefit: '구매 적립 2% · 분기별 5% 쿠폰',
    earnRate: 2,
  },
  {
    key: 'vip',
    label: 'VIP',
    en: 'VIP',
    threshold: 2_000_000,
    bg: '#1E1A14',
    ink: '#D4A94A',
    benefit: '구매 적립 3% · 신상품 24h 우선 + VIP 전용 큐레이션',
    earnRate: 3,
  },
]

export function tierMeta(key: string | null | undefined): TierMeta {
  return TIERS.find((t) => t.key === key) ?? TIERS[0]
}

/** 다음 등급 정보 (이미 최고면 null). progress bar 용. */
export function nextTier(key: string | null | undefined): TierMeta | null {
  const idx = TIERS.findIndex((t) => t.key === key)
  if (idx < 0 || idx === TIERS.length - 1) return null
  return TIERS[idx + 1]
}

/** 다음 등급까지 남은 금액 (이미 최고면 0). */
export function spendToNextTier(
  cumulativeSpend: number,
  currentTierKey: string | null | undefined,
): number {
  const next = nextTier(currentTierKey)
  if (!next) return 0
  return Math.max(0, next.threshold - cumulativeSpend)
}
