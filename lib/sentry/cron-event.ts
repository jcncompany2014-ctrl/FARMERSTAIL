/**
 * 크론 실패 알림의 묶음 열쇠 — 순수 함수 (2026-10-15 어드민 수정 F-a, 규칙267).
 *
 * # 왜
 * 크론 실패 메시지가 늘 'cron.error' 하나라 어떤 크론이 실패해도 Sentry 이슈 하나로 묶여 숫자만 올랐다('새 이슈' 알림 없음).
 * 경보함에도 안 들어갔다. lib/cron-tracking notifyCronError 가 이 두 함수로 크론마다 따로 묶는다.
 *  · Sentry fingerprint — 크론 경로마다 다른 이슈.
 *  · 경보함 대상 열쇠 — 크론 + KST 날짜(같은 날 같은 크론의 재실패는 한 줄, 다음 날 실패는 새 줄 — '처리함'까지 남는다).
 * node 테스트가 값으로 불러온다 — '@/' 별칭·DB 를 부르지 않는다.
 */

/** 크론 실패의 Sentry 묶음 — 크론마다 따로. */
export function cronSentryFingerprint(path: string): string[] {
  return ['cron.error', path]
}

/** 크론 실패 경보의 대상 열쇠 — 크론 + KST 날짜. */
export function cronAlertTargetKey(path: string, now: Date): string {
  const kstDay = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return `cron:${path}:${kstDay}`
}
