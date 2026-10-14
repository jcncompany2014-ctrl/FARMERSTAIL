/**
 * 어드민 알레르기 수정 — 설문은 기록이라 덮어쓰지 않고 '관리자 수정' 새 설문 행을 남긴다(2026-10-14 C5, 규칙258).
 *
 * # 왜 새 행인가
 * 알레르기의 정본은 그 강아지의 **최신 설문 행**(surveys.answers.allergies)이다 — 박스 계산(lib/personalization/
 * dogAllergyBlocks)·AI 상담·재제안 크론·고객 설문 화면이 전부 그 한 행을 읽는다(dogs.allergies 는 늘 비어 있다).
 * 옛 행을 고치면 '고객이 언제 무엇이라고 답했나'가 사라진다. 그래서 최신 행을 그대로 복사하고 알레르기만 바꾼 새 행을
 * 넣는다(created_at 이 가장 늦어 최신이 된다). 어떤 행이 관리자 수정인지는 answers.adminEdit 표식으로 남는다 — 고객이
 * 나중에 설문을 다시 하면 그 화면이 answers 를 새로 만들므로 표식이 옮겨 가지 않는다.
 *
 * # 금액은 건드리지 않는다
 * 새 알레르기 때문에 지금 식단에 그 레시피가 있으면 박스 계산이 그 몫을 '담지 못한 몫(held)'으로 남겨 포장 목록이
 * 멈춘다(ship-block 'allergy_check_needed'). 레시피·금액을 바꾸는 건 고객 동의 흐름(재제안 크론 → 금액 변경 동의)만
 * 한다 — 여기서는 그 영향만 미리 보여 준다(allergyEditImpact). 계산은 정본(computeBoxPlan · blockedLinesForAllergies)을
 * 그대로 부른다.
 *
 * 순수 함수. `@/` 값 import 없음 — node 테스트가 그대로 읽는다.
 */
import type { FoodLine } from '../personalization/types.ts'
import { blockedLinesForAllergies } from '../personalization/skuMap.ts'
import { computeBoxPlan, type BoxProduct, type HeldShare } from '../personalization/boxPricing.ts'
import { allergiesFromAnswers } from '../personalization/dogAllergyBlocks.ts'
import { ALLERGY_OPTIONS, normalizeAllergyAnswers } from '../survey/allergy-options.ts'

/** answers.adminEdit — 관리자 수정 행 표식. */
export type AdminAllergyEditMark = {
  at: string
  prevAllergies: string[]
  note?: string
}

export function adminEditMarkOf(answers: unknown): AdminAllergyEditMark | null {
  const m = (answers as { adminEdit?: unknown } | null)?.adminEdit
  if (!m || typeof m !== 'object') return null
  const at = (m as { at?: unknown }).at
  return typeof at === 'string' ? (m as AdminAllergyEditMark) : null
}

/**
 * 고를 수 있는 값 — 지금 보기(ALLERGY_OPTIONS) + 그 강아지 설문에 이미 있던 값(옛 라벨·뺀 보기·모르는 값).
 * 이미 있던 값을 버리면 기록이 조용히 사라진다(lib/survey/allergy-options normalizeAllergyAnswers 와 같은 원칙).
 */
export function validateNextAllergies(
  next: readonly string[],
  prev: readonly string[],
): { ok: true; allergies: string[] } | { ok: false; invalid: string[] } {
  const normalized = normalizeAllergyAnswers(next.map((v) => String(v).trim()).filter(Boolean))
  const allowed = new Set([...ALLERGY_OPTIONS, ...normalizeAllergyAnswers(prev), ...prev])
  const invalid = normalized.filter((v) => !allowed.has(v))
  if (invalid.length > 0) return { ok: false, invalid }
  return { ok: true, allergies: normalized }
}

export function sameAllergies(a: readonly string[], b: readonly string[]): boolean {
  const sa = new Set(normalizeAllergyAnswers(a))
  const sb = new Set(normalizeAllergyAnswers(b))
  return sa.size === sb.size && [...sa].every((v) => sb.has(v))
}

/** 설문 행에서 새 행으로 옮기지 않는 칸 — 나머지는 전부 그대로 복사한다(케어 목표·기저질환 등이 비지 않게). */
const NOT_COPIED = new Set(['id', 'created_at'])

/**
 * 최신 설문 행 → '관리자 수정' 새 행(INSERT 용). 알레르기만 바꾸고 나머지 답·칸은 그대로.
 * user_id 는 최신 행의 것(강아지 주인)을 그대로 쓴다 — 고객 화면·AI 상담이 `.eq('user_id', 본인)` 으로 읽는다.
 */
export function buildAdminAllergySurveyRow(
  latest: Record<string, unknown>,
  nextAllergies: readonly string[],
  meta: { at: string; note?: string | null },
): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(latest)) if (!NOT_COPIED.has(k)) row[k] = v
  const answers =
    latest.answers && typeof latest.answers === 'object' && !Array.isArray(latest.answers)
      ? (latest.answers as Record<string, unknown>)
      : {}
  const mark: AdminAllergyEditMark = {
    at: meta.at,
    prevAllergies: allergiesFromAnswers(latest.answers),
    ...(meta.note && meta.note.trim() ? { note: meta.note.trim().slice(0, 200) } : {}),
  }
  row.answers = { ...answers, allergies: [...nextAllergies], adminEdit: mark }
  return row
}

export type AllergyImpact = {
  /** 이번 수정으로 새로 막히는 레시피 라인. */
  addedBlockedLines: FoodLine[]
  /** 이번 수정으로 풀리는 레시피 라인. */
  removedBlockedLines: FoodLine[]
  /** 지금 식단·비율로 박스를 계산할 수 있었나(진행 중 정기배송·지금 먹는 식단·제품이 다 있어야). */
  computed: boolean
  /** 고친 알레르기로 계산했을 때 담지 못하는 몫 — 있으면 포장 목록이 그 박스를 멈춘다. */
  heldAfter: HeldShare[]
  heldBefore: HeldShare[]
  /** 담기는 팩 구성이 달라지나(대체 레시피 등). */
  itemsChanged: boolean
}

type ServingLike = {
  formula: { lineRatios: Record<FoodLine, number>; toppers?: { protein: number; vegetable: number } | null }
  daily_kcal: number
}

function itemsKey(items: ReadonlyArray<{ slug: string; quantity: number; packG: number }>): string {
  return items
    .map((i) => `${i.slug}:${i.quantity}:${i.packG}`)
    .sort()
    .join('|')
}

/** 수정 전·후 알레르기로 지금 박스를 두 번 계산해 차이를 낸다(정본 computeBoxPlan). 금액은 계산하지 않는다. */
export function allergyEditImpact<P extends BoxProduct>(input: {
  prevAllergies: readonly string[]
  nextAllergies: readonly string[]
  serving: ServingLike | null
  freshRatio: number | null
  products: Record<string, P>
}): AllergyImpact {
  const before = blockedLinesForAllergies(input.prevAllergies)
  const after = blockedLinesForAllergies(input.nextAllergies)
  const addedBlockedLines = after.filter((l) => !before.includes(l))
  const removedBlockedLines = before.filter((l) => !after.includes(l))
  const canCompute =
    !!input.serving &&
    input.freshRatio != null &&
    input.freshRatio > 0 &&
    Object.keys(input.products).length > 0
  if (!canCompute) {
    return { addedBlockedLines, removedBlockedLines, computed: false, heldAfter: [], heldBefore: [], itemsChanged: false }
  }
  const base = {
    formula: {
      lineRatios: input.serving!.formula.lineRatios,
      toppers: input.serving!.formula.toppers ?? { protein: 0, vegetable: 0 },
      dailyKcal: input.serving!.daily_kcal,
    },
    freshRatio: input.freshRatio!,
    products: input.products,
  }
  const planBefore = computeBoxPlan({ ...base, blockedLines: before })
  const planAfter = computeBoxPlan({ ...base, blockedLines: after })
  return {
    addedBlockedLines,
    removedBlockedLines,
    computed: true,
    heldBefore: planBefore.held,
    heldAfter: planAfter.held,
    itemsChanged: itemsKey(planBefore.items) !== itemsKey(planAfter.items),
  }
}
