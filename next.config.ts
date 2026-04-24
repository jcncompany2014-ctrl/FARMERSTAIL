import type { NextConfig } from 'next'
import { createRequire } from 'module'
import { withSentryConfig } from '@sentry/nextjs'

/**
 * 보안 헤더.
 *
 * OWASP 기본 + Next.js 16 호환 세트. 특히 다음을 고려:
 *
 * - CSP는 **지금 당장 전면 적용은 하지 않는다**. 이유:
 *   1) Next dev/HMR이 `'unsafe-eval'` 필요 + dynamic import가 inline script
 *      hash를 쓰는데 매 빌드마다 해시가 바뀌어 유지비 큼
 *   2) Sentry tunnelRoute(/monitoring), Toss Payments iframe, Daum 우편번호,
 *      GA/Meta Pixel, 카카오 스크립트 등 3rd party 다수 → 느슨하게 시작해서
 *      Report-Only 모드로 로그 모으며 점진적으로 조임
 *   현재는 `frame-ancestors` / `object-src` 같은 저위험·고효과만 설정하고
 *   본격 CSP는 Step 30 이후(쿠키 동의/법적 이슈 정돈된 뒤) 다시 손댄다.
 *
 * - HSTS: Vercel이 프로덕션에서 자동으로 붙여주지만, 미래 셀프호스팅 대비
 *   명시적으로 박아둠. `includeSubDomains` + `preload`까지 붙이면 취소가
 *   어려우니 1년 + includeSubDomains만, preload는 보류.
 *
 * - Permissions-Policy: 카메라(강아지 사진)·위치(매장찾기 미래)·마이크 등은
 *   앱이 명시 요청할 때만 허용. 기본은 전부 차단해서 3rd-party iframe이
 *   몰래 권한 요청 못 하게.
 */
const securityHeaders = [
  {
    // 옛 브라우저에서 `X-Frame-Options` 인식. 최신 브라우저는 CSP
    // `frame-ancestors`가 이기지만 둘 다 박아두는 게 관행.
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    // Clickjacking 방어의 최신 표준. 같은 오리진만 이 사이트를 frame에
    // 넣을 수 있음. Toss/Daum은 반대 방향(우리가 그들 걸 frame)이라 영향 없음.
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    // 다른 사이트로 이동할 때 origin만 보내고 path/query는 숨김. SEO 영향 無.
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Strict-Transport-Security',
    // 1년. preload는 안전성 확인 뒤 추가.
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Permissions-Policy',
    // 기본 전부 차단. 필요해지면 개별 API route/페이지 수준에서 풀어줌.
    // 주의: `self`에도 적용됨 → DogPhotoPicker가 카메라 쓴다면 여기서 'self'
    // 허용 필요. 현재는 파일 업로드 방식이라 전면 차단 유지.
    value:
      'camera=(), microphone=(), geolocation=(), payment=(self), ' +
      'interest-cohort=()',
  },
]

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
  async headers() {
    return [
      {
        // 모든 경로에 보안 헤더 적용.
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
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

/**
 * Bundle analyzer — `ANALYZE=true npm run build` 로 client/server/edge 번들
 * 사이즈 트리를 report.html 로 생성. 플러그인은 devDependency 지만 CI 에
 * 부담을 주지 않으려고 dynamic require 로 감싸서 ANALYZE 미설정 시 로드되지
 * 않게 했다. 미설치 환경에선 console.warn 만 내고 그대로 통과.
 */
function maybeWithBundleAnalyzer(config: NextConfig): NextConfig {
  if (process.env.ANALYZE !== 'true') return config
  try {
    const req = createRequire(import.meta.url)
    const withBundleAnalyzer = req('@next/bundle-analyzer') as (opts: {
      enabled?: boolean
      openAnalyzer?: boolean
    }) => (cfg: NextConfig) => NextConfig
    return withBundleAnalyzer({ enabled: true, openAnalyzer: false })(config)
  } catch (err) {
    console.warn(
      '[next.config] ANALYZE=true requested but @next/bundle-analyzer not installed — skipping.',
      err,
    )
    return config
  }
}

export default withSentryConfig(maybeWithBundleAnalyzer(nextConfig), sentryOptions)
