'use client'

/**
 * (main) route group — auth-gated app shell.
 *
 * This layer's ONLY job is to gate: if the user isn't signed in, bounce
 * them to /login. The actual chrome (sticky header, tab bar, InstallPrompt,
 * SiteFooter) lives in <AppChrome> so the exact same visual shell can wrap
 * pages outside this group (e.g. /products, which also needs to render for
 * unauth visitors under an editorial shell). Keeping gate + chrome separate
 * avoids the prior situation where "make /products public" forced a
 * chrome rewrite.
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

  // 인증 체크 — unauth 방문자는 /login으로. pathname을 deps에 넣어
  // SPA 네비게이션으로 (main) 경로에 재진입할 때도 재검증한다
  // (세션 만료 / 로그아웃 이후 /dashboard 같은 보호 경로를 직접 타이핑)
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
    // `phone-frame`: 데스크톱에서 AppChrome이 렌더되기 전 로딩 중에도 프레임
    // 안에 스피너가 있어야 플래시(full-bleed → centered) 안 남는다.
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
