/**
 * lib/log-sanitize — 로그·알림(Sentry/Slack/DB last_error)으로 나가는 "외부 유래"
 * 에러 문자열 위생 처리.
 *
 * 왜: Toss 등 외부 응답 에러 메시지를 그대로 Sentry/Slack/DB 에 실으면
 *  - 제어문자(개행)로 로그 라인 분할·인젝션
 *  - 카드/계좌/거래식별 같은 긴 숫자열(PII)이 노출
 * 될 수 있다(점검 batch5 I/J). 전달 직전 이 함수로 정규화한다.
 *
 * 처리:
 *  1) 제어문자(code < 0x20, 0x7f) -> 공백 (로그 인젝션/라인분할 차단)
 *  2) 6자리 이상 연속 숫자 -> 앞2 + 마스킹 + 뒤2 (카드/계좌/거래번호 PII)
 *  3) 길이 제한 (기본 300자)
 */
export function sanitizeLogText(input: unknown, maxLen = 300): string {
  const raw = typeof input === 'string' ? input : String(input ?? '')
  // 1) 제어문자 -> 공백 (정규식 대신 char code 로 — 이식성/안전)
  let s = ''
  for (const ch of raw) {
    const c = ch.charCodeAt(0)
    s += c < 0x20 || c === 0x7f ? ' ' : ch
  }
  // 2) 긴 숫자열(6+) 마스킹 — 한국 우편번호(5자리)는 안 건드림.
  s = s.replace(/\d{6,}/g, (m) =>
    m.length <= 4 ? m : m.slice(0, 2) + '*'.repeat(m.length - 4) + m.slice(-2),
  )
  // 3) 길이 제한
  s = s.trim()
  if (s.length > maxLen) s = s.slice(0, maxLen) + '…'
  return s
}
