/**
 * 결제 전 상담 게이트 — 알레르기 말고도 **화식으로 시작하면 안 되는 경우**(2026-10-13 점검 E8).
 *
 * # 왜
 * 급성·중증 췌장염은 지방이 아주 적은 식단이 필요한데, 판매 4종은 지방이 가장 적은 레시피로도 그 기준에 닿지 못한다.
 * 예전엔 분석 화면·주문 화면에 '권장하지 않아요' 경고만 띄우고 **결제는 그대로 됐다**(주문 버튼·신청 API 모두 열림).
 * 사장님 결정(2026-10-13): "급성은 막기" — compute 의 needsConsultation 에 넣어 주문 화면 진입·신청 API·승인이
 * 기존 알레르기 상담 길(분석 화면의 카카오톡 문의)과 같은 길로 간다.
 *
 * 순수 함수 — compute(새로 계산)·신청 API(저장된 처방 + 최신 설문)·주문 화면 데이터가 같은 판정을 쓴다.
 */

/** 상담 안내 — 분석 화면 상담 카드가 이 문장을 보고 췌장염 안내를 그린다(RecommendationBox). '처방'·정확한 % 금지. */
export const PANCREATITIS_CONSULT_REASON =
  '급성·중증 췌장염이 있는 아이는 화식을 바로 시작하지 않고, 먼저 상담을 도와드릴게요. 지방이 아주 적은 식단은 수의사와 정해 주세요.'

/** firstBox 가 급성·중증 췌장염일 때 남기는 근거 ruleId — 옛 저장 처방도 이걸로 알아본다. */
export const PANCREATITIS_GATE_RULE_ID = 'pancreatitis-severe-unsuitable'

/** 설문(만성질환 + 수의사 진단 중증도)으로 본 급성·중증 췌장염. */
export function isSeverePancreatitis(input: {
  chronicConditions?: readonly string[] | null
  diagnosedSeverity?: Readonly<Record<string, string>> | null
}): boolean {
  const conditions = Array.isArray(input.chronicConditions) ? input.chronicConditions : []
  return conditions.includes('pancreatitis') && input.diagnosedSeverity?.['pancreatitis'] === 'severe'
}

/** 저장된 근거(reasoning)에 급성·중증 췌장염 게이트가 있나 — needsConsultation 이 없던 옛 처방용. */
export function hasPancreatitisGate(
  reasoning: ReadonlyArray<{ ruleId?: string | null }> | null | undefined,
): boolean {
  return Array.isArray(reasoning) && reasoning.some((r) => r?.ruleId === PANCREATITIS_GATE_RULE_ID)
}
