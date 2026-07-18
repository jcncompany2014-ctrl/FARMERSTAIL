/**
 * 화식 비율 티어 — **정본 (single source of truth).**
 *
 * 박스 구독은 배송·결제 무조건 2주마다. 사용자는 화식 비율(30/60/100)만 고르고
 * 그 값이 subscriptions.fresh_ratio 에 저장된다.
 *
 * # 왜 한 곳에 모았나 (2026-07-18, 사장님 "일치시켜")
 * 이전엔 이 티어 배열이 3곳에 **각각 로컬 정의**돼 있었다(OrderClient·PlanClient·
 * RecommendationBox). 스키마도 제각각(value/label · value/label/sub · key/name/ratio)
 * 이라, 내용은 같아도 하나 고치면 나머지가 갈라지는 drift 위험이었고 라벨도
 * "곁들임"(선택 화면) ↔ "화식 곁들임"(구독 표시)으로 불일치했다(#A9).
 * 이제 여기 하나만 두고 세 화면·freshTierLabel 이 전부 이걸 쓴다.
 *
 * ⚠️ 티어를 여기 밖에서 다시 정의하지 말 것. import 해서 쓴다.
 */

export type FreshTier = {
  /** 화식 비율 % — subscriptions.fresh_ratio 에 저장되는 값. */
  ratio: 30 | 60 | 100
  /** 내부 키. */
  key: 'light' | 'half' | 'full'
  /** 표시 라벨(선택·구독 표시 공통). 사장님 확정: 곁들임/반반/완전 화식. */
  label: string
  /** 비율 구성 부제. */
  sub: string
  /** 강조 배지(있는 티어만). */
  badge?: string
  /** 한 줄 설명. */
  copy: string
  /** 보조 안내(있는 티어만). */
  note?: string
}

export const FRESH_TIERS = [
  {
    ratio: 30,
    key: 'light',
    label: '곁들임',
    sub: '화식 30% · 건사료 70%',
    badge: '추천',
    copy: '작은 비용으로 떼는 첫걸음, 기호성과 영양을 더해요',
    note: '화식이 처음이라면, 익숙해질 때까지 건사료와 섞어 급여하는 걸 권장해요',
  },
  {
    ratio: 60,
    key: 'half',
    label: '반반',
    sub: '화식 60% · 건사료 40%',
    copy: '화식 반 사료 반, 부담은 낮추고 균형은 챙겨요',
  },
  {
    ratio: 100,
    key: 'full',
    label: '완전 화식',
    sub: '화식 100%',
    copy: '매일 그릇 가득, 완벽한 영양과 행복을 담아요',
  },
] as const satisfies readonly FreshTier[]

export type FreshRatio = (typeof FRESH_TIERS)[number]['ratio']
export type FreshTierKey = (typeof FRESH_TIERS)[number]['key']

/**
 * fresh_ratio → 표시 라벨. 정본 FRESH_TIERS 에서 파생 —
 * 마이페이지·계정·admin·이메일 등 구독 표시가 전부 이걸 쓴다(선택 화면과 동일 라벨).
 * 값이 티어에 없으면(레거시/미상) 중립 라벨.
 */
export function freshTierLabel(freshRatio: number | null | undefined): string {
  const t = FRESH_TIERS.find((x) => x.ratio === freshRatio)
  return t ? t.label : '맞춤 화식 박스'
}
