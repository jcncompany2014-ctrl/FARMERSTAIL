/**
 * (main) route group — auth-gated app shell.
 *
 * 본 그룹은 **앱 전용 라우트** 만 포함한다 (dashboard, dogs/*, mypage/*
 * 거의 전부, welcome 등). 웹/앱 양쪽에서 접근 가능한 라우트 (cart, checkout,
 * mypage/orders) 는 그룹 외부 (`app/cart`, `app/checkout`, `app/mypage/orders`) 로
 * 이동되어 WebChrome 으로 일관되게 wrap 된다.
 *
 * 이 layout 의 책임:
 *   AppChrome 으로 항상 wrap — 모바일 폰 프레임 + 하단 탭바 + InstallPrompt
 *
 * # 인증
 * 인증 체크는 **이 레이아웃이 하지 않는다**. 다음 두 곳에서 이미 처리:
 *   1. proxy.ts 미들웨어 — 앱 전용 prefix 에 ft_app 쿠키 / 인증 검사 + redirect
 *   2. 각 page.tsx 가 server component 에서 `await supabase.auth.getUser()` 후
 *      필요 시 `redirect('/login')`
 *
 * 이전 (~Round 36) 까지는 'use client' 로 추가 client-side getUser() 가 있었지만,
 * 그건 서버 redirect 가 이미 끝난 뒤 redundant + 사용자 경험상 매 라우트 이동마다
 * 빈 스피너 200~500ms 가 깜빡이는 원인이었다. 제거 — 이제 layout 은 server
 * component 라 zero-overhead 로 통과.
 */
import type { Metadata } from 'next'
import AppChrome from '@/components/AppChrome'
import { ConfirmProvider } from '@/components/v3'

/**
 * SEO 가드 — (main) 그룹 모든 페이지 noindex.
 *
 * 이 그룹은 인증이 필요한 개인화된 페이지들 (대시보드 / 강아지 상세 / 분석 /
 * 채팅 / 알림 / 마이페이지 등). robots.ts 의 disallow 가 1차 보호하지만,
 * 검색엔진이 우회로 (인링크, sitemap 누락 등) 로 도달했을 때 2차 보호.
 *
 * 자식 페이지에서 명시적으로 metadata.robots 를 override 하지 않으면 이 값이
 * 상속됨. 명시적 override 가 필요한 케이스 (예: 공유용 OG 카드 페이지) 가
 * 생기면 자식에서 robots: { index: true } 로 덮어쓰기 가능.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // ConfirmProvider 는 useConfirm() hook 의 공급자. (main) 안에서만 mount —
  // app 컨텍스트 전용. web 페이지 (cart/checkout/products 등) 은 영향 없음.
  return (
    <AppChrome>
      <ConfirmProvider>{children}</ConfirmProvider>
    </AppChrome>
  )
}
