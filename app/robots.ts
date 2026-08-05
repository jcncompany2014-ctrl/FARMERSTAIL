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
          // /recipe/[protein] — 제품 뒷면 QR 전용 레시피 상세(2026-07-06).
          // 검색·사이트 링크로는 못 들어오게 색인 차단(QR 진입만).
          '/recipe',
          '/recipe/*',
          // ★2026-08-05 검수 — 전환·계정 화면이 색인 허용으로 남아 있었다.
          //   /start 하위는 퍼널 중간 단계다(claim 은 스피너뿐인 라우팅 허브,
          //   done 은 가입 직후 확인, survey·join 은 /start 를 거쳐야 맥락이
          //   맞는다). 진입점은 /start 하나만 색인한다.
          '/start/*',
          // 계정 화면 — 전부 로그인 필요라 크롤러는 로그인 리다이렉트만 본다.
          '/account',
          '/account/*',
          // 14세 확인·오프라인 안내·비밀번호 재설정 — 검색 결과에 뜰 이유가
          //   없고, "등록에 실패했어요" 류 스니펫은 브랜드에 해롭다.
          '/onboarding',
          '/onboarding/*',
          '/offline',
          '/forgot-password',
          '/reset-password',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
