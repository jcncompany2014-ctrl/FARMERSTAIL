'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useIsStandalone } from '@/hooks/useIsStandalone'
import { hasSeenOnboarding, markOnboarded } from '@/lib/onboarding'
import { hasSupabaseSessionCookie } from '@/lib/auth/session-cookie'

/** 이 기기 브라우저에 로그인 세션 쿠키가 보이는가 — 동선 힌트(인증 아님). @supabase/ssr 쿠키는 httpOnly 가 아니라 읽힌다. */
function signedInHint(): boolean {
  try {
    return hasSupabaseSessionCookie(document.cookie.split(';').map((c) => c.trim().split('=')[0] ?? ''))
  } catch {
    return false
  }
}

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
    // 가게 링크로 앱이 처음 열린 경우(안드로이드 14 이하 앱 링크) — 첫 화면으로 덮지 않고 "가게는 웹에서 열려요"
    // 안내(app/store/layout, 규칙205)를 그대로 보여 준다. 손님은 가게를 찾아 링크를 눌렀다.
    if (pathname === '/store' || pathname.startsWith('/store/')) return
    // 링크 모음(인스타 프로필 링크)도 같다 — "링크 모음은 웹에서 열려요" 안내(app/link/layout, 규칙235)를 덮지 않는다.
    if (pathname === '/link') return
    if (hasSeenOnboarding()) return

    // ★표식을 **옮기기 전에** 남긴다(2026-10-13, 규칙201 — 에뮬레이터 재현 무한 왕복).
    //   예전엔 새 첫 화면(FirstScreenFlow)이 마운트될 때만 표식을 남겼다. 그런데 로그인한 사람은 /start 서버가 /dogs/new 로
    //   돌려보내(규칙62) 첫 화면에 닿지 못하고, 표식이 없는 채로 /dogs/new 에 온 관문이 다시 /start 로 — 끝없이 오갔다.
    //   새 첫 화면도 들어오자마자 같은 표식을 남기므로 순서만 앞당긴 것이다.
    markOnboarded()
    // 로그인한 사람(새 기기·앱 재설치)은 첫 화면이 필요 없다 — 표식만 남기고 지금 화면에 둔다.
    if (signedInHint()) return

    // 2026-10-09 앱 새 디자인: 첫 실행 = 새 첫 화면(/start — 이름부터 묻는 카드, 캔버스 Y1~). 예전엔 /welcome
    // 캐러셀이었다(지금은 앱스토어 사진용으로만 남는다).
    router.replace('/start')
  }, [standalone, pathname, router])

  return null
}
