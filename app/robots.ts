import type { MetadataRoute } from 'next'

// R72 — production fallback www. 으로 통일 (sitemap.ts 와 동기).
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.farmerstail.kr'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/*',
          '/api/',
          '/api/*',
          '/checkout',
          '/checkout/*',
          '/cart',
          // 구독 전용 전환(2026-06-27): 낱개커머스 라우트 — 전부 /start 로
          // redirect. sitemap 제외 + robots 차단으로 크롤러가 redirect URL 을
          // 인덱싱(GSC "Page with redirect" 경고)하지 않게 한다.
          '/products',
          '/products/*',
          '/collections',
          '/collections/*',
          '/events',
          '/events/*',
          '/best',
          '/new',
          '/mypage',
          '/mypage/*',
          '/dogs',
          '/dogs/*',
          '/login',
          // 인증 영역 — (main) 그룹의 dashboard / chat / notifications.
          // 실제로는 인증 미들웨어가 막지만, robots 에 명시해야 GSC 의
          // "Crawled — not indexed" / "Indexed though blocked" 경고 예방.
          '/dashboard',
          '/dashboard/*',
          '/chat',
          '/chat/*',
          '/notifications',
          '/notifications/*',
          // /subscribe/billing-auth /billing-success /billing-fail — Toss
          // 결제 콜백 endpoint. 검색 색인 불필요.
          '/subscribe',
          '/subscribe/*',
          // /welcome — PWA 설치 후 첫 진입 시 internal redirect 페이지.
          // OnboardingGate 가 자동 이동 시키므로 직접 방문 / 인덱스 불필요.
          '/welcome',
          // /app-required — 비-PWA 사용자에게 앱 설치 안내 페이지. 검색 결과
          // 직접 노출되면 사용자 혼란. internal redirect 전용.
          '/app-required',
          // /r/[code] — 친구 초대 짧은 링크 redirect. 검색 색인 의미 없음.
          '/r/',
          '/r/*',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
