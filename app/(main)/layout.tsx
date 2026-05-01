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
import AppChrome from '@/components/AppChrome'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppChrome>{children}</AppChrome>
}
