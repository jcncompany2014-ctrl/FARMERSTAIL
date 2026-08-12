/**
 * 크론 요약(summary)에서 **실패 카운터**를 세는 순수 함수.
 *
 * # 왜 별도 파일인가
 * cron-tracking.ts 는 Supabase·Sentry 를 import 해서 `npm test`(node
 * strip-types)에서 `@/` 별칭을 못 푼다. 판정 로직만 여기로 빼면 테스트가
 * 붙는다 — 이 판정이 틀리면 "메일이 한 통도 안 나갔다"가 초록으로 집계된다.
 *
 * # 무엇을 고치는가 (2026-08-12 3라운드 감사)
 * 2026-08-05 에 5xx **반환** 경로는 덮었는데, 실패를 세어 body 에 담고 200 을
 * 돌려주는 얼굴이 남아 있었다:
 *   · subscription-reminders `{ sent: 0, errors: 12 }` → cron_health success
 *   · quarterly-report       `{ sent: 0, failed: 9 }`  → ops-digest 침묵
 */

/**
 * 실패를 뜻하는 요약 키들. 크론마다 이름이 달라 목록으로 둔다.
 *
 * ⚠️ `skipped`·`paidSkipped` 는 **넣지 않는다** — 대상이 아니라 건너뛴 것은
 * 정상 동작이다. 이걸 실패로 세면 매일 빨간불이 뜨고, 그러면 규칙 자체가
 * 꺼진다(느슨한 규칙이 죽는 방식).
 */
export const FAILURE_KEYS = [
  'errors',
  'failed',
  'itemsFailed',
  'mailFailed',
] as const

/** summary 안 실패 카운터의 합. 0 보다 크면 그 크론은 부분 실패다. */
export function failureCountOf(
  summary: Record<string, unknown> | null | undefined,
): number {
  if (!summary) return 0
  let total = 0
  for (const k of FAILURE_KEYS) {
    const v = summary[k]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) total += v
  }
  return total
}
