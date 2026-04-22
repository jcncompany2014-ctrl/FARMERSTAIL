'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useIsStandalone } from '@/hooks/useIsStandalone'
import { hasSeenOnboarding } from '@/lib/onboarding'

/**
 * First-launch gate for the installed PWA.
 *
 * When the app is opened from the home screen (standalone mode) for the first
 * time on this device, redirects once to `/welcome`. Browser visits are left
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
    if (pathname.startsWith('/auth')) return
    if (pathname.startsWith('/api')) return
    if (pathname === '/offline') return
    if (hasSeenOnboarding()) return

    router.replace('/welcome')
  }, [standalone, pathname, router])

  return null
}
