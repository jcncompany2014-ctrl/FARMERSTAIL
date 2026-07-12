'use client'

/**
 * AppSplash — 설치형 PWA 첫 실행 시 전체화면 로고 모션 스플래시.
 *
 * 사장님(2026-07-13): "앱 처음 열 때 자연스러운 로고 모션 + 하단 점 3개".
 * 루트 layout 에 마운트되어 콜드 실행 1회 노출 후 페이드아웃한다. 클라이언트
 * 네비게이션엔 재노출 안 됨(root 는 remount 안 함) — '앱 첫 실행'만. 새로고침 =
 * 새 콜드 실행이라 다시 노출(네이티브 앱 스플래시와 동일 관용구).
 *
 * 게이트: display-mode standalone(설치형 PWA)에서만 노출 — 웹 브라우저 방문자는
 * 스킵(빠른 랜딩, SEO 무영향). SSR/hydration 은 아무것도 안 그리고(hidden),
 * 마운트 후 게이트 통과 시 등장 → 하이드레이션 mismatch 없음.
 *
 * 모션: ft-splash-logo(등장) + ft-splash-dot(하단 점) — globals.css. 전체화면이라
 * 헤더/탭바가 안 보여 '앱 스플래시'로 읽힌다(라우트 로딩 BrandLoader 와 다름).
 */
import { useEffect, useState } from 'react'

type Phase = 'hidden' | 'shown' | 'leaving'

const SHOW_MS = 1300
const FADE_MS = 440

export default function AppSplash() {
  const [phase, setPhase] = useState<Phase>('hidden')

  useEffect(() => {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true
    if (!standalone) return

    // 첫 setState 는 rAF 로 이펙트 밖에서(set-state-in-effect 룰 회피 + 페인트
    // 다음 프레임에 등장). 이후 전환은 timeout 콜백 안이라 규칙상 안전.
    const raf = requestAnimationFrame(() => setPhase('shown'))
    const leave = window.setTimeout(() => setPhase('leaving'), SHOW_MS)
    const done = window.setTimeout(
      () => setPhase('hidden'),
      SHOW_MS + FADE_MS,
    )
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(leave)
      window.clearTimeout(done)
    }
  }, [])

  if (phase === 'hidden') return null

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        opacity: phase === 'leaving' ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: phase === 'leaving' ? 'none' : 'auto',
      }}
    >
      {/* 헤더와 동일 워드마크. eslint-disable-next-line @next/next/no-img-element */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-ink.png"
        alt=""
        width={172}
        style={{
          width: 172,
          height: 'auto',
          animation: 'ft-splash-logo 1200ms cubic-bezier(0.22, 1, 0.36, 1) both',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 'calc(72px + env(safe-area-inset-bottom))',
          display: 'flex',
          gap: 7,
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: 'var(--terracotta)',
              animation: 'ft-splash-dot 1s ease-in-out infinite',
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
