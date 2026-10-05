/**
 * AI '이렇게 해보세요' 한 줄을 고객에게 그대로 보여도 되는가 — 10차 점검 E (2026-10-06).
 * 실제 저장분에 "단백질 32% 이상 사료 비중을…"(정확한 영양소 %)가 나가고 있었다. 프롬프트는 summary 만 막았다.
 * 영문 약어(BCS·Bristol …)나 영양소 %가 든 줄은 뺀다. 표준 원칙 "간식은 하루 열량의 10% 이내"만 허용.
 * 새 응답은 parseAiAnalysis 가, 저장된 옛 분석은 화면(AiCommentCard)이 같은 함수로 거른다.
 * (클라이언트가 프롬프트 모듈 전체를 끌어오지 않게 따로 둔다.)
 */
export function isCustomerSafeAiLine(s: string): boolean {
  if (/[A-Za-z]{2,}/.test(s)) return false
  const pcts = s.match(/\d+(?:\.\d+)?\s*%/g) ?? []
  if (pcts.length === 0) return true
  return /간식/.test(s) && pcts.every((p) => /^10\s*%$/.test(p))
}
