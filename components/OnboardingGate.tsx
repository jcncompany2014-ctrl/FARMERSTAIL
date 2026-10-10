'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useIsStandalone } from '@/hooks/useIsStandalone'
import { hasSeenOnboarding } from '@/lib/onboarding'

/**
 * First-launch gate for the installed PWA.
 *
 * When the app is opened from the home screen (standalone mode) for the first
 * time on this device, redirects once to `/start` (2026-10-09 — the new first
 * screen; it used to be the `/welcome` carousel). Browser visits are left
 * alone — the editorial landing is the "web" experience, onboarding is the
 * "app" experience.
 *
 * Mounted once at the root layout. Renders nothing; only side effect is a
 * single `router.replace` on the first qualifying render.
 *
 * Known tradeoff: because detection happens in useEffect, the first frame on
 * a PWA launch may briefly render whatever page matched the URL before the
 * redirect lands. Acceptable for a once-per-install event; engineering it
 * out would require server-side display-mode awareness, which the platform
 * doesn't provide.
 */
export default function OnboardingGate() {
  const standalone = useIsStandalone()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (standalone !== true) return
    // Don't bounce if we're already on the onboarding flow or in a path where
    // a redirect would break a multi-step flow (OAuth callbacks, API calls,
    // offline fallback).
    if (pathname.startsWith('/welcome')) return
    if (pathname.startsWith('/start')) return
    if (pathname.startsWith('/login')) return
    if (pathname.startsWith('/onboarding')) return
    if (pathname.startsWith('/auth')) return
    if (pathname.startsWith('/api')) return
    if (pathname === '/offline') return
    if (hasSeenOnboarding()) return

    // 2026-10-09 앱 새 디자인: 첫 실행 = 새 첫 화면(/start — 이름부터 묻는 카드, 캔버스 Y1~). 예전엔 /welcome
    // 캐러셀이었다(지금은 앱스토어 사진용으로만 남는다). 새 첫 화면이 들어오자마자 첫 실행 표식을 남기고, 로그인한
    // 사람은 /start 가 서버에서 돌려보낸다(규칙62) — 그래서 여기서 로그인 여부를 따로 보지 않는다.
    router.replace('/start')
  }, [standalone, pathname, router])

  return null
}
