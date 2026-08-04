/**
 * 저장된 `dog_formulas.daily_grams` 를 **믿지 않는다** — 읽을 때 다시 센다.
 * (2026-08-03, 사장님: "재계산해서 덮어 / 옛 칼로리 밀도는 이제 없는 거야")
 *
 * # 무슨 일이 있었나
 * 앱 대시보드는 푸린이에게 "오늘 화식 **160g**" 이라고 말하는데, 주문 화면은
 * 같은 처방으로 **142g** 을 계산했다. 같은 daily_kcal(184)에서 나온 두 숫자다:
 *     184 ÷ 160 = 1.15 kcal/g   ← 저장될 때 쓰인 옛 밀도
 *     184 ÷ 142 = 1.30 kcal/g   ← 현행 v4.0(닭 130/100g)
 * 저장된 행이 2026-07-15 에 만들어졌고, 밀도 상수가 v4.0 으로 고쳐진 건
 * 2026-07-24 였다. **코드는 고쳐졌지만 이미 저장된 숫자는 그대로 남았다.**
 *
 * # 왜 상수만 고쳐선 안 됐나
 * `daily_grams` 는 `daily_kcal + lineRatios` 에서 **유도되는 값**인데 DB 에
 * 따로 저장된다. 유도값을 저장하면 원본이 바뀔 때마다 갈라진다 — 레시피 kcal 을
 * 다시 손보면(사장님 v4.0 실측치 반영 예정) 같은 일이 또 난다.
 * 그래서 화면은 저장값을 읽지 않고 **여기서 다시 센다.** 저장 칸은 남겨 두되
 * (어드민·이력·백필용) 고객이 보는 숫자의 근거는 언제나 kcal + 라인 비율이다.
 *
 * 계산은 `dailyGramsFromMix` 하나 — 주문 화면·피킹 리스트가 쓰는 그 함수다.
 */

import { dailyGramsFromMix } from './lines.ts'
import type { FoodLine, Ratio } from './types.ts'

/**
 * 처방 한 건의 하루 급여량(g, 100% 화식 기준).
 *
 * @returns 계산 불가(라인 비율이 비었거나 kcal 이 0 이하)면 `null` —
 *   호출부는 그때 '--' 를 보여야지 저장값으로 되돌아가면 안 된다.
 *   되돌아가는 순간 이 파일이 막으려던 옛 숫자가 다시 나온다.
 */
export function dailyGramsOf(row: {
  daily_kcal: number | null
  formula: { lineRatios: Record<string, number> } | null
}): number | null {
  const kcal = row.daily_kcal
  const ratios = row.formula?.lineRatios
  if (!kcal || !(kcal > 0) || !ratios) return null
  const g = dailyGramsFromMix(ratios as Record<FoodLine, Ratio>, kcal)
  return g > 0 ? g : null
}
