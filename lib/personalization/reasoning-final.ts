import { FOOD_LINE_META } from './lines.ts'
import type { FoodLine, Ratio, Reasoning } from './types.ts'

/**
 * 고객에게 나가는 처방 근거 문구(reasoning)의 마지막 정리 — 저장·표시 직전에 한 번.
 *
 * # 왜 (2026-10-01 사장님)
 * "연어라는 멘트 나오면 안 되는 거 알지? 아예 전부 안 나오게 알고리즘 만들어서 삭제해 버려"
 * "오리 알러지인데 왜 오리가 나오는 거야?" — 오리 알레르기견 펀치의 분석 화면 근거에 '연어 → 오리'·
 * '연어 비슷한 단백질 주의'·'위장 민감 · 오리 위주'·'성장기 … 오리·한우 위주'가 떴다. 실제 박스는 흑돼지였다.
 *
 *  ① 판매하지 않는 레시피(연어) 언급 — 어느 룰이 만들었든 통째로 뺀다. 룰마다 막는 것만으론
 *     새 룰·레시피 이름표(FOOD_LINE_META.skin.nameKo='연어')로 다시 샌다. 여기가 마지막 그물.
 *  ② 알레르기로 막힌 레시피 이름이 들어간 조정 문구 — 뺀다('○○ 차단' 알레르기 문구 자체는 남긴다).
 *     임상 룰은 비율을 옮길 때 차단을 모르고 '체중 관리 레시피(치킨) 비중을 올렸어요'를 닭 알레르기견에게도 냈다.
 *  ③ 약속한 레시피(promisedLines)가 최종 박스에 하나도 없는 문구 — 뺀다. 첫 박스 1종 접기·선호 우선이
 *     결과를 바꾸면 "오리 위주"라는 설명만 남는다.
 *
 * 순수 함수 — compute(첫 박스)·firstBox·nextBox(재제안)가 같은 규칙을 쓴다.
 */
export const UNSOLD_RECIPE_WORDS: readonly string[] = ['연어']

export function mentionsUnsoldRecipe(r: Pick<Reasoning, 'trigger' | 'action' | 'chipLabel'>): boolean {
  const text = `${r.trigger ?? ''} ${r.action ?? ''} ${r.chipLabel ?? ''}`
  return UNSOLD_RECIPE_WORDS.some((w) => text.includes(w))
}

/** 조정 문구(action·chipLabel)가 알레르기로 막힌 레시피를 이름으로 말하는가. 알레르기 차단 문구는 제외. */
export function mentionsBlockedRecipe(
  r: Pick<Reasoning, 'action' | 'chipLabel' | 'ruleId'>,
  blocked: ReadonlySet<FoodLine>,
): boolean {
  // 알레르기 차단을 알리는 문구 자체(첫 박스 allergy-*, 재제안 next-allergy-*)는 막힌 이름을 말해야 한다.
  if (blocked.size === 0 || /^(next-)?allergy-/.test(r.ruleId ?? '')) return false
  const text = `${r.action ?? ''} ${r.chipLabel ?? ''}`
  for (const l of blocked) {
    const name = FOOD_LINE_META[l]?.nameKo
    if (name && text.includes(name)) return true
  }
  return false
}

export function finalizeReasoning(
  reasoning: readonly Reasoning[],
  finalRatios?: Partial<Record<FoodLine, Ratio>> | null,
  opts: { blockedLines?: Iterable<FoodLine> } = {},
): Reasoning[] {
  const blocked = new Set(opts.blockedLines ?? [])
  return reasoning.filter((r) => {
    if (mentionsUnsoldRecipe(r)) return false
    if (mentionsBlockedRecipe(r, blocked)) return false
    if (finalRatios && r.promisedLines && r.promisedLines.length > 0) {
      return r.promisedLines.some((l) => (finalRatios[l] ?? 0) > 0)
    }
    return true
  })
}
