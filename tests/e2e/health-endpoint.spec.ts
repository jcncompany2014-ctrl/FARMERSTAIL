import { test, expect } from '@playwright/test'

/**
 * R77-P3: /api/health uptime endpoint.
 *
 * 외부 모니터링 (BetterStack / UptimeRobot) 이 의존하는 응답 형식 검증.
 * 출시 후 monitoring 셋업할 때 이 spec 이 fail 하면 외부 모니터도 깨짐.
 */

test.describe('Health endpoint /api/health', () => {
  test('200 응답 + JSON 구조 확인', async ({ request }) => {
    const response = await request.get('/api/health')

    // 200 (ok) 또는 503 (degraded — env / db 문제). 두 경우 모두 valid 응답.
    expect([200, 503]).toContain(response.status())

    const body = await response.json()
    expect(body).toHaveProperty('status')
    expect(['ok', 'degraded']).toContain(body.status)
    expect(body).toHaveProperty('timestamp')
    expect(body).toHaveProperty('dependencies')
    expect(body).toHaveProperty('build')
  })

  test('Cache-Control: no-store (모니터가 fresh 응답 받도록)', async ({
    request,
  }) => {
    const response = await request.get('/api/health')
    const cacheControl = response.headers()['cache-control'] ?? ''
    expect(cacheControl).toContain('no-store')
  })

  test('dependencies 안에 db / env 키 존재', async ({ request }) => {
    const response = await request.get('/api/health')
    const body = await response.json()
    expect(body.dependencies).toHaveProperty('db')
    expect(body.dependencies).toHaveProperty('env')
    // db / env 는 'ok' 또는 'fail' / 'degraded'
    expect(['ok', 'fail']).toContain(body.dependencies.db)
    expect(['ok', 'degraded']).toContain(body.dependencies.env)
  })
})
