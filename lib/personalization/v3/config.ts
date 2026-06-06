/**
 * 추천 엔진 v3 — 튜닝 상수 **단일 소스**.
 *
 * 엔진 로직과 분리(외부화)해, 가중치·컷오프·비율을 코드 흐름 안 건드리고
 * 한 곳에서 조정. 추후 admin GUI / DB override 로 승격하기 쉬운 형태.
 *
 * 모든 값은 근거 주석 동반(임의값 금지). 변경 시 engine.test 가 회귀 검증.
 */

/**
 * 레이어 A 튜닝.
 *  - needWeights: 설문 신호 강도. weightGoal·picky 기호성 = 최강 1.0(1차 동인),
 *    activity_high·senior = 0.8, 보조 신호(activity_low/recovery/sensitive)
 *    = 0.5~0.6. maintain 0.6 은 baseline(모든 비-감량/증량 견) — 믹스 트리거
 *    임계 0.7 아래로 둬 균형 기본값(닭)만 고르고 보조 SKU 남발 방지.
 *  - mix: 보조 SKU 는 "주 SKU 가 약하게(<0.6) 커버하는 강한(가중치 ≥0.7) need 를
 *    다른 SKU 가 강하게(≥0.7) 커버"할 때만. 그 외 단일. 70/30 = 주식 지위 유지.
 *  - treat: 간식 칼로리 차감 상한 10%(AAFCO/WSAVA 10% 룰). 빈도→비율 매핑은
 *    nutrition.ts `treatCalorieFraction` 가 SSOT(드리프트 방지) — 여기선 클램프만.
 */
export const LAYER_A_CONFIG = {
  needWeights: {
    weightLoss: 1.0,
    weightGain: 1.0,
    maintain: 0.6,
    activityHigh: 0.8,
    activityLow: 0.6,
    palatabilityPicky: 1.0,
    palatabilityLow: 0.7,
    recoveryLow: 0.6,
    senior: 0.8,
    sensitiveFromAllergy: 0.6,
    sensitiveFromDigestion: 0.5,
  },
  mix: {
    poorCoverage: 0.6,
    strongCoverage: 0.7,
    secondaryNeedMinWeight: 0.7,
    primaryRatio: 0.7,
    secondaryRatio: 0.3,
  },
  treat: {
    /** 간식 차감 비율 하한·상한 (10% 룰). */
    minFraction: 0,
    maxFraction: 0.1,
  },
} as const

/**
 * 레이어 B 튜닝.
 *  - concern→source 매핑은 catalog FUNCTIONAL_SOURCES.targetConcern 에서 파생
 *    (데이터 주도 — skuMap.deriveAvailableLines 패턴). 여기엔 노출 우선순위만.
 *  - 우려가 여럿이면 이 순서로 정렬해 표시(안전·근거 강한 순).
 */
export const LAYER_B_CONFIG = {
  /** 다중 우려 표시 우선순위 (앞일수록 먼저). */
  concernPriority: ['digestion', 'skin', 'joint', 'immune'] as const,
} as const
