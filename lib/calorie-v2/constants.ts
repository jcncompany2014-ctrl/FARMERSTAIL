/**
 * 칼로리 알고리즘 v2 — 상수 (docs/CALORIE_ALGORITHM_SPEC_V2.md §3).
 *
 * 감산 지배형: BASE 를 한국 모달(중성화·실내·저활동)로 낮게 깔고 대부분 빼고,
 * 가산은 증거 게이트. 실측 데이터 축적 시 BASE_ADULT(1.4→1.3?)·각 Δ 재튜닝.
 *
 * ⚠️ **여기 있는 값만 프로덕션 계산에 실제로 쓰인다** (engine.ts 의 살아있는
 * 5개 부품 경유). 2026-07-17 창고 정리에서 상위 파이프라인이 삭제되면서,
 * 그것만 쓰던 상수 20개(RER 계수·성장식·앳워터·임신/수유 범위·간식 캡·
 * 화식 배분 기본값 등)도 함께 제거했다 — **안 쓰이는데 남아 있으면 "여기를
 * 고치면 프로덕션이 바뀐다"는 오독을 부르기 때문.** 그 숫자들은 두 곳에 산다:
 *   · 설계 근거·전체 스펙 → docs/CALORIE_ALGORITHM_SPEC_V2.md §3
 *   · 실제 가동 구현      → lib/nutrition.ts (RER 70×W^0.75·성장식 130·임신/수유
 *                          NRC 배수·간식 10% 룰 — 리터럴 또는 nutrition/guidelines.ts)
 */
export const CAL = {
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
  A_VIGOROUS_OBJECTIVE_MIN: 0.2, // 측정된 운동/사역 증거 있을 때만
  A_OUTDOOR_COLD: 0.15, // 진짜 실외 거주 + 한랭

  FACTOR_FLOOR_MAINTENANCE: 1.0,
  FACTOR_CEIL_ADULT: 2.0,

  // --- 감량 속도 판정 (M10 재측정 루프에서 사용) ---
  LOSS_RATE_MIN_PCT_WK: 0.5,
  LOSS_RATE_MAX_PCT_WK: 2.0,

  // --- BCS → IBW 초과율 (BCS 6/7/8/9 = +10/20/30/40%) ---
  BCS_OVER_PCT: { 6: 0.1, 7: 0.2, 8: 0.3, 9: 0.4 } as Record<number, number>,

  // --- 재측정 피드백 (M10 — 감산 지배형의 필수 짝) ---
  MAINTAIN_TOLERANCE_PCT: 2.0,
  FEEDBACK_STEP_PCT: 0.1,
} as const
