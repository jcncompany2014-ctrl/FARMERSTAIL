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
  Home,
  Dog,
  Store,
  ShoppingCart,
  User,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import InstallPrompt from '@/components/InstallPrompt'
import SiteFooter from '@/components/SiteFooter'

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

  // Fetch cart count on mount / route change. This used to live inside the
  // (main) layout's auth-check effect — decoupling it here means /products
  // (outside (main)) can still show a correct badge when the user is
  // logged in. Silently no-ops for unauth users (query returns []).
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!mounted || !user) return
      const { data: items } = await supabase
        .from('cart_items')
        .select('quantity')
        .eq('user_id', user.id)
      const total = (items ?? []).reduce(
        (sum, it: { quantity: number }) => sum + it.quantity,
        0
      )
      if (mounted) setCartCount(total)
    })()
    return () => {
      mounted = false
    }
  }, [supabase, pathname])

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
    <div className="min-h-screen bg-bg">
      {/* 상단 헤더 */}
      <header
        className={`sticky top-0 z-40 bg-bg/90 backdrop-blur-xl transition-all duration-200 ${
          scrolled
            ? 'border-b border-rule shadow-[0_1px_0_rgba(0,0,0,0.02)]'
            : 'border-b border-transparent'
        }`}
      >
        <div className="max-w-md mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Farmer's Tail"
              className="h-12 w-auto"
              style={{ filter: 'brightness(0)' }}
            />
          </Link>
          <div className="flex items-center gap-1">
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
        {/* 법정 필수 표기 푸터 — 모든 내부 페이지 공통.
            하단 고정 탭바 위로 스크롤돼 올라오도록 <main> 안에 둔다. */}
        <SiteFooter />
      </main>

      {/* PWA 설치 프롬프트 — 스마트하게 한 번만 노출 */}
      <InstallPrompt />

      {/* 하단 탭 네비게이션 */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-rule"
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
    </div>
  )
}
