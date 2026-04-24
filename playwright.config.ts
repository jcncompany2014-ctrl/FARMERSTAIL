import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E config — farmerstail-app.
 *
 * 왜 build 대신 dev 를 띄우나
 * ─────────────────────────
 * Next 16 App Router + Turbopack 조합에서 `next build` 가 Windows 환경
 * 특정 조건에서 font loader 를 못 잡는 버그가 있어 CI 가 아닌 로컬에선
 * `next dev` 로 돌린다. CI (Linux) 에선 PLAYWRIGHT_USE_BUILD=1 을 세팅해
 * build+start 로 리얼 프로덕션 바이너리 에 대해 테스트.
 *
 * 왜 Chromium 만 기본으로 돌리나
 * ──────────────────────────
 * PWA · Install prompt · WebPush 는 Chromium 계열에서만 표준 동작하므로
 * 핵심 플로우(홈, 상품, 법적 페이지) 는 Chromium 데스크톱 + 모바일로 충분.
 * Webkit/Firefox 는 선택형으로 `--project=firefox` 식 opt-in.
 */

const PORT = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? '3100', 10)
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`
const IS_CI = Boolean(process.env.CI)
const USE_BUILD = process.env.PLAYWRIGHT_USE_BUILD === '1' || IS_CI

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 1 : undefined,
  reporter: IS_CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: USE_BUILD
      ? `npm run build && npm run start -- -p ${PORT}`
      : `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !IS_CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
