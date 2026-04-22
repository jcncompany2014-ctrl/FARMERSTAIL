'use client'

import { useSyncExternalStore } from 'react'

/**
 * Detects whether the page is running as an installed PWA.
 *
 * Returns `null` during SSR (no window to inspect) and a boolean on the client.
 * Callers distinguishing "haven't checked" from "definitely browser" use that
 * nullability — an OnboardingGate seeing `false` knows this is a browser visit
 * and shouldn't redirect, but seeing `null` knows to wait.
 *
 * Uses `useSyncExternalStore` because display-mode is an external platform
 * state, not React-owned state. This is also the idiomatic way to read
 * platform state without tripping React 19's `set-state-in-effect` rule.
 *
 * Extracted from the ad-hoc `isStandalone()` inside InstallPrompt.tsx so both
 * the install banner and the onboarding gate read from one source of truth.
 */
function readStandalone(): boolean | null {
  if (typeof window === 'undefined') return null
  const mq = window.matchMedia?.('(display-mode: standalone)').matches
  // iOS Safari: non-standard flag. iPadOS in desktop-mode reports as Mac so
  // `navigator.standalone` is the only reliable PWA signal there.
  const iosStandalone = (
    window.navigator as Navigator & { standalone?: boolean }
  ).standalone
  return Boolean(mq || iosStandalone)
}

function serverSnapshot(): boolean | null {
  return null
}

function subscribe(onChange: () => void): () => void {
  // display-mode flips if the user promotes the tab to a home-screen shortcut
  // (or the reverse) while the page is open. Rare but worth supporting —
  // InstallPrompt relies on a standalone check that would otherwise go stale.
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia?.('(display-mode: standalone)')
  if (!mq) return () => {}
  mq.addEventListener?.('change', onChange)
  return () => mq.removeEventListener?.('change', onChange)
}

export function useIsStandalone(): boolean | null {
  return useSyncExternalStore(subscribe, readStandalone, serverSnapshot)
}
