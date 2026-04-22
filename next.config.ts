import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'adynmnrzffidoilnxutg.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

/**
 * Sentry 빌드 플러그인 옵션.
 * SENTRY_AUTH_TOKEN이 없으면 source map 업로드가 silently skip 되므로
 * 로컬 개발/프리뷰 빌드에서는 별도 토큰 없이도 통과한다. production
 * 빌드(Vercel)에서만 실제 업로드가 발생.
 *
 * tunnelRoute: ad block으로 인한 이벤트 유실을 막기 위해 동일 오리진
 * 경로로 프록시. 결제 실패 같은 핵심 이벤트가 uBlock에 먹히면 모니터링
 * 자체가 무의미해진다.
 */
const sentryOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // CI 로그가 빌드 시간 동안 noise로 채워지지 않도록.
  silent: !process.env.CI,
  // 소스맵은 Sentry에 업로드한 뒤 bundle에서 제외 — 공개 소스맵은
  // 비즈니스 로직 역엔지니어링 위험.
  widenClientFileUpload: true,
  hideSourceMaps: true,
  tunnelRoute: '/monitoring',
  // DSN이 아예 없으면 플러그인 동작도 건너뜀.
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
}

export default withSentryConfig(nextConfig, sentryOptions)
