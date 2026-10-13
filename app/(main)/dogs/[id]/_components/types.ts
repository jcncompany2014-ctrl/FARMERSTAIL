/**
 * Shared types for dog-detail page sub-components.
 *
 * Extracted from /app/(main)/dogs/[id]/page.tsx to keep that monolith trimmer.
 * Sub-components (CurrentFormulaCard / SubscriptionCard / WeightSparkline)
 * import from here so the parent page only imports each component once.
 */

export type Dog = {
  id: string
  name: string
  breed: string | null
  gender: string | null
  neutered: boolean | null
  age_value: number | null
  age_unit: string | null
  weight: number | null
  activity_level: string | null
  photo_url: string | null
  created_at: string
}

export type WeightLog = {
  id: string
  weight: number
  measured_at: string
  note: string | null
}

/** 현재 처방 카드 — dog_formulas 최신 row + checkins. */
export type CurrentFormula = {
  cycle_number: number
  approval_status: 'auto_applied' | 'pending_approval' | 'approved' | 'declined'
  applied_from: string | null
  applied_until: string | null
  formula: { lineRatios: Record<string, number> }
  // daily_grams 없음 — 저장값을 화면이 쓰지 않는다(규칙 35). 필요하면
  // lib/personalization/dailyGrams 의 dailyGramsOf 로 kcal+비율에서 다시 센다.
  daily_kcal: number
  user_adjusted: boolean
  created_at?: string
  /**
   * 화면용 이 식단의 시작일(KST yyyy-mm-dd) — applied_from, 없으면(1회차) 그 구독의 **첫 박스 발송일**.
   * DB 칸이 아니다 — page.tsx 가 채운다. 1회차는 설계상 applied_from 이 비어 있어(lib/personalization/cycle)
   * 체크인 D-day 가 한 번도 안 떴다(2026-10-12 점검: 운영 dog_formulas 23행 전부 NULL).
   */
  cycle_start?: string | null
  /**
   * 아직 답하지 않은 새 제안(승인 대기)의 회차 — DB 칸이 아니다, page.tsx 가 채운다(2026-10-13 E4).
   * 카드는 '지금 먹는 식단'을 그리고, 이 값이 있으면 '새 식단 확인하기' 버튼만 이 회차로 연다.
   */
  pending_cycle?: number | null
}

export type CheckinStatus = {
  week_2: boolean
  week_4: boolean
}

/** 강아지 정기배송 카드 — subscriptions 테이블 from dog_id. */
export type ActiveSubscription = {
  id: string
  status: 'active' | 'paused' | 'cancelled'
  interval_weeks: number
  coverage_weeks: number
  /** 화식 비율 티어 (30/50/100). 레거시 구독은 null. */
  fresh_ratio: number | null
  next_delivery_date: string | null
  total_deliveries: number
  total_amount: number
  billing_key: string | null
  /** needs_card 카드등록 링크(billing-auth)에 실을 Toss customerKey. 없으면 진입 막힘. */
  billing_customer_key: string | null
  created_at: string
  /** subscriptionState() 판정용 (2026-07-16). '시작 전'을 '일시정지'로 오표시하던 버그 방지. */
  failed_charge_count: number
  requires_billing_key_renewal: boolean
  /** 실제 배송 레시피(정본). dog_formulas(추천)와 달리 gateAvailability·snapBoxRatios 반영된 최종 박스. */
  subscription_items: { product_name: string; quantity: number }[]
}
