'use client'

import { useSyncExternalStore } from 'react'
import { isStandaloneApp } from '@/lib/standalone'

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
  // ★2026-08-22 — 판정을 lib/standalone 의 isStandaloneApp() **정본에 위임**.
  //
  //   예전엔 이 훅이 같은 로직을 복제하고 있었는데, 정본에 2026-08-08 들어간
  //   "Capacitor 네이티브 WebView 도 설치된 앱" 수정이 복제본엔 빠져 있었다.
  //   그래서 스토어에서 받은 네이티브 앱의 첫 실행이 브라우저 방문으로
  //   판정됐고, OnboardingGate 가 /welcome 온보딩으로 보내지 않아 **앱을
  //   켰는데 웹 랜딩이 떴다**(사장님이 v2 에서 재현한 문제의 마지막 조각).
  //   복제는 갈라진다 — 이제 정본이 고쳐지면 이 훅도 같이 고쳐진다.
  //   Capacitor 글로벌은 native-bridge 가 문서 시작 시점에 주입하므로
  //   하이드레이션 때 동기적으로 읽어도 안전하다.
  return isStandaloneApp()
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
