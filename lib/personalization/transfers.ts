/**
 * transfers.ts — 라인 mass 이동 헬퍼.
 *
 * 기존 chronic / BCS 룰 패턴:
 *   ratios = { ...ratios, joint: 0.3, basic: Math.max(0, ratios.basic - 0.3 + before) }
 *
 * 문제:
 *  · basic 가 (0.3 - before) 보다 적으면 Math.max(0, ...) 가 클램프 → mass leak
 *  · normalize 가 살리지만 chip 의 "→ 30%" 가 final ratio 와 다를 수 있음
 *  · chip 텍스트가 거짓말 가능 (audit C-1, C-5)
 *
 * 해결 — `transferBetween(from, to, amount)` 헬퍼:
 *  · from 라인의 가용량을 측정 후 그 만큼만 이동
 *  · transferred 반환 → 호출자가 chip text 에 actual 사용
 *  · sum 보존 보장
 *
 * 여러 라인에서 가져와야 할 때 — `transferToTarget` 우선순위 fallback.
 */

import type { FoodLine, Ratio } from './types.ts'

/**
 * `from` 라인에서 `to` 라인으로 amount 만큼 이동. from 가용량보다 amount 가
 * 많으면 가용량만 이동. transferred 반환으로 호출자가 actual amount 측정.
 */
export function transferBetween(
  ratios: Record<FoodLine, Ratio>,
  from: FoodLine,
  to: FoodLine,
  amount: number,
): { ratios: Record<FoodLine, Ratio>; transferred: number } {
  if (amount <= 0 || from === to) return { ratios, transferred: 0 }
  const available = ratios[from]
  const actual = Math.min(amount, available)
  if (actual <= 0) return { ratios, transferred: 0 }
  return {
    ratios: {
      ...ratios,
      [from]: ratios[from] - actual,
      [to]: ratios[to] + actual,
    },
    transferred: actual,
  }
}

/**
 * `to` 라인을 target 비율까지 가산. donors 우선순위 순서로 mass 차감.
 * 실제 도달 비율 (가용량 부족 시 < target) 반환.
 *
 * 예: chronic-arthritis 가 Joint 0.3 으로 늘리려는데, basic 0.05 만 남으면
 *     basic 0.05 + skin 일부 + premium 일부 식으로 fallback.
 */
export function transferToTarget(
  ratios: Record<FoodLine, Ratio>,
  to: FoodLine,
  target: number,
  donors: FoodLine[],
): { ratios: Record<FoodLine, Ratio>; finalValue: number } {
  if (ratios[to] >= target) return { ratios, finalValue: ratios[to] }
  let need = target - ratios[to]
  let cur = ratios
  for (const donor of donors) {
    if (need <= 1e-9) break
    const { ratios: next, transferred } = transferBetween(cur, donor, to, need)
    cur = next
    need -= transferred
  }
  return { ratios: cur, finalValue: cur[to] }
}
