import { ALL_LINES, FOOD_LINE_META } from './lines.ts'
import type { FoodLine, Ratio, Reasoning } from './types.ts'

/**
 * 고객에게 나가는 처방 근거 문구(reasoning)의 마지막 정리 — 저장·표시 직전에 한 번.
 *
 * # 왜 (2026-10-01 사장님)
 * "연어라는 멘트 나오면 안 되는 거 알지? 아예 전부 안 나오게 알고리즘 만들어서 삭제해 버려"
 * "오리 알러지인데 왜 오리가 나오는 거야?" — 오리 알레르기견 펀치의 분석 화면 근거에 '연어 → 오리'·
 * '연어 비슷한 단백질 주의'·'위장 민감 · 오리 위주'·'성장기 … 오리·한우 위주'가 떴다. 실제 박스는 흑돼지였다.
 * 같은 날 피카(오리 100%) 근거에 '맞춤 베이스: 치킨'이 떴다 — "박스에 없는 레시피를 말하는 칩은 지워.
 * 앞으로도 이런 헷갈리는 일 없게". 임상 룰은 여러 레시피 비율을 옮기며 설명을 남기는데, 첫 박스는 그 뒤에
 * 한 가지로 접힌다(선호 우선 포함). 그래서 "치킨 비중을 올렸어요"가 오리 박스에 남았다(조합 9,261개 중 64종).
 *
 *  ① 판매하지 않는 레시피(연어) 언급 — 어느 룰이 만들었든 통째로 뺀다.
 *  ② 알레르기로 막힌 레시피 이름이 들어간 조정 문구 — 뺀다('○○ 차단' 알레르기 문구·'뺐어요' 문구는 남긴다).
 *  ③ 최종 박스 기준(finalRatios 가 있을 때):
 *     · "치킨 · 흑돼지"처럼 레시피를 나열한 부분은 박스에 있는 이름만 남긴다.
 *     · 약속한 레시피(promisedLines)가 박스에 하나도 없으면 — 안내만 남긴 문구(withoutRecipe)가 있으면 그걸로,
 *       없으면 문구를 뺀다(당뇨·심장·응급 저체중의 안전 안내가 레시피 문장과 함께 사라지지 않게).
 *     · 판매 레시피 이름은 박스에 있거나, 그 문구가 '뺐다'고 말하는 것(excludedLines)이어야 한다.
 *       '뺐다'는 레시피가 박스에 들어가 있으면 그것도 거짓이라 뺀다.
 *
 * 순수 함수 — compute(첫 박스)·firstBox·nextBox(재제안)가 같은 규칙을 쓴다. 실행 스윕은 reasonCopy.test.ts.
 */
export const UNSOLD_RECIPE_WORDS: readonly string[] = ['연어']

/** 판매 중인 레시피 라인 — 문구에서 레시피 이름을 찾는 기준. */
const SOLD_LINES: readonly FoodLine[] = ALL_LINES.filter(
  (l) => !UNSOLD_RECIPE_WORDS.includes(FOOD_LINE_META[l].nameKo),
)
const nameOf = (l: FoodLine) => FOOD_LINE_META[l].nameKo
const NAME_ALT = SOLD_LINES.map(nameOf).join('|')
/** 레시피 이름 나열 — "치킨 · 흑돼지" · "오리·한우" · "오리, 치킨". */
const NAME_RUN = new RegExp(`(?:${NAME_ALT})(?:\\s*[·,]\\s*(?:${NAME_ALT}))+`, 'g')
/** 알레르기 차단을 알리는 문구 — 막힌 레시피 이름을 말해야 한다(첫 박스 allergy-*, 재제안 next-allergy-*). */
const ALLERGY_RULE = /^(next-)?allergy-/

export function mentionsUnsoldRecipe(r: Pick<Reasoning, 'trigger' | 'action' | 'chipLabel'>): boolean {
  const text = `${r.trigger ?? ''} ${r.action ?? ''} ${r.chipLabel ?? ''}`
  return UNSOLD_RECIPE_WORDS.some((w) => text.includes(w))
}

/** 문구(action·chipLabel)가 이름으로 말하는 판매 레시피 라인. */
export function namedSoldLines(r: Pick<Reasoning, 'action' | 'chipLabel'>): FoodLine[] {
  const text = `${r.action ?? ''} ${r.chipLabel ?? ''}`
  return SOLD_LINES.filter((l) => text.includes(nameOf(l)))
}

/** 조정 문구(action·chipLabel)가 알레르기로 막힌 레시피를 이름으로 말하는가. 알레르기 차단·'뺐어요' 문구는 제외. */
export function mentionsBlockedRecipe(
  r: Pick<Reasoning, 'action' | 'chipLabel' | 'ruleId'> & Pick<Partial<Reasoning>, 'excludedLines'>,
  blocked: ReadonlySet<FoodLine>,
): boolean {
  if (blocked.size === 0 || ALLERGY_RULE.test(r.ruleId ?? '')) return false
  const excluded = new Set(r.excludedLines ?? [])
  const text = `${r.action ?? ''} ${r.chipLabel ?? ''}`
  for (const l of blocked) {
    if (excluded.has(l)) continue
    const name = FOOD_LINE_META[l]?.nameKo
    if (name && text.includes(name)) return true
  }
  return false
}

/** 나열된 레시피 이름 중 박스에 있는 것만 남긴다. 하나도 없으면 그대로 둔다(아래 검사가 판단). */
function narrowRuns(text: string, inBox: ReadonlySet<FoodLine>): string {
  return text.replace(NAME_RUN, (run) => {
    const sep = run.includes(' · ') ? ' · ' : run.includes(', ') ? ', ' : '·'
    const kept = run
      .split(/\s*[·,]\s*/)
      .filter((n) => SOLD_LINES.some((l) => nameOf(l) === n && inBox.has(l)))
    return kept.length > 0 ? kept.join(sep) : run
  })
}

function fits(
  c: Reasoning,
  inBox: ReadonlySet<FoodLine> | null,
  blocked: ReadonlySet<FoodLine>,
): boolean {
  if (mentionsUnsoldRecipe(c)) return false
  if (mentionsBlockedRecipe(c, blocked)) return false
  if (!inBox || ALLERGY_RULE.test(c.ruleId ?? '')) return true
  if (c.promisedLines && c.promisedLines.length > 0 && !c.promisedLines.some((l) => inBox.has(l))) return false
  const excluded = new Set(c.excludedLines ?? [])
  for (const l of excluded) if (inBox.has(l)) return false
  return namedSoldLines(c).every((l) => inBox.has(l) || excluded.has(l))
}

export function finalizeReasoning(
  reasoning: readonly Reasoning[],
  finalRatios?: Partial<Record<FoodLine, Ratio>> | null,
  opts: { blockedLines?: Iterable<FoodLine> } = {},
): Reasoning[] {
  const blocked = new Set(opts.blockedLines ?? [])
  const inBox = finalRatios ? new Set(ALL_LINES.filter((l) => (finalRatios[l] ?? 0) > 0)) : null
  const out: Reasoning[] = []
  for (const r of reasoning) {
    // '뺐어요' 문구·알레르기 문구의 이름 나열은 뺀 목록이다 — 박스 기준으로 줄이면 안 된다.
    const narrow = inBox && !ALLERGY_RULE.test(r.ruleId ?? '') && !(r.excludedLines && r.excludedLines.length > 0)
    const c: Reasoning = narrow
      ? { ...r, action: narrowRuns(r.action, inBox), chipLabel: narrowRuns(r.chipLabel, inBox) }
      : r
    if (fits(c, inBox, blocked)) {
      out.push(c)
      continue
    }
    if (r.withoutRecipe) {
      const { withoutRecipe, promisedLines: _promised, ...rest } = r
      const plain: Reasoning = {
        ...rest,
        action: withoutRecipe.action,
        chipLabel: withoutRecipe.chipLabel ?? r.chipLabel,
      }
      if (fits(plain, inBox, blocked)) out.push(plain)
    }
  }
  return out
}
