/**
 * Farmer's Tail — SKU 사이즈 자동 매핑 (Tier S F3-1, 2026-05-20)
 *
 * 견체 일일 g → 7종 SKU 사이즈 중 가장 가까운 1팩 자동 추천.
 * 350g 초과 (대형견 시장 5%) 는 콤보 2팩 자동 제안.
 *
 * # 7종 lineup 채택 근거
 * 100마리 가상 시뮬레이션 (한국 펫푸드 시장 체중 분포 + FEDIAF 활동도 분포)
 * 결과: 7종(70/100/130/170/220/280/350)이 ±10% 안전마진 내 견체 약 80% cover.
 * Mix feeding 정책 채택 후 (대형견 = 사료와 mix) 350g 이상은 SKU 운영 X.
 *
 * # ±10% 안전 한도
 * 수의영양학 일반 원칙: 일일 칼로리 ±10% 이내 = BCS 유지 가능. 그 이상 시
 * 장기 (≥ 6개월) 누적 비만 또는 체중 감소 위험.
 *
 * # 사용처
 * - lib/feeding-plan.ts (통합 계산기)
 * - app/(main)/dogs/[id]/analysis/page.tsx (분석 결과 카드)
 * - app/(main)/subscribe/* (정기구독 신청 시 자동 사이즈 추천)
 */

/** 7종 SKU 사이즈 lineup (g) — 350g 초과는 콤보 처리 */
export const SKU_SIZES_G = [70, 100, 130, 170, 220, 280, 350] as const

export type SkuSizeG = (typeof SKU_SIZES_G)[number]

export interface SkuMatch {
  /** 추천 1팩 사이즈 (g). 대형견은 콤보의 첫 번째 사이즈. */
  recommended_sku_g: SkuSizeG
  /** 콤보 보완 사이즈 (g). 단일 팩이면 null. */
  combo_sku_g: SkuSizeG | null
  /** 견체 일일 권장 g (정밀치) */
  daily_target_g: number
  /** 1팩(또는 콤보) 공급량 g */
  pack_supply_g: number
  /** 권장 대비 오차 % (양수=과식, 음수=부족). ±10% 이내 = 안전 */
  deviation_pct: number
  /** 매 끼 권장 g (2회 가정, 절반씩) */
  per_meal_g: number
  /** 매핑이 ±10% 안전 한도 초과면 true */
  is_outside_safe_range: boolean
}

/**
 * 견체 일일 g → 가장 가까운 SKU 사이즈 자동 매핑.
 *
 * 350g 초과 시:
 *   - 1팩 350 + 작은 사이즈 콤보 자동 선택
 *   - 오차 가장 작은 조합 우선
 *
 * @param dailyTargetG 견체 일일 권장 g (calculateNutrition.feedG 등)
 */
export function matchSku(dailyTargetG: number): SkuMatch {
  // 350g 이하 — 단일 SKU 매핑
  if (dailyTargetG <= 350) {
    const best = SKU_SIZES_G.reduce((a, b) =>
      Math.abs(a - dailyTargetG) < Math.abs(b - dailyTargetG) ? a : b,
    )
    const deviation = ((best - dailyTargetG) / dailyTargetG) * 100
    return {
      recommended_sku_g: best,
      combo_sku_g: null,
      daily_target_g: Math.round(dailyTargetG),
      pack_supply_g: best,
      deviation_pct: parseFloat(deviation.toFixed(1)),
      per_meal_g: Math.round(dailyTargetG / 2),
      is_outside_safe_range: Math.abs(deviation) > 10,
    }
  }

  // 350g 초과 — 콤보 매핑 (350g 기준 + 보완 사이즈)
  // 모든 (큰사이즈, 보완사이즈) 조합 중 오차 가장 작은 것 선택.
  let bestCombo: { a: SkuSizeG; b: SkuSizeG; total: number; err: number } | null =
    null
  for (const a of SKU_SIZES_G) {
    for (const b of SKU_SIZES_G) {
      const total = a + b
      const err = Math.abs(total - dailyTargetG)
      if (!bestCombo || err < bestCombo.err) {
        bestCombo = { a, b, total, err }
      }
    }
  }

  // 큰 사이즈를 a, 작은 사이즈를 b로 정렬 (UI 일관)
  const a = bestCombo!.a >= bestCombo!.b ? bestCombo!.a : bestCombo!.b
  const b = bestCombo!.a >= bestCombo!.b ? bestCombo!.b : bestCombo!.a
  const total = a + b
  const deviation = ((total - dailyTargetG) / dailyTargetG) * 100

  return {
    recommended_sku_g: a,
    combo_sku_g: b,
    daily_target_g: Math.round(dailyTargetG),
    pack_supply_g: total,
    deviation_pct: parseFloat(deviation.toFixed(1)),
    per_meal_g: Math.round(dailyTargetG / 2),
    is_outside_safe_range: Math.abs(deviation) > 10,
  }
}

/**
 * 견체 일일 g + 화식 비율(mix_ratio 0.30~1.00) → 화식 부분만 SKU 매핑.
 *
 * mix feeding 정책: 화식이 일일 권장량의 30~100% 만 cover.
 * 나머지는 사용자가 보유한 사료 (보호자 별도 운영).
 *
 * @param dailyTargetG 견체 일일 총 권장 g
 * @param mixRatio 화식 비율 (0.30~1.00)
 */
export function matchSkuForMix(
  dailyTargetG: number,
  mixRatio: number,
): SkuMatch {
  const hwasikG = dailyTargetG * mixRatio
  return matchSku(hwasikG)
}
