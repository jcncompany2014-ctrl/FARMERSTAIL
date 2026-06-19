/**
 * 회원 등급 메타데이터 — DB CHECK 제약과 1:1 매칭.
 *
 * 5단계 lifecycle: 씨앗에서 시작해 나무로 자라는 여정.
 *   seed   · 씨앗     첫 한 끼 전
 *   sprout · 새싹     첫 박스 이상
 *   bloom  · 꽃       의미 있는 단골
 *   fruit  · 열매     장기 가족
 *   mate   · 나무     최상 — 강아지 등록증 발급
 *
 * 등급 이름은 DB 와 동일 (소문자 영문). 표시명·색·혜택은 여기서.
 */

export type TierKey = 'seed' | 'sprout' | 'bloom' | 'fruit' | 'mate'

export type TierBenefit = {
  Icon:
    | 'coins'
    | 'truck'
    | 'ticket'
    | 'crown'
    | 'gift'
    | 'sparkles'
    | 'cake'
    | 'leaf'
    | 'flower'
    | 'heart'
    | 'paw'
    | 'certificate'
  label: string
  detail: string
}

export type TierMeta = {
  key: TierKey
  /** 한국어 표시명 */
  label: string
  /** 영문 short (kicker 톤) */
  en: string
  /** 도달 임계값 (KRW 누적 결제) */
  threshold: number
  /** 색 토큰 — chip background */
  bg: string
  /** 색 토큰 — chip ink (글자 / 아이콘 색) */
  ink: string
  /** 혜택 1줄 요약 (카드 표시용) */
  benefit: string
  /** 적립률 (%) */
  earnRate: number
  /** 등급별 상세 혜택 — 멤버십 hub 페이지 표시 */
  benefits: TierBenefit[]
}

export const TIERS: TierMeta[] = [
  {
    key: 'seed',
    label: '씨앗',
    en: 'SEED',
    threshold: 0,
    bg: '#9CB35F', // moss — 막 시작
    ink: '#FFFFFF',
    benefit: '가입 환영 쿠폰 · 구매 적립 1%',
    earnRate: 1,
    benefits: [
      {
        Icon: 'gift',
        label: '가입 환영 쿠폰',
        detail: '첫 결제에 자동 적용되는 환영 할인',
      },
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
    ],
  },
  {
    key: 'sprout',
    label: '새싹',
    en: 'SPROUT',
    threshold: 50_000,
    bg: '#B8CD78', // 연한 새싹 그린
    ink: '#2A2118',
    benefit: '구매 적립 1.5% · 무료배송 임계 인하',
    earnRate: 1.5,
    benefits: [
      {
        Icon: 'leaf',
        label: '구매 적립 1.5%',
        detail: '씨앗 대비 +0.5% 추가 적립',
      },
      {
        Icon: 'truck',
        label: '무료배송 임계 인하',
        detail: '3만원 이상 무료 (씨앗 5만원)',
      },
      {
        Icon: 'cake',
        label: '생일 쿠폰 강화',
        detail: '생일 당일 7% 할인 쿠폰',
      },
    ],
  },
  {
    key: 'bloom',
    label: '꽃',
    en: 'BLOOM',
    threshold: 300_000,
    bg: '#E8A4A4', // 꽃 핑크
    ink: '#1E1A14',
    benefit: '구매 적립 2% · 항상 무료배송 · 분기 5% 쿠폰',
    earnRate: 2,
    benefits: [
      {
        Icon: 'flower',
        label: '구매 적립 2%',
        detail: '새싹 대비 +0.5% 추가 적립',
      },
      {
        Icon: 'truck',
        label: '항상 무료배송',
        detail: '주문 금액 무관 무료',
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
    key: 'fruit',
    label: '열매',
    en: 'FRUIT',
    threshold: 1_000_000,
    bg: '#D27A56', // terracotta — 잘 익은 열매
    ink: '#FFFFFF',
    benefit: '적립 2.5% · 신제품 24h 우선 · 월 10% 쿠폰',
    earnRate: 2.5,
    benefits: [
      {
        Icon: 'sparkles',
        label: '구매 적립 2.5%',
        detail: '꽃 대비 +0.5% 추가 적립',
      },
      {
        Icon: 'sparkles',
        label: '신제품 24h 우선',
        detail: '일반 출시 24시간 전 우선 구매',
      },
      {
        Icon: 'ticket',
        label: '월 10% 쿠폰',
        detail: '매월 1일 10% 할인 쿠폰 자동 발급',
      },
      {
        Icon: 'cake',
        label: '생일 쿠폰',
        detail: '생일 당일 12% 할인 쿠폰',
      },
      {
        Icon: 'gift',
        label: '계간 산지 신문',
        detail: '분기 1회 종이 신문 배송 (산지 이야기)',
      },
    ],
  },
  {
    key: 'mate',
    label: '나무',
    en: 'TREE',
    threshold: 3_000_000,
    bg: '#1E1A14', // 가장 어두운 ink — gold accent
    ink: '#D4A94A',
    benefit: '강아지 등록증 · 적립 3% · 매월 15% 쿠폰 · 한정 큐레이션',
    earnRate: 3,
    benefits: [
      {
        Icon: 'certificate',
        label: '파머스테일 강아지 등록증',
        detail: '우리 아이 이름이 박힌 디지털 등록증 PDF 발급',
      },
      {
        Icon: 'paw',
        label: '구매 적립 3%',
        detail: '최고 적립률',
      },
      {
        Icon: 'crown',
        label: '나무 한정 큐레이션',
        detail: '시즌별 나무 등급 한정 메뉴 · 한정 굿즈',
      },
      {
        Icon: 'sparkles',
        label: '신제품 48h 우선',
        detail: '일반 출시 48시간 전 우선 구매',
      },
      {
        Icon: 'ticket',
        label: '매월 15% 쿠폰',
        detail: '매월 1일 15% 할인 쿠폰 자동 발급',
      },
      {
        Icon: 'heart',
        label: '강아지 생일 손편지',
        detail: '강아지 생일에 손편지 + 사진 카드 배송',
      },
      {
        Icon: 'gift',
        label: '계간 산지 신문 + 산지 방문 추첨',
        detail: '분기 1회 종이 신문 · 연 1회 농장 방문 추첨',
      },
    ],
  },
]

export function tierMeta(key: string | null | undefined): TierMeta {
  return TIERS.find((t) => t.key === key) ?? TIERS[0]!
}

/** 다음 등급 정보 (이미 최고면 null). progress bar 용. */
export function nextTier(key: string | null | undefined): TierMeta | null {
  const idx = TIERS.findIndex((t) => t.key === key)
  if (idx < 0 || idx === TIERS.length - 1) return null
  return TIERS[idx + 1] ?? null
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
