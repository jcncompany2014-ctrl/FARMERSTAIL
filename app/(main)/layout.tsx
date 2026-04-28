'use client'

/**
 * (main) route group — auth-gated app shell.
 *
 * 본 그룹은 **앱 전용 라우트** 만 포함한다 (dashboard, dogs/*, mypage/*
 * 거의 전부, welcome 등). 웹/앱 양쪽에서 접근 가능한 라우트 (cart, checkout,
 * mypage/orders) 는 그룹 외부 (`app/cart`, `app/checkout`, `app/mypage/orders`) 로
 * 이동되어 WebChrome 으로 일관되게 wrap 된다.
 *
 * 이 layout 의 책임:
 *   1. 클라이언트 인증 체크 (UX 가드 — 미로그인이면 빠르게 /login redirect)
 *   2. AppChrome 으로 항상 wrap — 모바일 폰 프레임 + 하단 탭바 + InstallPrompt
 *
 * web 사용자가 앱 전용 라우트를 직접 입력하면 proxy.ts middleware 가
 * /app-required 로 redirect 한다 — 이 layout 까지 도달 안 함.
 */
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppChrome from '@/components/AppChrome'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [checking, setChecking] = useState(true)

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
    }
    check()
    return () => {
      mounted = false
    }
  }, [router, supabase, pathname])

  if (checking) {
    return (
      <main className="phone-frame min-h-screen flex items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-muted">로딩 중...</div>
        </div>
      </main>
    )
  }

  return <AppChrome>{children}</AppChrome>
}
