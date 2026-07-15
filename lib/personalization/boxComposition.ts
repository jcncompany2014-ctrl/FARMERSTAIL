/**
 * boxComposition.ts — 박스 구성 스냅 (사장님 2026-07-13).
 *
 * 규칙: **박스는 SKU 최대 2종.** 1종이면 100%, 2종이면 50:50. 그 이상은 없음.
 * 임상 알고리즘(firstBox/nextBox)은 최대 5종·임의 0.1단위 비율을 낼 수 있는데,
 * 그건 "왜 이 단백질인가"의 근거(reasoning)로 그대로 두고, **실제 배송·표시되는
 * 박스**만 이 헬퍼로 ≤2종으로 매핑한다(분석 카드 boxItems + 주문 라인 단일 소스).
 *
 * 스냅 로직:
 *  - non-zero 라인을 비율 내림차순 정렬.
 *  - 0종 → 빈 박스, 1종 → 그 라인 100%.
 *  - 2종+ → 상위 2종. 단 2번째가 SECOND_LINE_MIN(20%) 미만이면 소량이라 별도
 *    SKU 를 내지 않고 최상위 1종 100% (예: 닭90/소10 → 닭 100%).
 *  - 그 외 → 상위 2종 50:50 (예: 오리50/연어20/돼지30 → 오리50/돼지50).
 *
 * ⚠️ 2종 50:50 제약상 임상 미세비율(예: 췌장염 저지방 60:40)은 그대로 못 담김 —
 * reasoning 이 근거를 설명하고, 필요 시 보호자가 비율 조정(AdjustSheet)으로 미세.
 */
import { ALL_LINES } from './lines.ts'
import type { FoodLine, Ratio } from './types.ts'

/** 2번째 라인이 이 비율 미만이면 단종(100%)으로 처리. 튜닝 지점. */
export const SECOND_LINE_MIN = 0.2

/**
 * 첫 박스 단일화 — **cycle 1 은 무조건 1종 100%** (사장님 확정 2026-07-15).
 *
 * # 왜
 * "강아지는 초반에 단일 단백질로 먹어야 그게 잘 맞는지, 알레르기가 있는지 없는지
 * 잘 알 수 있다" — 맞는 말이다. 새 음식에서 무른 변·가려움 같은 반응이 났을 때
 * 단백질이 둘이면 어느 쪽이 원인인지 좁힐 수 없다. 수의 임상의 제거식이
 * (elimination diet)가 한 가지 단백질로 시작하는 것과 같은 이유다.
 *
 * (단, 이건 '관찰을 쉽게 하는 것'이지 알레르기 **진단**이 아니다 — 진단은 8~12주
 *  엄격한 제거식이가 필요하다. 고객 문구도 거기까지 말하지 않는다.)
 *
 * # 무엇을 안 바꾸나
 *  · **추천만** 단일이다. 보호자가 레시피 시트에서 직접 2종을 고르는 건 그대로.
 *  · 알레르기 차단 등 임상 룰은 이미 반영된 뒤라, 여기선 남은 것 중 1위만 남긴다.
 *  · cycle 2+ 는 손대지 않는다 — 첫 박스로 적응을 확인한 뒤엔 섞어도 된다.
 */
export function collapseToSingle(
  lineRatios: Record<FoodLine, Ratio>,
): Record<FoodLine, Ratio> {
  const out: Record<FoodLine, Ratio> = {
    basic: 0,
    weight: 0,
    skin: 0,
    premium: 0,
    joint: 0,
  }
  const top = ALL_LINES.map((line) => ({ line, ratio: lineRatios[line] ?? 0 }))
    .filter((x) => x.ratio > 0)
    .sort((a, b) => b.ratio - a.ratio)[0]
  if (top) out[top.line] = 1
  return out
}

export function snapBoxLines(
  lineRatios: Record<FoodLine, Ratio>,
): Array<{ line: FoodLine; ratio: Ratio }> {
  const nonZero = ALL_LINES.map((line) => ({ line, ratio: lineRatios[line] ?? 0 }))
    .filter((x) => x.ratio > 0)
    .sort((a, b) => b.ratio - a.ratio)

  const [first, second] = nonZero
  if (!first) return []
  if (!second || second.ratio < SECOND_LINE_MIN) {
    return [{ line: first.line, ratio: 1 }]
  }
  return [
    { line: first.line, ratio: 0.5 },
    { line: second.line, ratio: 0.5 },
  ]
}

/** snapBoxLines 를 Record 형태로 (order 루프처럼 line→ratio 조회용). */
export function snapBoxRatios(
  lineRatios: Record<FoodLine, Ratio>,
): Record<FoodLine, Ratio> {
  const out: Record<FoodLine, Ratio> = {
    basic: 0,
    weight: 0,
    skin: 0,
    premium: 0,
    joint: 0,
  }
  for (const { line, ratio } of snapBoxLines(lineRatios)) out[line] = ratio
  return out
}
