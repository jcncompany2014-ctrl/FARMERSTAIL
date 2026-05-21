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
import MiniCartToast from '@/components/products/MiniCartToast'
import { WishlistProvider } from '@/components/products/WishlistContext'
import V3Ticker from '@/components/v3/V3Ticker'

type Tab = {
  href: string
  label: string
  Icon: LucideIcon
}

/**
 * 상단 헤더의 bell/cart 우상단 카운트 뱃지 — v3 톤.
 * 직사각형 (radius 8) + Mono 폰트 + accent bg + paperHi fg.
 */
function V3HeaderBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="absolute flex items-center justify-center"
      style={{
        top: 4,
        right: 4,
        minWidth: 18,
        height: 16,
        padding: '0 4px',
        borderRadius: 8,
        background: 'var(--accent)',
        color: 'var(--paper-hi)',
        fontFamily: "var(--font-mono, 'IBM Plex Mono'), 'JetBrains Mono', ui-monospace, monospace",
        fontSize: 9,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: 0,
      }}
    >
      {children}
    </span>
  )
}

const TABS: Tab[] = [
  { href: '/dashboard', label: '홈', Icon: Home },
  { href: '/dogs', label: '강아지', Icon: Dog },
  { href: '/products', label: '제품', Icon: Store },
  { href: '/cart', label: '장바구니', Icon: ShoppingCart },
  { href: '/mypage', label: '내 정보', Icon: User },
]

/**
 * 액션 집중 라우트 — 상단 header / 하단 nav 모두 hide. 설문 / 체크인 /
 * 처방 승인 같은 step-by-step 흐름에서 시각 부담 ↓. 사용자 피드백 반영.
 */
const FOCUS_PATHS = ['/survey', '/checkin', '/approve']

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const supabase = createClient()
  const focusMode = FOCUS_PATHS.some((p) => pathname.includes(p))

  const [cartCount, setCartCount] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // audit #99: 이전엔 pathname 변경마다 cart count fetch → 모든 라우트 이동 시
  // Supabase RTT 추가. cart 는 사용자 액션 (add-to-cart) 에서만 변함 — visibility
  // 복귀 + 'ft:cart:add' event 만 refetch.
  useEffect(() => {
    let mounted = true

    async function fetchCount() {
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

    void fetchCount()

    const onCartAdd = () => void fetchCount()
    // 다른 탭/디바이스에서 변경 가능 → visibility 복귀 시 invalidate.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchCount()
    }
    window.addEventListener('ft:cart:add', onCartAdd)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      mounted = false
      window.removeEventListener('ft:cart:add', onCartAdd)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // pathname 의도적 제외 — cart count 는 라우트 변경과 무관.
  }, [supabase])

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
      {/* 상단 헤더 v3 — Mono ticker + 기존 logo.png + ChromeStamp + bell/cart icons.
          focus mode (설문/체크인 등) 에서는 hide.
          [2026-05-22] 사용자 요청: BrandWordmark 워드마크 → 원래 logo.png 복구.
          ChromeStamp 도 같이 살아남 (좌측 1px terracotta hairline + 날짜). */}
      {!focusMode && (
      <header
        className="sticky top-0 z-40 transition-all duration-200"
        style={{
          background: scrolled
            ? 'color-mix(in srgb, var(--paper) 92%, transparent)'
            : 'var(--paper)',
          backdropFilter: scrolled ? 'blur(12px) saturate(140%)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px) saturate(140%)' : 'none',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div className="max-w-md mx-auto" style={{ paddingLeft: 20, paddingRight: 20 }}>
          {/* ── Top ticker row — "Thu 21 May · 19:01" + "Live" */}
          <div style={{ paddingTop: 10, paddingBottom: 4 }}>
            <V3Ticker />
          </div>

          {/* ── Main row — wordmark + bell/cart */}
          <div
            className="flex items-center justify-between"
            style={{ paddingTop: 6, paddingBottom: 12 }}
          >
            <Link
              href="/dashboard"
              className="flex items-center shrink-0"
              aria-label="홈"
              style={{ marginLeft: -4 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Farmer's Tail"
                className="h-10 w-auto"
                // LCP 후보 — 헤더 로고가 첫 viewport 가장 큰 가시 요소.
                fetchPriority="high"
                style={{ filter: 'var(--logo-filter, brightness(0))' }}
              />
            </Link>

            <div className="flex items-center" style={{ gap: 2, marginRight: -10 }}>
              <Link
                href="/notifications"
                onClick={handleBellClick}
                aria-label={unreadCount > 0 ? `알림 ${unreadCount}개` : '알림 센터'}
                className="relative flex items-center justify-center transition active:scale-90"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                }}
              >
                <Bell
                  style={{ width: 19, height: 19, color: 'var(--ink)' }}
                  strokeWidth={1.6}
                />
                {unreadCount > 0 && <V3HeaderBadge>{unreadCount > 99 ? '99+' : unreadCount}</V3HeaderBadge>}
              </Link>
              <Link
                href="/cart"
                aria-label="장바구니"
                className="relative flex items-center justify-center transition active:scale-90"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                }}
              >
                <ShoppingCart
                  style={{ width: 19, height: 19, color: 'var(--ink)' }}
                  strokeWidth={1.6}
                />
                {cartCount > 0 && <V3HeaderBadge>{cartCount > 99 ? '99+' : cartCount}</V3HeaderBadge>}
              </Link>
            </div>
          </div>
        </div>

        {/* ── 2px ink hairline — 매거진 마스트헤드의 시그니처 */}
        <div
          className="ft-rule-ink"
          style={{ marginLeft: 20, marginRight: 20 }}
          aria-hidden
        />
      </header>
      )}

      {/* 페이지 컨텐츠 — main padding-bottom 도 nav 키운 만큼 같이 키워야
          마지막 컨텐츠가 nav 에 가려지지 않음. nav 내부 = 8px tap padding +
          88px tab content + 12px home-bar gap.
          focus mode (설문 등) 에선 nav 가 없으니 padding 줄임. */}
      <main
        className={`max-w-md mx-auto ${
          focusMode
            ? 'pb-[env(safe-area-inset-bottom)]'
            : 'pb-[calc(100px+env(safe-area-inset-bottom))]'
        }`}
      >
        {children}
        {/* 앱 컨텍스트는 SiteFooter 숨김 — 사업자 정보 / 약관 / 환불정책 등은
            마이페이지 메뉴에서 진입. 매 페이지 하단에 노출되면 한국 앱 사용자
            UX 와 어긋남 (다른 앱들도 노출 안 함). 법적 표기는 /business,
            /legal/* 페이지 + 마이페이지 메뉴로 충분히 reachable. */}
      </main>

      {/* PWA 설치 프롬프트 — 스마트하게 한 번만 노출 */}
      <InstallPrompt />

      {/* 하단 탭 네비게이션 v3 — paperHi bg + 1px ink top hairline + 직각 모서리.
          활성 탭: 아이콘 ink (비활성 inkMute) + 라벨 bold + 16x2 accent 막대.
          focus mode (설문/체크인 등) 에서는 hide.

          data-cart-bottom-nav: globals.css 의 body.cart-cta-active 규칙이 이
          nav 만 translateY(100%) 로 밀어내 CartStickyCTA 와 swap. */}
      {!focusMode && (
      <nav
        data-cart-bottom-nav
        className="fixed bottom-0 left-0 right-0 z-40 md:left-1/2 md:right-auto md:w-full md:max-w-md md:-translate-x-1/2"
        style={{
          background: 'var(--paper-hi)',
          borderTop: '1px solid var(--ink)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
          paddingTop: 10,
          transition: 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="max-w-md mx-auto grid grid-cols-5" style={{ paddingLeft: 8, paddingRight: 8 }}>
          {TABS.map(({ href, label, Icon }) => {
            const active =
              pathname === href || pathname.startsWith(href + '/')
            const isCart = href === '/cart'

            return (
              <Link
                key={href}
                href={href}
                className="relative flex flex-col items-center justify-center transition active:scale-95"
                style={{ paddingTop: 4, paddingBottom: 2 }}
                aria-current={active ? 'page' : undefined}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    style={{
                      width: 22,
                      height: 22,
                      color: active ? 'var(--ink)' : 'var(--ink-mute)',
                      transition: 'color 200ms',
                    }}
                    strokeWidth={active ? 2 : 1.6}
                  />
                  {/* 카트 뱃지 v3 — 직사각형 Mono badge, accent bg + paperHi fg */}
                  {isCart && cartCount > 0 && (
                    <span
                      className="absolute flex items-center justify-center"
                      style={{
                        top: -4,
                        right: -7,
                        minWidth: 14,
                        height: 14,
                        padding: '0 3px',
                        borderRadius: 7,
                        background: 'var(--accent)',
                        color: 'var(--paper-hi)',
                        fontFamily: "var(--font-mono, 'IBM Plex Mono'), 'JetBrains Mono', ui-monospace, monospace",
                        fontSize: 8,
                        fontWeight: 700,
                        letterSpacing: 0,
                        lineHeight: 1,
                      }}
                    >
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </div>

                <span
                  style={{
                    marginTop: 4,
                    fontFamily: 'var(--font-sans)',
                    fontSize: 11,
                    fontWeight: active ? 700 : 500,
                    letterSpacing: '-0.005em',
                    color: active ? 'var(--ink)' : 'var(--ink-mute)',
                    transition: 'color 200ms',
                  }}
                >
                  {label}
                </span>

                {/* 활성 탭 — 16x2 accent 막대. 핸드오프의 시그니처 디테일. */}
                {active && (
                  <span
                    aria-hidden
                    style={{
                      width: 16,
                      height: 2,
                      marginTop: 3,
                      background: 'var(--accent)',
                    }}
                  />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
      )}

      {/* 전역 미니 카트 토스트 — 'ft:cart:add' 이벤트 listen */}
      <MiniCartToast />
    </div>
    </WishlistProvider>
  )
}
