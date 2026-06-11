'use client'

import { useSyncExternalStore } from 'react'

/**
 * "App context" — 사용자가 PWA 설치본 또는 Capacitor 네이티브 앱 안에서 보고
 * 있는지 판정. 둘 다 true 면 "app", 둘 다 false 면 "web (브라우저)" 로 분류.
 *
 * 이 훅의 결과로:
 *   - 라우팅: 앱 전용 라우트 (/dashboard, /dogs/*, /mypage/* 등) 를 웹 사용자
 *     로부터 막을 때 client-side fallback 검증
 *   - UI: 웹용 헤더 (마켓컬리 톤) vs 앱용 chrome (모바일 폰) 구분
 *   - 쿠키 동기화: AppContextCookieSync 가 이 값을 보고 `ft_app` 쿠키 설정
 *
 * 권위 있는 판정은 server-side cookie 기반 (middleware) 가 한다 — 클라이언트
 * 훅은 보조 신호. SSR 시점엔 항상 null 반환 → 깜빡임 최소화 위해 호출처가
 * placeholder 렌더 책임.
 *
 * # 감지 신호 3종
 *
 *   1. `display-mode: standalone` 미디어쿼리 — Android Chrome / iOS Safari 의
 *      "홈 화면 추가" 로 설치된 PWA 가 standalone 으로 부팅된 경우
 *   2. `navigator.standalone` (iOS Safari 전용 — 비표준 prop. iPadOS 데스크톱
 *      모드는 Mac 으로 보고되니 별도 검사)
 *   3. `window.Capacitor.isNativePlatform()` — Capacitor WebView 가 주입한
 *      글로벌. iOS/Android 네이티브 앱 안에서만 true.
 */

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform: () => boolean
      getPlatform: () => 'ios' | 'android' | 'web'
    }
  }
}

// ── 개발 전용 미리보기 오버라이드 ────────────────────────────────────────
// PC 브라우저에서 앱 화면을 즉석 확인하기 위한 dev 훅 (디자인 작업용).
// URL 에 ?ft-app=1 (강제 app) / ?ft-app=0 (강제 web) 을 한 번 붙이면
// localStorage 에 기억돼 이후 모든 페이지에 유지된다. 값이 hook → 쿠키
// (AppContextCookieSync) 로 흘러가 server chrome dispatch 까지 일치.
// production 번들에선 NODE_ENV 인라인으로 dead-code 제거 — 운영 동작 불변.
const PREVIEW_KEY = 'ft_app_preview'

function devPreviewOverride(): boolean | null {
  if (process.env.NODE_ENV === 'production') return null
  if (typeof window === 'undefined') return null
  try {
    const q = new URLSearchParams(window.location.search).get('ft-app')
    if (q === '1' || q === '0') window.localStorage.setItem(PREVIEW_KEY, q)
    const stored = window.localStorage.getItem(PREVIEW_KEY)
    if (stored === '1') return true
    if (stored === '0') return false
  } catch {
    /* localStorage 차단 환경 — override 비활성 */
  }
  return null
}

function readAppContext(): boolean | null {
  if (typeof window === 'undefined') return null
  // 0) dev 미리보기 오버라이드 (?ft-app=1/0) — production 에선 항상 null
  const override = devPreviewOverride()
  if (override !== null) return override
  // 1) Capacitor — 가장 확실한 신호
  if (window.Capacitor?.isNativePlatform() === true) return true
  // 2) PWA standalone media query
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
  // 3) iOS Safari 비표준 standalone prop
  const iosStandalone = (
    window.navigator as Navigator & { standalone?: boolean }
  ).standalone
  return Boolean(standalone || iosStandalone)
}

function serverSnapshot(): boolean | null {
  return null
}

function subscribe(onChange: () => void): () => void {
  // display-mode 가 변경될 수 있는 케이스 (예: 사용자가 standalone 으로 전환)
  // 와 Capacitor 의 platform change (사실상 안 일어나지만 일관성)
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia?.('(display-mode: standalone)')
  if (!mq) return () => {}
  mq.addEventListener?.('change', onChange)
  return () => mq.removeEventListener?.('change', onChange)
}

/**
 * SSR 시 null, 클라 마운트 후 boolean. true = PWA 설치본 또는 Capacitor 앱.
 */
export function useIsAppContext(): boolean | null {
  return useSyncExternalStore(subscribe, readAppContext, serverSnapshot)
}
