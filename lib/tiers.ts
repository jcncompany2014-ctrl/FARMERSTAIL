/**
 * 회원 등급 메타데이터 — DB CHECK 제약과 1:1 매칭.
 *
 * 등급 이름은 DB 와 동일 (소문자). UI 표시명 / 색 / 혜택 텍스트는 여기서.
 */

export type TierKey = 'bronze' | 'silver' | 'gold' | 'vip'

export type TierBenefit = {
  Icon: 'coins' | 'truck' | 'ticket' | 'crown' | 'gift' | 'sparkles' | 'cake'
  label: string
  detail: string
}

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
  /** 혜택 1줄 (요약) — 카드 기본 표시용 */
  benefit: string
  /** 적립율 (%) — checkout 적립 계산에서 활용 가능 */
  earnRate: number
  /** 등급별 detailed 혜택 list — 멤버십 hub 페이지 표시용 */
  benefits: TierBenefit[]
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
    benefits: [
      {
        Icon: 'coins',
        label: '구매 적립 1%',
        detail: '결제 금액의 1% 포인트 자동 적립',
      },
      {
        Icon: 'cake',
        label: '생일 쿠폰',
        detail: '생일 당일 5% 할인 쿠폰 자동 발급',
      },
      {
        Icon: 'gift',
        label: '가입 환영 쿠폰',
        detail: '5,000원 첫구매 쿠폰',
      },
    ],
  },
  {
    key: 'silver',
    label: '실버',
    en: 'SILVER',
    threshold: 100_000,
    bg: '#A8A8AE',
    ink: '#1E1A14',
    benefit: '구매 적립 1.5% · 무료배송 인하',
    earnRate: 1.5,
    benefits: [
      {
        Icon: 'coins',
        label: '구매 적립 1.5%',
        detail: '브론즈 대비 +0.5% 추가 적립',
      },
      {
        Icon: 'truck',
        label: '무료배송 임계 인하',
        detail: '3만원 이상 무료 (브론즈 5만원)',
      },
      {
        Icon: 'cake',
        label: '생일 쿠폰 강화',
        detail: '생일 당일 7% 할인 쿠폰',
      },
    ],
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
    benefits: [
      {
        Icon: 'coins',
        label: '구매 적립 2%',
        detail: '실버 대비 +0.5% 추가 적립',
      },
      {
        Icon: 'truck',
        label: '항상 무료배송',
        detail: '주문 금액 무관 무료 (골드 한정)',
      },
      {
        Icon: 'ticket',
        label: '분기 5% 쿠폰',
        detail: '3개월마다 5% 할인 쿠폰 자동 발급',
      },
      {
        Icon: 'cake',
        label: '생일 쿠폰',
        detail: '생일 당일 10% 할인 쿠폰',
      },
    ],
  },
  {
    key: 'vip',
    label: 'VIP',
    en: 'VIP',
    threshold: 2_000_000,
    bg: '#1E1A14',
    ink: '#D4A94A',
    benefit: '구매 적립 3% · VIP 전용 큐레이션',
    earnRate: 3,
    benefits: [
      {
        Icon: 'coins',
        label: '구매 적립 3%',
        detail: '최고 적립률 — 골드 대비 +1%',
      },
      {
        Icon: 'crown',
        label: 'VIP 전용 큐레이션',
        detail: '시즌별 VIP 한정 메뉴 / 한정 상품',
      },
      {
        Icon: 'sparkles',
        label: '신상품 24h 우선',
        detail: '일반 출시 24시간 전 우선 구매',
      },
      {
        Icon: 'ticket',
        label: '월 10% 쿠폰',
        detail: '매월 1일 10% 할인 쿠폰',
      },
      {
        Icon: 'cake',
        label: '프리미엄 생일 선물',
        detail: '생일 당일 15% 쿠폰 + 한정 굿즈',
      },
    ],
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
