/**
 * '지금 먹는 식단' 고르기 — **정본 하나**(2026-10-13 점검 E4).
 *
 * # 왜
 * 홈(dashboard)과 강아지 화면은 dog_formulas 를 created_at 최신 1건으로 골랐다. 그런데 그 1건이
 *  · 승인 대기(pending_approval) — 아직 동의 안 한 새 제안
 *  · 거절(declined) — 보호자가 싫다고 한 제안
 *  · 시작 전(applied_from 이 오늘보다 뒤) — 다음 박스부터 담길 식단
 * 이면, 실제로 먹는(=피킹 리스트가 포장하고 청구 크론이 대조하는) 식단과 다른 것을 보여 줬다.
 * 피킹 리스트(발송일 기준)와 청구 크론은 이미 이 셋을 걸렀다. 재제안 크론은 거절된 제안을 다음 비교 기준·
 * 박스 카운트 시작점으로 썼다. 같은 규칙을 여기 하나에 두고 전부 이걸 부른다.
 *
 * 순수 함수 — 날짜는 KST yyyy-mm-dd 문자열(사전순 = 날짜순). 정렬은 created_at 내림차순(회차 번호가 큰 것이
 * 최신이 아니다 — AGENTS 규칙6). 호출처 정렬에 기대지 않고 여기서 다시 정렬한다.
 */

export type FormulaServingFields = {
  approval_status?: string | null
  applied_from?: string | null
  created_at?: string | null
}

/** 이 행이 기준일(refDateKst)에 '먹는 식단'이 될 수 있나 — 승인 대기·거절·시작 전이 아니면 그렇다. */
export function isServingFormula(row: FormulaServingFields, refDateKst: string): boolean {
  if (row.approval_status === 'pending_approval' || row.approval_status === 'declined') return false
  const from = row.applied_from ? row.applied_from.slice(0, 10) : null
  if (from && from > refDateKst) return false
  return true
}

function byCreatedDesc<T extends FormulaServingFields>(a: T, b: T): number {
  const ta = Date.parse(a.created_at ?? '')
  const tb = Date.parse(b.created_at ?? '')
  return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
}

/** 한 강아지의 처방 행들 → 기준일에 먹는 식단(없으면 null). */
export function currentServingFormula<T extends FormulaServingFields>(
  rows: readonly T[],
  refDateKst: string,
): T | null {
  return [...rows].sort(byCreatedDesc).find((r) => isServingFormula(r, refDateKst)) ?? null
}

/** 여러 강아지가 섞인 처방 행들 → 강아지별 먹는 식단. */
export function servingFormulaByDog<T extends FormulaServingFields & { dog_id: string }>(
  rows: readonly T[],
  refDateKst: string,
): Map<string, T> {
  const out = new Map<string, T>()
  for (const r of [...rows].sort(byCreatedDesc)) {
    if (out.has(r.dog_id)) continue
    if (isServingFormula(r, refDateKst)) out.set(r.dog_id, r)
  }
  return out
}
