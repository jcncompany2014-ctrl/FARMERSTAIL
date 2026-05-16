/**
 * Playwright config (audit #77).
 *
 * # 실행
 *   npm run test:e2e            # 로컬 dev 서버 띄워서
 *   npm run test:e2e:preview    # Vercel Preview URL 대상
 *
 * # CI
 * GitHub Actions e2e job 에서 Vercel Preview URL 을 PLAYWRIGHT_BASE_URL 로 주입.
 * PR comment 로 preview 가 올라오면 playwright 가 그쪽으로.
 *
 * # 첫 happy path 3개
 *   - tests/e2e/landing.spec.ts        — 마케팅 페이지 진입
 *   - tests/e2e/signup.spec.ts         — 회원가입 폼 검증
 *   - tests/e2e/checkout-guard.spec.ts — 미로그인 시 checkout 차단
 *
 * 실제 결제 / Supabase write 는 test 환경에서만 (mock or test project).
 */
import { defineConfig, devices } from '@playwright/test'

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const isCI = !!process.env.CI

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 14'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !isCI,
        timeout: 120_000,
      },
})
