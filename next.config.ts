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

/**
 * Supabase Storage 호스트명을 NEXT_PUBLIC_SUPABASE_URL 에서 자동 추출.
 *
 * 이전엔 코드에 프로젝트 ID 가 박혀 있어 Supabase 프로젝트 이전 / staging
 * 분리 시 누락 위험. URL 파싱 실패 시 fallback (개발 시 첫 빌드 통과용).
 */
function supabaseHostname(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!raw) return 'adynmnrzffidoilnxutg.supabase.co'
  try {
    return new URL(raw).hostname
  } catch {
    return 'adynmnrzffidoilnxutg.supabase.co'
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: supabaseHostname(),
        // public + sign 둘 다 허용. 일기 사진은 private 버킷(dog-diary-photos)
        // 이라 signed URL(/storage/v1/object/sign/...)을 쓰는데 public/** 만
        // 두면 next/image 가 src 를 거부 → 렌더 throw → "문제가 생겼어요" 에러
        // 화면이 떴다(사장님 2026-07-23 일기 사진). object/** 로 넓혀 해소.
        pathname: '/storage/v1/object/**',
      },
      {
        // 블로그(매거진) 포스트 cover_url 이 Unsplash 플레이스홀더를 쓴다.
        // 미허용 시 next/image 가 throw → ErrorBoundary 가 페이지 전체를
        // 대체해 /blog 의 헤더·CTA·모바일 nav 까지 사라진다(회차97 근본원인).
        // 향후 cover 를 Supabase Storage 로 이관하면 이 항목 제거 가능.
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
    // Supabase Storage URL 은 admin 이 같은 슬러그로 새 파일 업로드 시 path 가
    // 동일해도 컨텐츠가 바뀔 수 있다. 그러나 실제 운영에서 상품 이미지는 거의
    // 갱신되지 않고, 갱신 시엔 admin 이 new file 으로 업로드하면서 경로가
    // 변경되는 패턴. 1년 캐시로 CDN 부담 + 사용자 응답 둘 다 개선.
    // 갱신 즉시 반영이 필요하면 Vercel 의 image cache invalidate API 호출.
    // audit #86: production 1년 캐시 유지, dev 에서는 0 — 디자인 검토 / 이미지
    // 교체 작업 시 즉시 반영. AVIF 변환 부담도 prod-only 가 자연스러움.
    minimumCacheTTL: process.env.NODE_ENV === 'production' ? 31536000 : 0,
    // AVIF + WebP 우선 — JPEG 대비 ~30% 작음. 비호환 브라우저는 자동 fallback.
    formats:
      process.env.NODE_ENV === 'production'
        ? ['image/avif', 'image/webp']
        : ['image/webp'],
  },
  // Tree-shaking 보강 — lucide-react 같은 barrel-import 라이브러리에서 import 한
  // 아이콘만 번들에 들어가게. 127 파일이 lucide-react 사용 중이라 번들 임팩트 큼.
  // - lucide-react: 700+ 아이콘 중 실제 import 한 N개만 번들링 → ~100KB+ 절감
  // - @sentry/nextjs: SDK 의 unused export 제거
  experimental: {
    optimizePackageImports: ['lucide-react', '@sentry/nextjs'],
  },
  async headers() {
    return [
      {
        // 모든 경로에 보안 헤더 적용.
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // audit #87: 결제 / 개인정보 페이지 strict CSP (Report-Only — 30일 수집
        // 후 enforce 전환). script-src 'self' + Toss 결제 도메인만, 'unsafe-inline'
        // 은 Next.js script chunks 호환 위해 일단 허용 (점진 제거 검토).
        source: '/(checkout|mypage)/:path*',
        headers: [
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.tosspayments.com https://*.toss.im https://*.vercel-insights.com https://*.vercel.app",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.tosspayments.com https://*.toss.im https://*.sentry.io https://*.ingest.sentry.io https://api.anthropic.com",
              "frame-src 'self' https://*.tosspayments.com https://*.toss.im",
              "frame-ancestors 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://*.tosspayments.com https://*.toss.im",
            ].join('; '),
          },
        ],
      },
      // 정적 자원 (Next 가 hash 박은 _next/static/*) — immutable + 1년.
      // CDN 과 브라우저 모두 강력 캐시. hash 가 바뀌면 새 URL 이라 staleness X.
      //
      // ⚠️ production 전용. dev(Turbopack) 청크는 content-hash URL 이 아니라
      // 같은 URL 의 내용이 코드 수정마다 바뀐다 — immutable 이 브라우저에 옛
      // 청크를 영구 고정시켜 "고쳐도 옛 화면 / 모듈 없음 / hydration 깨짐"
      // (B1 상호명, orders 파싱, 2026-06-12 lucide Filter) 의 단일 근원이었다.
      // Next 부팅 경고("Custom Cache-Control ... can break development") 도 이것.
      ...(process.env.NODE_ENV === 'production'
        ? [
            {
              source: '/_next/static/:path*',
              headers: [
                {
                  key: 'Cache-Control',
                  value: 'public, max-age=31536000, immutable',
                },
              ],
            },
          ]
        : []),
      {
        // 폰트 파일 — Pretendard 등 webfont. 1년 immutable.
        source: '/(.*)\\.(woff2|woff|ttf|otf)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // 서비스워커 — 절대 캐시 금지(항상 재검증). sw.js 가 캐시되면 배포해도
        // 옛 버전이 남아 사용자가 업데이트를 영영 못 받는다(PWA staleness 버그).
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        // PWA 매니페스트 — 자주 안 바뀌지만 1시간 후 재검증(아이콘·이름 변경 반영).
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, must-revalidate',
          },
        ],
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
  //
  // audit #89: PR Preview 에서 source map 업로드 끊김 위험 — Vercel Preview
  // environment 에 SENTRY_AUTH_TOKEN (sourceMap read-only 권한 별도 발급 권장)
  // 추가 시 release 매핑이 main 머지 전 디버깅 가능. 그게 없으면 minified
  // stack 그대로 — main merge 후만 정상.
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
