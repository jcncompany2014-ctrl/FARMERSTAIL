/**
 * 새 레시피 동의 마감 — **정본 하나** (2026-10-14 어드민 B2, 규칙250).
 *
 * # 규칙 (사장님 2026-07-23, 마감 크론 personalization-approval-timeout 과 같음)
 *  · 금액이 바뀌는 제안(formula.priceChange — 몸무게·알레르기·건강, 구독 화면 동의 창): 제안 후 **3일**.
 *  · 금액이 그대로인 일반 제안: **5일**.
 *  · 상담 필요(formula.needsConsultation): 마감 없음 — 사람이 풀어야 하는 건이라 크론이 닫지 않는다.
 * 마감이 지나면 크론이 '이전 식단 그대로'(declined)로 닫는다.
 *
 * # 왜 함수로
 * 어드민 레시피 승인 화면은 '5일 − 지난 날'을 따로 셌다(3일짜리 금액 변경 제안을 이틀 늦게 '마감 임박'으로 보였다).
 * 크론·레시피 승인 화면·이번 주 할 일이 같은 판정을 쓴다.
 */

export const APPROVAL_DAYS_DEFAULT = 5
export const APPROVAL_DAYS_PRICE_CHANGE = 3

export type PendingFormulaLike = {
  proposed_at: string | null
  formula: unknown
}

type FormulaFlags = { priceChange?: unknown; needsConsultation?: unknown } | null

function flagsOf(formula: unknown): FormulaFlags {
  return formula && typeof formula === 'object' ? (formula as FormulaFlags) : null
}

/**
 * 알레르기·건강 정보 때문에 바뀌는(강제) 금액 변경 제안인가 — formula.priceChange.forced (재제안 크론이 적는다).
 *
 * ★2026-10-15 F-a(규칙266) — 이 제안이 3일 무응답으로 '이전 식단 그대로'로 닫히면, 그 이전 식단에는 새로 알려준 알레르기 재료가
 * 있을 수 있어 포장 목록이 박스를 멈춘다. 그런데 손님에겐 '그대로 다음 박스에 적용해요'가 가고 사장님은 아무 알림도 못 받았다.
 * 마감 규칙(3일)은 그대로 둔다 — 손님 화면이 '3일 안에 안 고르시면 이전 그대로'라고 약속했고, 승인 금액이 어긋난 제안은
 * 크론이 닫아야 다시 만들어진다. 대신 마감 크론이 손님 문구를 바꾸고(거짓 '그대로 적용' 금지) 경보함에 '연락 필요'를 올리며,
 * 마감 임박 목록의 문구에 '알레르기·건강 제안'을 붙인다(레시피 승인·이번 주 할 일이 같은 approvalTimeLeft 를 쓴다).
 */
export function isForcedProposal(formula: unknown): boolean {
  const pc = flagsOf(formula)?.priceChange
  return !!pc && typeof pc === 'object' && (pc as { forced?: unknown }).forced === true
}

/** 이 제안의 응답 기한(일) — 상담 필요면 null(크론이 닫지 않는다). */
export function approvalWindowDays(formula: unknown): number | null {
  const f = flagsOf(formula)
  if (f?.needsConsultation === true) return null
  return f?.priceChange ? APPROVAL_DAYS_PRICE_CHANGE : APPROVAL_DAYS_DEFAULT
}

/** 마감 시각(ISO). 제안 시각을 모르거나 상담 필요면 null. */
export function approvalDeadlineIso(row: PendingFormulaLike): string | null {
  const days = approvalWindowDays(row.formula)
  if (days === null || !row.proposed_at) return null
  const t = Date.parse(row.proposed_at)
  if (!Number.isFinite(t)) return null
  return new Date(t + days * 24 * 60 * 60 * 1000).toISOString()
}

/** 마감이 지났나(크론이 닫을 대상인가). */
export function approvalExpired(row: PendingFormulaLike, now: Date): boolean {
  const d = approvalDeadlineIso(row)
  return d !== null && Date.parse(d) <= now.getTime()
}

/**
 * 마감까지 남은 시간 — 화면 문구용. hoursLeft 는 올림(23시간 1분 남음 → 24).
 * 'imminent' = 48시간 안(이번 주 할 일·레시피 승인 화면의 '마감 임박').
 */
export function approvalTimeLeft(
  row: PendingFormulaLike,
  now: Date,
): { deadlineIso: string; hoursLeft: number; imminent: boolean; label: string } | null {
  const d = approvalDeadlineIso(row)
  if (!d) return null
  const ms = Date.parse(d) - now.getTime()
  const hoursLeft = Math.max(0, Math.ceil(ms / (60 * 60 * 1000)))
  const base = hoursLeft <= 0 ? '오늘 마감(곧 이전 식단 유지)' : hoursLeft < 24 ? `${hoursLeft}시간 남음` : `${Math.floor(hoursLeft / 24)}일 ${hoursLeft % 24}시간 남음`
  // 알레르기·건강 제안은 무응답이면 이전 식단에 그 재료가 남을 수 있다 — 목록에서 구분되게(규칙266).
  const label = isForcedProposal(row.formula) ? `${base} · 알레르기·건강 제안 — 답이 없으면 연락 필요` : base
  return { deadlineIso: d, hoursLeft, imminent: hoursLeft <= 48, label }
}
