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
          /**
           * ★폐지된 낱개커머스 경로(/products /collections /events /best /new
           *  /cart /checkout)를 **차단 목록에서 뺐다** (2026-09-08 사장님 제보).
           *
           * 원래는 "sitemap 제외 + robots 차단으로 redirect URL 인덱싱을 막는다"
           * 였는데, 그게 정반대로 작동했다. robots 차단은 **크롤을 막을 뿐 색인을
           * 지우지 못한다** — 크롤러가 URL 을 가져갈 수 없으니 우리가 걸어둔
           * 리다이렉트를 **볼 방법이 없고**, 그래서 폐지 3개월 뒤에도 네이버가
           * 옛 컬렉션(/collections/first-meal)의 제목·설명·구 AI 썸네일을 그대로
           * 노출하고 있었다. 검색콘솔 경고를 없애려다 색인 정리를 막은 셈이다.
           *
           * 색인을 실제로 정리하려면 **크롤을 허용**해서 308(permanentRedirect)을
           * 보게 해야 한다. 그 과정에서 GSC 에 "Page with redirect" 가 잠시
           * 뜨는데, 그건 오류가 아니라 정상 처리 신호이고 정리가 끝나면 사라진다.
           * ⚠️ 다시 차단하지 말 것 — 차단하는 순간 옛 색인이 도로 굳는다.
           */
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
