'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Tab = {
  href: string
  label: string
  icon: string
}

const TABS: Tab[] = [
  { href: '/dashboard', label: '홈', icon: '🏠' },
  { href: '/dogs', label: '강아지', icon: '🐕' },
  { href: '/products', label: '제품', icon: '🛍️' },
  { href: '/cart', label: '장바구니', icon: '🛒' },
  { href: '/mypage', label: '내 정보', icon: '👤' },
]

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [checking, setChecking] = useState(true)
  const [cartCount, setCartCount] = useState(0)
  const [scrolled, setScrolled] = useState(false)

  // 인증 체크
  useEffect(() => {
    let mounted = true
    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!mounted) return
      if (!user) {
        router.push('/login')
        return
      }
      setChecking(false)
      // 장바구니 개수 가져오기
      const { data: items } = await supabase
        .from('cart_items')
        .select('quantity')
        .eq('user_id', user.id)
      const total = (items ?? []).reduce(
        (sum, it: { quantity: number }) => sum + it.quantity,
        0
      )
      setCartCount(total)
    }
    check()
    return () => {
      mounted = false
    }
  }, [router, supabase, pathname])

  // 스크롤 감지
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 4)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F5F0E6]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#A0452E] border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-[#8A7668]">로딩 중...</div>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F0E6]">
      {/* 상단 헤더 */}
      <header
        className={`sticky top-0 z-40 bg-[#F5F0E6]/90 backdrop-blur-xl transition-all duration-200 ${
          scrolled
            ? 'border-b border-[#EDE6D8] shadow-[0_1px_0_rgba(0,0,0,0.02)]'
            : 'border-b border-transparent'
        }`}
      >
        <div className="max-w-md mx-auto px-5 h-14 flex items-center justify-between">
          <Link
  href="/dashboard"
  className="flex items-center"
>
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img
    src="/logo.png"
    alt="Farmer's Tail"
    className="h-10 w-auto"
  />
</Link>
          <div className="flex items-center gap-1">
            {/* 장바구니 바로가기 (헤더) */}
            <Link
              href="/cart"
              aria-label="장바구니"
              className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#EDE6D8] transition"
            >
              <span className="text-xl">🛒</span>
              {cartCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#A0452E] text-white text-[10px] font-bold flex items-center justify-center">
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
      </main>

      {/* 하단 탭 네비게이션 */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-[#EDE6D8]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-md mx-auto px-2 pt-2 pb-2 grid grid-cols-5 gap-0.5">
          {TABS.map((tab) => {
            const active =
              pathname === tab.href || pathname.startsWith(tab.href + '/')
            const isCart = tab.href === '/cart'

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition active:scale-95"
              >
                {/* 활성 인디케이터 */}
                <span
                  className={`absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full bg-[#A0452E] transition-all duration-200 ${
                    active ? 'w-6 opacity-100' : 'w-0 opacity-0'
                  }`}
                />

                <div className="relative">
                  <span
                    className={`text-[22px] leading-none block transition ${
                      active ? 'scale-110' : 'scale-100 opacity-60'
                    }`}
                  >
                    {tab.icon}
                  </span>
                  {/* 카트 뱃지 (탭바) */}
                  {isCart && cartCount > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[#A0452E] text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </div>

                <span
                  className={`mt-1 text-[10px] font-bold tracking-tight ${
                    active ? 'text-[#3D2B1F]' : 'text-[#8A7668]'
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}