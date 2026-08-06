/**
 * 크론 응답 상태 판정 — **의존성이 없는 순수 모듈**.
 *
 * lib/cron-tracking.ts 에 두면 `@/lib/...` 별칭 import 때문에
 * `node --experimental-strip-types` 가 파일을 못 읽어 테스트가 안 붙는다
 * (AGENTS.md 의 "npx tsx 는 npm test 가 아니다" 와 같은 계열).
 * 틀릴 수 있는 판단만 여기 두고 테스트로 지킨다.
 */

/**
 * 반환된 HTTP 상태를 크론 실패로 볼 것인가.
 *
 * 5xx 만 실패다. 4xx 는 크론 자신의 판단(인증 실패 401, 잘못된 요청 400)이라
 * 재시도해도 같고, error 로 기록하면 운영 다이제스트가 소음으로 찬다.
 */
export function isFailureStatus(status: unknown): boolean {
  return typeof status === 'number' && Number.isFinite(status) && status >= 500
}
