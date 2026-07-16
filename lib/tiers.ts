/**
 * 회원 등급 메타데이터 — DB CHECK 제약과 1:1 매칭.
 *
 * # 기준이 **누적금액 → 스탬프 개수** 로 바뀜 (사장님 확정 2026-07-16)
 * 예전엔 `profiles.cumulative_spend`(원) 기준이었다. 그런데 우리 박스는 **강아지 덩치에
 * 비례해 값이 다르다** — 같은 기간 함께해도 대형견 보호자가 자동으로 높은 등급을 먹었다.
 * 등급 이름이 씨앗→새싹→꽃→열매→나무 라는 **함께한 시간 서사**인데 기준만 돈이었던 셈.
 * 이제 스탬프(구독 결제 1회 = 1개, lib/stamps.ts)를 센다 — 덩치와 무관하다.
 *
 * ⚠️ 스탬프는 2년 만료라 **등급이 내려갈 수 있다**(누적금액은 절대 안 줄었다).
 * 배송이 2주 고정이라 활성 구독자는 겪을 수 없고, 오래 쉬다 온 분만 해당된다 —
 * 등급이 "예전에 많이 썼던 사람"이 아니라 "지금 함께하는 사람"을 가리키게 하는 의도.
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
  /**
   * 도달 임계값 — **살아 있는 스탬프 개수**(구독 결제 횟수). 2026-07-16 이전엔 KRW 누적.
   * 배송이 2주 고정이므로 10개 ≈ 4.6개월.
   */
  threshold: number
  /** 색 토큰 — chip background */
  bg: string
  /** 색 토큰 — chip ink (글자 / 아이콘 색) */
  ink: string
  /** 혜택 1줄 요약 (카드 표시용) */
  benefit: string
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
    benefit: '첫 주문 50% 자동 할인',
    benefits: [
      {
        Icon: 'gift',
        label: '첫 주문 50% 할인',
        detail: '계정당 1회, 첫 정기배송에 자동 적용 (코드·발급 없이)',
      },
      {
        Icon: 'cake',
        label: '생일 할인',
        detail: '강아지 생일 월에 20% 자동 할인',
      },
    ],
  },
  {
    key: 'sprout',
    label: '새싹',
    en: 'SPROUT',
    // '첫 박스 이상' — 첫 구독 결제 1회.
    threshold: 1,
    bg: '#B8CD78', // 연한 새싹 그린
    ink: '#2A2118',
    benefit: '분기 맞춤 분석 리포트',
    benefits: [
      {
        Icon: 'heart',
        label: '분기 맞춤 분석 리포트',
        detail: '분기 1회 메일로 받는 체중·체형·급여량·영양 요약 리포트',
      },
      {
        Icon: 'cake',
        label: '생일 할인',
        detail: '강아지 생일 월에 20% 자동 할인',
      },
    ],
  },
  {
    key: 'bloom',
    label: '꽃',
    en: 'BLOOM',
    // '의미 있는 단골' — 도장판 1장 완성 (~4.6개월).
    threshold: 10,
    bg: '#E8A4A4', // 꽃 핑크
    ink: '#1E1A14',
    benefit: '연 2회 25% 자동 할인 · 전담 영양 상담',
    benefits: [
      {
        Icon: 'heart',
        label: '전담 영양 상담 우선',
        detail: '처방·영양 관련 1:1 상담을 우선으로 응대해 드려요',
      },
      {
        Icon: 'ticket',
        label: '연 2회 25% 자동 할인',
        detail: '연 2회 정기배송에 25% 자동 적용 (코드·발급 없이)',
      },
      {
        Icon: 'cake',
        label: '생일 할인',
        detail: '강아지 생일 월에 20% 자동 할인',
      },
    ],
  },
  {
    key: 'fruit',
    label: '열매',
    en: 'FRUIT',
    // '장기 가족' — 2장 (~9개월).
    threshold: 20,
    bg: '#D27A56', // terracotta — 잘 익은 열매
    ink: '#FFFFFF',
    benefit: '연 4회 20% 자동 할인 · 신제품 우선',
    benefits: [
      {
        Icon: 'sparkles',
        label: '신제품 24h 우선',
        detail: '일반 출시 24시간 전 우선 구매',
      },
      {
        Icon: 'ticket',
        label: '연 4회 20% 자동 할인',
        detail: '연 4회 정기배송에 20% 자동 적용',
      },
      {
        Icon: 'cake',
        label: '생일 할인',
        detail: '강아지 생일 월에 20% 자동 할인',
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
    // '최상' — 3장 (~14개월).
    threshold: 30,
    bg: '#1E1A14', // 가장 어두운 ink — gold accent
    ink: '#D4A94A',
    benefit: '강아지 등록증 · 매 주문 10% 할인 · 한정 큐레이션',
    benefits: [
      {
        Icon: 'certificate',
        label: '파머스테일 강아지 등록증',
        detail: '우리 아이 이름이 박힌 디지털 등록증 PDF 발급',
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
        label: '매 주문 10% 자동 할인',
        detail: '모든 정기배송에 10% 자동 적용',
      },
      {
        Icon: 'cake',
        label: '생일 할인',
        detail: '강아지 생일 월에 20% 자동 할인',
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

/** 다음 등급까지 남은 **스탬프 개수** (이미 최고면 0). */
export function stampsToNextTier(
  activeStampCount: number,
  currentTierKey: string | null | undefined,
): number {
  const next = nextTier(currentTierKey)
  if (!next) return 0
  return Math.max(0, next.threshold - activeStampCount)
}

/**
 * 살아 있는 스탬프 개수 → 등급.
 *
 * DB 의 `fn_compute_tier(stamp_count)` 와 **같은 사다리여야 한다** — 한쪽만 고치면
 * 화면과 DB 가 다른 등급을 말한다. tiers.test.ts 가 이 사다리를 박제한다.
 */
export function tierFromStamps(activeStampCount: number): TierKey {
  const n = Math.max(0, Math.trunc(activeStampCount))
  // 높은 등급부터 — 첫 매치가 답.
  for (let i = TIERS.length - 1; i >= 0; i--) {
    const t = TIERS[i]!
    if (n >= t.threshold) return t.key
  }
  return 'seed'
}
