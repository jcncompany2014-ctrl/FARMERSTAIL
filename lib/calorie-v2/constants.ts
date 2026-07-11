/**
 * 칼로리 알고리즘 v2 — 상수 (docs/CALORIE_ALGORITHM_SPEC_V2.md §3).
 *
 * 감산 지배형: BASE 를 한국 모달(중성화·실내·저활동)로 낮게 깔고 대부분 빼고,
 * 가산은 증거 게이트. 실측 데이터 축적 시 BASE_ADULT(1.4→1.3?)·각 Δ 재튜닝.
 */
export const CAL = {
  // --- RER (지수식만 — 선형식 30×BW+70 은 초소형견 과대추정으로 폐기) ---
  RER_COEF: 70,
  RER_EXP: 0.75,

  // --- 성견 계수 사다리 (감산 지배형) ---
  // BASE_ADULT = 중성화+실내+저활동 성견 = 한국 모달. AAHA 중성화 성견(1.4~1.6)의
  // 하단, 비활동/비만경향(1.0~1.2)의 상단이 만나는 지점의 의도적 중간값.
  BASE_ADULT: 1.4,

  // 감산
  D_AGE_MATURE: -0.1, // 7~9세
  D_AGE_SENIOR: -0.2, // 10세+
  D_EASY_KEEPER: -0.1, // 쉽게 찌는 체질 (설문 OR 견종 OB 플래그 → 1회만)
  D_VERY_INACTIVE: -0.1,

  // 가산 (증거 게이트)
  A_INTACT: 0.2,
  A_UNDERWEIGHT: 0.2, // BCS ≤ 3
  A_VIGOROUS_SELF: 0.1, // 자가보고 '활발'은 최대 +0.1
  A_VIGOROUS_OBJECTIVE_MIN: 0.2,
  A_VIGOROUS_OBJECTIVE_MAX: 0.4, // 측정된 운동/사역 증거 있을 때만
  A_OUTDOOR_COLD: 0.15, // 진짜 실외 거주 + 한랭

  FACTOR_FLOOR_MAINTENANCE: 1.0,
  FACTOR_CEIL_ADULT: 2.0,

  // --- 감량 분기 ---
  WEIGHT_LOSS_FACTOR_START: 1.0,
  WEIGHT_LOSS_FACTOR_FLOOR: 0.8,
  LOSS_RATE_MIN_PCT_WK: 0.5,
  LOSS_RATE_MAX_PCT_WK: 2.0,

  // --- 성장(자견) 분기 : NRC 2006 정확식 ---
  // ⚠️ 앞 상수 130 (70 사용 시 약 46% 과소급여 — 스펙 v1 오류의 교훈).
  GROWTH_ME_COEF: 130,
  GROWTH_P_MULT: 3.2,
  GROWTH_P_DECAY: 0.87,
  GROWTH_P_OFFSET: 0.1,
  GROWTH_MULT_UNDER_4MO: 3.0, // 간이 근사(×RER). 정확식과 병기.
  GROWTH_MULT_4MO_TO_ADULT: 2.0,
  GROWTH_TOY_DISCOUNT: 0.85, // 초소형/토이: NRC 과대추정 → ~15% 하향

  // --- 번식(참고 범위 — 계산 없이 수의 라우팅) ---
  PREG_LAST_TRIMESTER_MIN: 1.6,
  PREG_LAST_TRIMESTER_MAX: 2.0,
  LACTATION_MIN: 2.0,
  LACTATION_MAX: 6.0,

  // --- 간식 (10% 룰 — 초과분은 밥에서 더 깎지 않고 경고: 완전식 90%+ 보장) ---
  TREAT_MAX_FRACTION: 0.1,

  // --- 화식 배분 ---
  DEFAULT_HWASIK_SHARE: 0.3,

  // --- 모디파이드 앳워터 (건사료 폴백 전용 — 화식은 실측값만) ---
  ATWATER_PROTEIN: 3.5,
  ATWATER_FAT: 8.5,
  ATWATER_NFE: 3.5,

  // --- BCS → IBW 초과율 (BCS 6/7/8/9 = +10/20/30/40%) ---
  BCS_OVER_PCT: { 6: 0.1, 7: 0.2, 8: 0.3, 9: 0.4 } as Record<number, number>,

  // --- 재측정 피드백 (M10 — 감산 지배형의 필수 짝) ---
  MAINTAIN_TOLERANCE_PCT: 2.0,
  FEEDBACK_STEP_PCT: 0.1,

  // --- 개체차 (개 기준. 50%는 고양이 값 — 혼동 금지) ---
  INDIVIDUAL_VARIANCE_PCT: 30,
} as const
