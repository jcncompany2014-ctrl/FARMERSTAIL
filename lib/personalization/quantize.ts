/**
 * quantize.ts — 비율 정규화 + 0.1 단위 양자화 헬퍼.
 *
 * firstBox / nextBox 가 동일한 로직을 중복 보유하던 걸 단일 진실 소스로 추출.
 * 모든 lineRatios 출력은 합이 정확히 1.0 (within EPS) 이고 모든 값이 0.1 의
 * 정수배 (0, 0.1, 0.2, ..., 1.0) 임을 보장.
 *
 * # 함수
 *  - normalize(r, blocked) — blocked 라인은 0, 나머지 정규화. 합 1.0 (분수).
 *  - quantize(r) — 0.1 단위 round. 잔차는 가장 큰 라인이 흡수. 합 1.0.
 *  - quantizeAndNormalize(r, blocked) — 위 둘의 조합 (가장 흔한 호출 경로).
 *
 * # Float precision 가드
 *  EPS = 1e-9. round(x * 10) / 10 으로 finalize 해 0.30000000000000004 같은
 *  이진부동소수 표현 깨끗이 떨어내고, abs(diff) > EPS 일 때만 잔차 흡수.
 */

import { ALL_LINES } from './lines.ts'
import type { FoodLine, Ratio } from './types.ts'

const QUANTIZE_STEP = 0.1
const EPS = 1e-9

/** 0.30000000000000004 → 0.3 식으로 부동소수 clean. */
function cleanFloat(x: number): number {
  return Math.round(x * 10) / 10
}

/** blocked 라인은 0 으로 강제하고 나머지를 합 1.0 으로 정규화. */
export function normalize(
  ratios: Record<FoodLine, Ratio>,
  blocked: Set<FoodLine>,
): Record<FoodLine, Ratio> {
  const out: Record<FoodLine, Ratio> = { ...ratios }
  for (const line of ALL_LINES) {
    if (blocked.has(line)) out[line] = 0
  }
  const total = ALL_LINES.reduce((s, l) => s + out[l], 0)
  if (total <= 0) {
    // 모든 라인이 0 — 알레르기 다수 + 룰 충돌. fallback: blocked 아닌 첫 라인 100%.
    // 전부 차단된 극단(고객 UI 상 오리=basic 은 차단 불가라 도달 불가)에서도
    // 최후 fallback 은 **basic(오리)** — 항상 판매되는 노블 단백질. 이전엔
    // 'skin'(연어)였는데 연어는 deferred·미판매라 빈 박스가 됐다(2026-07-24 퍼저).
    const fallback = ALL_LINES.find((l) => !blocked.has(l)) ?? 'basic'
    out[fallback] = 1
    return out
  }
  for (const line of ALL_LINES) {
    out[line] = out[line] / total
  }
  return out
}

/**
 * 0.1 단위로 round, 합 1.0 보장. Hamilton (largest-remainder) 방식 (audit #9).
 *
 * 이전: 모든 라인을 단순 round → diff 를 1개 라인이 흡수. 잔차 |diff| 가
 * 큰 케이스 (5개 라인 모두 0.123 → 모두 0.1 round → 합 0.5, diff 0.5) 에서
 * 1개 라인에 몰아넣기 부적절. 또한 음수 diff 흡수 시 target 이 0 으로 클램프
 * 되어 합이 1.0 미만으로 다시 어긋남.
 *
 * Hamilton:
 *   1) 각 라인을 floor(x*10) 으로 quota 확정
 *   2) 남은 잔차 = 10 - sum(quotas) 만큼 "원본 - floor" 값이 큰 라인부터
 *      차례로 +0.1 분배
 *   3) blocked 라인은 quantize 단계 이전 normalize 가 이미 0 — 여기선 그대로
 *
 * 결과: 항상 합 = 1.0 정확, 결정성, 음수 클램프 위험 없음.
 */
export function quantize(
  ratios: Record<FoodLine, Ratio>,
): Record<FoodLine, Ratio> {
  // 1) floor (정수 quota): 각 라인의 0.1 단위 내림.
  const SCALE = 1 / QUANTIZE_STEP // 10
  const quotas: Record<FoodLine, number> = {} as Record<FoodLine, number>
  const remainders: Array<{ line: FoodLine; remainder: number }> = []
  let totalQuota = 0
  for (const line of ALL_LINES) {
    const scaled = ratios[line] * SCALE
    const floor = Math.floor(scaled)
    quotas[line] = floor
    remainders.push({ line, remainder: scaled - floor })
    totalQuota += floor
  }

  // 2) 부족분 = 10 - totalQuota. remainder 큰 라인부터 +1.
  let deficit = Math.round(SCALE - totalQuota) // 보통 0~9
  if (deficit > 0) {
    // remainder 내림차순 정렬 — 동률 시 ALL_LINES 순서 유지 (결정성).
    remainders.sort((a, b) => {
      if (Math.abs(a.remainder - b.remainder) < EPS) {
        return ALL_LINES.indexOf(a.line) - ALL_LINES.indexOf(b.line)
      }
      return b.remainder - a.remainder
    })
    for (const { line } of remainders) {
      if (deficit === 0) break
      quotas[line] += 1
      deficit -= 1
    }
  }

  // 3) 0.1 단위로 변환.
  const out = {} as Record<FoodLine, Ratio>
  for (const line of ALL_LINES) {
    out[line] = cleanFloat(quotas[line] * QUANTIZE_STEP)
  }
  return out
}

/** normalize → quantize 한 번에. 가장 흔한 호출 경로. */
export function quantizeAndNormalize(
  ratios: Record<FoodLine, Ratio>,
  blocked: Set<FoodLine>,
): Record<FoodLine, Ratio> {
  return quantize(normalize(ratios, blocked))
}
