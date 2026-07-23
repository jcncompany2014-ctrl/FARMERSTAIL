/**
 * 회원 등급 메타데이터 — DB CHECK 제약과 1:1 매칭.
 *
 * # 기준이 **누적금액 → 스탬프 개수** 로 바뀜 (사장님 확정 2026-07-16)
 * 예전엔 `profiles.cumulative_spend`(원) 기준이었다. 그런데 우리 박스는 **강아지 덩치에
 * 비례해 값이 다르다** — 같은 기간 함께해도 대형견 보호자가 자동으로 높은 등급을 먹었다.
 * 등급 이름이 씨앗→새싹→꽃→열매→나무 라는 **함께한 시간 서사**인데 기준만 돈이었던 셈.
 * 이제 스탬프(구독 결제 1회 = 1개, lib/stamps.ts)를 센다 — 덩치와 무관하다.
 *
 * ⚠️ 스탬프는 1년 만료지만 **등급은 강등되지 않는다**(사장님 2026-07-22). 만료되면
 * 화면의 현재 판만 비고, 도달한 등급은 유지된다(DB tg_profiles_sync_tier = ratchet).
 * 그래서 **표시용 등급의 정본은 `profiles.tier`(ratcheted floor)** 이고, 만료로 줄어든
 * stamp_count 에서 다시 파생하면(tierFromStamps) 강등돼 보인다 — 배지엔 resolveTierKey 를 써라.
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
    // 첫 스탬프 카드를 채우면 씨앗. 그 전(0~9)은 **등급 없음**(tier=null).
    threshold: 10,
    bg: '#9CB35F', // moss — 막 시작
    ink: '#FFFFFF',
    benefit: '씨앗 등급 특별 보상',
    benefits: [
      {
        Icon: 'leaf',
        label: '멤버십 시작',
        detail: '스탬프 10개로 첫 카드를 채웠어요. 여기서부터 함께 자랍니다',
      },
    ],
  },
  {
    key: 'sprout',
    label: '새싹',
    en: 'SPROUT',
    threshold: 20,
    bg: '#B8CD78', // 연한 새싹 그린
    ink: '#2A2118',
    benefit: '새싹 등급 특별 보상',
    benefits: [
      {
        Icon: 'heart',
        label: '분기 맞춤 분석 리포트',
        detail: '분기 1회 메일로 받는 체중·체형·급여량·영양 요약 리포트',
      },
    ],
  },
  {
    key: 'bloom',
    label: '꽃',
    en: 'BLOOM',
    threshold: 30,
    bg: '#E8A4A4', // 꽃 핑크
    ink: '#1E1A14',
    benefit: '꽃 등급 특별 보상',
    benefits: [
      {
        Icon: 'heart',
        label: '전담 영양 상담 우선',
        detail: '처방·영양 관련 1:1 상담을 우선으로 응대해 드려요',
      },
    ],
  },
  {
    key: 'fruit',
    label: '열매',
    en: 'FRUIT',
    threshold: 40,
    bg: '#D27A56', // terracotta — 잘 익은 열매
    ink: '#FFFFFF',
    benefit: '열매 등급 특별 보상',
    benefits: [
      {
        Icon: 'gift',
        label: '열매 등급 특별 보상',
        detail: '오래 함께한 열매 등급을 위해 계절마다 준비하는 특별한 보상을 챙겨드려요.',
      },
    ],
  },
  {
    key: 'mate',
    label: '나무',
    en: 'TREE',
    threshold: 50,
    bg: '#1E1A14', // 가장 어두운 ink — gold accent
    ink: '#D4A94A',
    benefit: '나무 등급 특별 보상 · 매 주문 10% 할인',
    benefits: [
      {
        Icon: 'certificate',
        label: '파머스테일 강아지 등록증',
        detail: '우리 아이 이름이 박힌 디지털 등록증 PDF 발급',
      },
      {
        Icon: 'ticket',
        label: '매 주문 10% 자동 할인',
        detail: '모든 정기배송에 10% 자동 적용',
      },
      {
        Icon: 'crown',
        label: '나무 등급 특별 보상',
        detail: '가장 오래 함께한 나무 등급에게만 준비하는 특별한 보상과 선물을 챙겨드려요.',
      },
    ],
  },
]

/**
 * 등급 키 → 메타. **모르는 값이면 null** (2026-07-16).
 *
 * 예전엔 씨앗(TIERS[0])으로 폴백했는데, 이제 **스탬프 0~9 는 '등급 없음'**(tier=null)
 * 이라 폴백하면 **등급 없는 사람이 전부 씨앗으로 보인다.** null 을 돌려줘서 호출부가
 * "등급 없음" 을 명시적으로 그리게 한다(타입 검사기가 빠뜨린 곳을 잡아 준다).
 */
export function tierMeta(key: string | null | undefined): TierMeta | null {
  return TIERS.find((t) => t.key === key) ?? null
}

/**
 * 다음 등급 정보 (이미 최고면 null).
 * **등급이 없으면(key=null) 첫 등급 = 씨앗**을 다음 목표로 돌려준다.
 */
export function nextTier(key: string | null | undefined): TierMeta | null {
  if (key == null || tierMeta(key) === null) return TIERS[0] ?? null
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
 * 살아 있는 스탬프 개수 → 등급. **10개 미만이면 null (등급 없음).**
 *
 * 사장님 확정 2026-07-16: 씨앗부터 10개. 0~9 는 등급을 주지 않고 멤버십 칸을 비워
 * "스탬프를 채워 멤버십을 시작해보세요" 로 유도한다 — 아무것도 안 한 사람에게
 * 등급을 주면 등급이 싸구려가 된다.
 *
 * DB 의 `fn_compute_tier(stamp_count)` 와 **같은 사다리여야 한다** — 한쪽만 고치면
 * 화면과 DB 가 다른 등급을 말한다. lib/stamps.test.ts 가 이 사다리를 박제한다.
 */
export function tierFromStamps(activeStampCount: number): TierKey | null {
  const n = Math.max(0, Math.trunc(activeStampCount))
  // 높은 등급부터 — 첫 매치가 답.
  for (let i = TIERS.length - 1; i >= 0; i--) {
    const t = TIERS[i]!
    if (n >= t.threshold) return t.key
  }
  return null
}

/** 아직 등급이 없는가 (스탬프 10개 미만). */
export function hasNoTier(key: string | null | undefined): boolean {
  return tierMeta(key) === null
}

/** 첫 등급(씨앗)까지 남은 스탬프 수. 이미 등급이 있으면 0. */
export function stampsToFirstTier(activeStampCount: number): number {
  return Math.max(0, TIERS[0]!.threshold - Math.max(0, Math.trunc(activeStampCount)))
}

/** 등급 순위 (없음=0, 씨앗=1 … 나무=5). ratchet 비교용. DB fn_tier_rank 와 동일. */
export function tierRank(key: string | null | undefined): number {
  const idx = TIERS.findIndex((t) => t.key === key)
  return idx < 0 ? 0 : idx + 1
}

/**
 * 표시용 등급 — **강등 없음(ratchet) 반영** (사장님 2026-07-22).
 *
 * `profiles.tier`(도달한 최고 등급 = floor)와 살아있는 stamp_count 파생 등급 중
 * **높은 쪽**을 돌려준다. DB ratchet 이 정상이면 profiles.tier 가 곧 답이지만,
 * 캐시가 아직 안 따라온 경우(예: tier=null 인데 stamp_count 로는 등급이 서는)에도
 * 안전하게 max 를 취한다. 반대로 만료로 stamp_count 가 줄어도 profiles.tier 가
 * 지켜주므로 배지가 강등되지 않는다.
 *
 * @param profileTier profiles.tier (ratcheted floor). null = 아직 등급 없음.
 * @param activeStampCount profiles.stamp_count (살아있는 개수).
 */
export function resolveTierKey(
  profileTier: string | null | undefined,
  activeStampCount: number,
): TierKey | null {
  const fromProfile = tierMeta(profileTier)?.key ?? null
  const fromStamps = tierFromStamps(activeStampCount)
  return tierRank(fromProfile) >= tierRank(fromStamps) ? fromProfile : fromStamps
}
