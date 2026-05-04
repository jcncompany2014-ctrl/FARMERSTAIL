'use client'

/**
 * App-mode chrome: sticky top header w/ cart, bottom tab bar, InstallPrompt,
 * SiteFooter. This is the "installed PWA" shell — dense, mobile-first,
 * task-oriented.
 *
 * Extracted from app/(main)/layout.tsx so the same chrome can wrap pages
 * that live OUTSIDE the (main) auth group but still serve authenticated
 * users — notably /products, which must also be accessible to unauth
 * browsers (editorial mode handled by PublicPageShell). Route-level auth
 * gating remains the caller's responsibility; AppChrome itself assumes the
 * user is signed in and renders accordingly.
 */
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Bell,
  Home,
  Dog,
  Store,
  ShoppingCart,
  User,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import InstallPrompt from '@/components/InstallPrompt'
import ChromeStamp from '@/components/ChromeStamp'
import MiniCartToast from '@/components/products/MiniCartToast'
import { WishlistProvider } from '@/components/products/WishlistContext'

type Tab = {
  href: string
  label: string
  Icon: LucideIcon
}

const TABS: Tab[] = [
  { href: '/dashboard', label: '홈', Icon: Home },
  { href: '/dogs', label: '강아지', Icon: Dog },
  { href: '/products', label: '제품', Icon: Store },
  { href: '/cart', label: '장바구니', Icon: ShoppingCart },
  { href: '/mypage', label: '내 정보', Icon: User },
]

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const supabase = createClient()

  const [cartCount, setCartCount] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Fetch cart count on mount / route change AND on `ft:cart:add` event.
  // 이전: pathname change 만 트리거 → 같은 페이지에서 카트 담기 후 badge 안 변함.
  // 지금: ProductDetailClient 등 add-to-cart 가 dispatch 하는 'ft:cart:add'
  // 이벤트 listen 으로 즉시 refetch. 비로그인 / fetch 실패는 조용히 0 유지.
  useEffect(() => {
    let mounted = true

    async function fetchCount() {
      // getSession() — JWT 검증 RTT 회피 (50-100ms). cart 자체는 RLS 가
      // user_id 검증해 spoof 안전.
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const user = session?.user ?? null
      if (!mounted || !user) return
      const { data: items } = await supabase
        .from('cart_items')
        .select('quantity')
        .eq('user_id', user.id)
      const total = ((items ?? []) as { quantity: number }[]).reduce(
        (sum: number, it) => sum + it.quantity,
        0,
      )
      if (mounted) setCartCount(total)
    }

    fetchCount()

    const onCartAdd = () => fetchCount()
    window.addEventListener('ft:cart:add', onCartAdd)
    return () => {
      mounted = false
      window.removeEventListener('ft:cart:add', onCartAdd)
    }
  }, [supabase, pathname])

  // 알림 unread 카운트 — 라우트 전환마다 다시 가져온다 (사용자가 다른 탭에서
  // 주문 상태를 봤을 수도 있고, 마이페이지 진입으로 seen 처리됐을 수도 있음).
  // 비로그인 / 네트워크 실패는 조용히 0 처리 — 헤더가 깨지면 안 됨.
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/notifications/count', {
          cache: 'no-store',
        })
        if (!mounted || !res.ok) return
        const json = (await res.json()) as { count?: number }
        if (mounted) setUnreadCount(typeof json.count === 'number' ? json.count : 0)
      } catch {
        /* noop — header bell stays at last value */
      }
    })()
    return () => {
      mounted = false
    }
  }, [pathname])

  // Bell 클릭 시: optimistic 0 + 백그라운드로 seen 마킹. 네비게이션은 Link 가
  // 처리하므로 여기선 fire-and-forget POST 만.
  function handleBellClick() {
    setUnreadCount(0)
    fetch('/api/notifications/seen', {
      method: 'POST',
      cache: 'no-store',
    }).catch(() => {
      /* noop */
    })
  }

  // Top header gets a hairline + shadow once the user scrolls past the
  // viewport top — subtle separation from content without a heavy border
  // when the page is at rest.
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 4)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    // `phone-frame`: 데스크톱/태블릿(≥md)에서 이 래퍼를 "책상 위 폰"으로
    // 센터 정렬 + 그림자 부양 시킨다. 모바일(<md)에서는 규칙 전부 무시되어
    // 기존 full-bleed 경험 그대로. 상세 근거는 globals.css의 @media 블록
    // 주석 참고. 바깥 body도 --bg-2로 어두워져 "프레임 밖" 느낌이 산다.
    <WishlistProvider>
    <div className="phone-frame min-h-screen bg-bg" data-ft-chrome="app">
      {/* 상단 헤더 */}
      <header
        className={`sticky top-0 z-40 bg-bg/90 backdrop-blur-xl transition-all duration-200 ${
          scrolled
            ? 'border-b border-rule shadow-[0_1px_0_rgba(0,0,0,0.02)]'
            : 'border-b border-transparent'
        }`}
      >
        {/* 헤더 정렬 규칙 ─────────────────────────────────────────
            컨텐츠 본문은 전부 `max-w-md mx-auto px-5` 컬럼에 붙는다.
            헤더도 같은 컬럼을 쓰지만, 두 가지가 시각적 엣지를 어긋
            나게 만든다:
              1) `/logo.png` 안에 투명 여백이 있어 `<img>` 의 실제
                 레터글자 왼쪽이 ~8px 안쪽에서 시작.
              2) 장바구니 버튼이 `w-10 h-10` (40px) 히트 영역인데,
                 아이콘은 19px → 버튼 오른쪽 끝에서 ~10.5px 안쪽에
                 보임.
            둘 다 negative margin 으로 visual edge 를 컨텐츠 컬럼의
            padding box 에 맞춘다. Touch target (히트 영역) 은 그대로
            44px 확보 — 접근성/탭 편의 저해 없음. */}
        <div className="max-w-md mx-auto px-5 h-14 flex items-center justify-between">
          {/* 좌측: 로고 + 에디토리얼 데이트 스탬프.
              스탬프는 client island (lib/dateStamp 의 cached snapshot 사용) 라
              hydration 후에 채워지지만 `min-w` 로 자리 예약해 layout shift 없음. */}
          <div className="flex items-center -ml-2 min-w-0">
            <Link
              href="/dashboard"
              className="flex items-center shrink-0"
              aria-label="홈"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Farmer's Tail"
                className="h-11 w-auto"
                style={{ filter: 'brightness(0)' }}
              />
            </Link>
            <ChromeStamp />
          </div>

          {/* 우측: 알림 + 장바구니. 둘 다 40px 히트 영역 + 24px 시각 아이콘.
              Bell → /notifications (push_log + 주문 알림 합산). */}
          <div className="flex items-center gap-0.5 -mr-2.5 shrink-0">
            <Link
              href="/notifications"
              onClick={handleBellClick}
              aria-label={
                unreadCount > 0
                  ? `알림 ${unreadCount}개`
                  : '알림 센터'
              }
              className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-rule transition"
            >
              <Bell
                className="w-[19px] h-[19px] text-text"
                strokeWidth={1.75}
              />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-terracotta text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <Link
              href="/cart"
              aria-label="장바구니"
              className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-rule transition"
            >
              <ShoppingCart
                className="w-[19px] h-[19px] text-text"
                strokeWidth={1.75}
              />
              {cartCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-terracotta text-white text-[10px] font-bold flex items-center justify-center">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* 페이지 컨텐츠 */}
      <main className="max-w-md mx-auto pb-[calc(88px+env(safe-area-inset-bottom))]">
        {children}
        {/* 앱 컨텍스트는 SiteFooter 숨김 — 사업자 정보 / 약관 / 환불정책 등은
            마이페이지 메뉴에서 진입. 매 페이지 하단에 노출되면 한국 앱 사용자
            UX 와 어긋남 (다른 앱들도 노출 안 함). 법적 표기는 /business,
            /legal/* 페이지 + 마이페이지 메뉴로 충분히 reachable. */}
      </main>

      {/* PWA 설치 프롬프트 — 스마트하게 한 번만 노출 */}
      <InstallPrompt />

      {/* 하단 탭 네비게이션.
          모바일(<md): viewport 전폭으로 붙는다 (left-0 right-0).
          데스크톱(≥md): 폰 프레임 폭으로 재조준. `fixed` 자체는 viewport에
          고정시켜야 스크롤 상관없이 하단에 박히므로, frame 안에 containing-
          block을 만들지 않고 대신 이 nav를 직접 중앙 정렬한다.
          - `md:left-1/2 md:right-auto`: viewport 중앙에서 출발
          - `md:-translate-x-1/2`: 자기 폭의 절반만큼 왼쪽으로 당겨 센터링
          - `md:w-full md:max-w-md`: 프레임과 같은 폭(448px) 확보 */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-bg/95 backdrop-blur-xl border-t border-rule md:left-1/2 md:right-auto md:w-full md:max-w-md md:-translate-x-1/2 md:rounded-b-[inherit]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-md mx-auto px-2 pt-2 pb-2 grid grid-cols-5 gap-0.5">
          {TABS.map(({ href, label, Icon }) => {
            const active =
              pathname === href || pathname.startsWith(href + '/')
            const isCart = href === '/cart'

            return (
              <Link
                key={href}
                href={href}
                className="relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition active:scale-95"
              >
                {/* 활성 인디케이터 */}
                <span
                  className={`absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full bg-terracotta transition-all duration-200 ${
                    active ? 'w-6 opacity-100' : 'w-0 opacity-0'
                  }`}
                />

                <div className="relative">
                  <Icon
                    className={`w-[22px] h-[22px] transition ${
                      active ? 'text-text' : 'text-muted'
                    }`}
                    strokeWidth={active ? 2 : 1.5}
                  />
                  {/* 카트 뱃지 (탭바) */}
                  {isCart && cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-terracotta text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </div>

                <span
                  className={`mt-1 text-[10px] font-semibold tracking-tight ${
                    active ? 'text-text' : 'text-muted'
                  }`}
                >
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* 전역 미니 카트 토스트 — 'ft:cart:add' 이벤트 listen */}
      <MiniCartToast />
    </div>
    </WishlistProvider>
  )
}
