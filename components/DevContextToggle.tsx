'use client'

import { useSyncExternalStore, type CSSProperties } from 'react'

/**
 * 🛠️ 개발 전용 웹↔앱 컨텍스트 토글 (화면 우하단).
 *
 * ft_app_preview(localStorage) + ft_app 쿠키를 동시에 바꾸고 이동 →
 * 클릭 한 번으로 WebChrome(웹) ↔ AppChrome(앱) 전환. middleware redirect
 * 타이밍 문제 없이 한 방에 바뀐다.
 *
 * production 에선 layout 의 NODE_ENV 가드로 렌더 자체가 안 됨(배포 영향 0).
 *
 * ── 삭제하려면: app/layout.tsx 의 <DevContextToggle/> 줄 + 이 파일만 지우면 끝. ──
 */

// SSR-safe 판정 — server snapshot 은 null 이라 hydration 직전엔 미렌더.
// useIsAppContext 와 동일 패턴(effect 에서 setState 금지하는 lint 룰 회피).
function subscribe(): () => void {
  return () => {}
}
function getSnapshot(): boolean | null {
  try {
    return window.localStorage.getItem('ft_app_preview') === '1'
  } catch {
    return false
  }
}
function getServerSnapshot(): boolean | null {
  return null
}

export default function DevContextToggle() {
  const isApp = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  if (isApp === null) return null // SSR / hydration 직전

  return (
    <div style={wrap}>
      <span style={tag}>DEV</span>
      <button type="button" onClick={() => go(false)} style={pill(!isApp)}>
        웹
      </button>
      <button type="button" onClick={() => go(true)} style={pill(isApp)}>
        앱
      </button>
    </div>
  )
}

function go(toApp: boolean) {
  try {
    window.localStorage.setItem('ft_app_preview', toApp ? '1' : '0')
  } catch {
    /* noop */
  }
  document.cookie = toApp
    ? 'ft_app=1; path=/; max-age=31536000; SameSite=Lax'
    : 'ft_app=; path=/; max-age=0; SameSite=Lax'
  window.location.href = toApp ? '/dashboard' : '/'
}

const wrap: CSSProperties = {
  position: 'fixed',
  right: 12,
  bottom: 12,
  zIndex: 2147483647,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: 4,
  paddingLeft: 10,
  borderRadius: 999,
  background: 'rgba(20,18,16,0.9)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  userSelect: 'none',
}

const tag: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.08em',
  color: 'rgba(255,255,255,0.5)',
  marginRight: 2,
}

function pill(active: boolean): CSSProperties {
  return {
    padding: '6px 14px',
    borderRadius: 999,
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    color: active ? '#141210' : 'rgba(255,255,255,0.85)',
    background: active ? '#fff' : 'transparent',
    transition: 'background 120ms, color 120ms',
  }
}
