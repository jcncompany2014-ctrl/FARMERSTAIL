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
    const fallback = ALL_LINES.find((l) => !blocked.has(l)) ?? 'skin'
    out[fallback] = 1
    return out
  }
  for (const line of ALL_LINES) {
    out[line] = out[line] / total
  }
  return out
}

/** 0.1 단위로 round, 합 1.0 보장. 잔차는 가장 큰 라인이 흡수. */
export function quantize(
  ratios: Record<FoodLine, Ratio>,
): Record<FoodLine, Ratio> {
  const rounded = ALL_LINES.reduce(
    (acc, l) => {
      acc[l] = cleanFloat(Math.round(ratios[l] / QUANTIZE_STEP) * QUANTIZE_STEP)
      return acc
    },
    {} as Record<FoodLine, Ratio>,
  )
  const sum = ALL_LINES.reduce((s, l) => s + rounded[l], 0)
  const diff = 1 - sum
  if (Math.abs(diff) > EPS) {
    // 잔차 흡수 대상: 0% 가 아닌 가장 큰 라인. 결정적 — ALL_LINES 의 순서가 고정.
    const target =
      ALL_LINES.reduce<FoodLine | null>(
        (best, l) =>
          rounded[l] > 0 && (best === null || rounded[l] > rounded[best])
            ? l
            : best,
        null,
      ) ?? 'basic'
    rounded[target] = Math.max(0, cleanFloat(rounded[target] + diff))
  }
  return rounded
}

/** normalize → quantize 한 번에. 가장 흔한 호출 경로. */
export function quantizeAndNormalize(
  ratios: Record<FoodLine, Ratio>,
  blocked: Set<FoodLine>,
): Record<FoodLine, Ratio> {
  return quantize(normalize(ratios, blocked))
}
