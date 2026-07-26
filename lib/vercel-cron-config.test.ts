import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

/**
 * vercel.json 의 자동작업(cron) 설정이 서로 어긋나지 않는지 검사 (2026-07-26).
 *
 * # 왜 생겼나
 * `daily-briefing` 을 추가하면서 `crons` 에는 등록했는데 `functions` 의
 * 실행시간(maxDuration)을 빠뜨렸다. 그러면 기본값으로 돌고, 시간 초과로 죽으면
 * **cron_health 에 기록조차 안 남는다**(trackCron 은 handler 가 끝난 뒤에
 * 기록하므로). 실제로 등록 후 하루가 지나도록 실행 기록이 0건이었고,
 * "돌고 있겠지" 하고 넘어갈 뻔했다.
 *
 * 조용히 안 도는 게 제일 위험하다 — 결제·배송 자동작업이 이렇게 되면
 * 아무도 모르는 사이에 장사가 멈춘다.
 */

type VercelConfig = {
  crons?: Array<{ path: string; schedule: string }>
  functions?: Record<string, { maxDuration?: number }>
}

const cfg = JSON.parse(readFileSync('vercel.json', 'utf8')) as VercelConfig
const crons = cfg.crons ?? []
const functions = cfg.functions ?? {}

/** `/api/cron/foo` → `app/api/cron/foo/route.ts` (functions 키 형식) */
function fnKey(cronPath: string): string {
  return `app${cronPath}/route.ts`
}

test('등록된 자동작업이 하나라도 있다', () => {
  assert.ok(crons.length > 0)
})

test('★ 모든 자동작업에 실행시간(maxDuration)이 지정돼 있다', () => {
  const missing = crons.map((c) => c.path).filter((p) => !(fnKey(p) in functions))
  assert.deepEqual(
    missing,
    [],
    `실행시간 미지정 자동작업: ${missing.join(', ')} — 기본값으로 돌면 ` +
      '시간 초과 시 실행 기록조차 안 남는다',
  )
})

test('★ 모든 자동작업의 라우트 파일이 실제로 존재한다', () => {
  const missing = crons
    .map((c) => c.path)
    .filter((p) => !existsSync(fnKey(p)))
  assert.deepEqual(missing, [], `라우트 파일 없는 자동작업: ${missing.join(', ')}`)
})

test('★ 모든 자동작업에 한국어 이름표가 있다 (화면에 경로가 그대로 뜨지 않게)', async () => {
  const { hasCronLabel } = await import('./cron-labels.ts')
  const missing = crons.map((c) => c.path).filter((p) => !hasCronLabel(p))
  assert.deepEqual(
    missing,
    [],
    `이름표 없는 자동작업: ${missing.join(', ')} — lib/cron-labels.ts 에 추가할 것`,
  )
})

test('자동작업 경로에 중복이 없다', () => {
  const paths = crons.map((c) => c.path)
  assert.equal(new Set(paths).size, paths.length, '같은 경로가 두 번 등록됨')
})
