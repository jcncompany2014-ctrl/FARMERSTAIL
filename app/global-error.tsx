'use client'

/**
 * Root-level error boundary — catches errors thrown in the root layout
 * itself.
 *
 * Because the root layout failed, Next.js renders this file with its own
 * `<html><body>` (no layout wrapping). That means:
 *   - globals.css is NOT loaded. CSS variables (--bg, --terracotta, ...)
 *     are unavailable. Inline hex values are fine here.
 *   - Tailwind utility classes still work in Next 16 (shipped via CSS
 *     layer that attaches without the root layout), but to be extra safe
 *     when the app is *really* broken, everything below is inline-styled.
 *   - next/font variables are unavailable — fall back to Pretendard web
 *     font stack and system fonts.
 *
 * This is the absolute last line of defense. Always report to Sentry
 * because the automatic integration lives inside the tree that just
 * blew up.
 */
import { useEffect, useState } from 'react'
import * as Sentry from '@sentry/nextjs'

// 브랜드 토큰 inline mirror — globals.css 없이도 쓰려고 복제.
// globals.css가 바뀌면 여기도 수동으로 맞춰야 한다.
const TOKENS = {
  bg: '#F5F0E6',
  text: '#3D2B1F',
  muted: '#8A7668',
  terracotta: '#A0452E',
  rule: '#D9CFBB',
} as const

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  const [copied, setCopied] = useState(false)
  const copyDigest = async () => {
    if (!error.digest) return
    try {
      await navigator.clipboard.writeText(error.digest)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 클립보드 권한 거부 시 무시 — 사용자가 수동 복사 가능.
    }
  }

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: TOKENS.bg,
          color: TOKENS.text,
          fontFamily:
            "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', 'Malgun Gothic', sans-serif",
          letterSpacing: '-0.005em',
        }}
      >
        <div style={{ maxWidth: 360, width: '100%', textAlign: 'center' }}>
          {/* Oversized code numeral — layout CSS가 없어도 시각적 계층은 생긴다. */}
          <div
            aria-hidden
            style={{
              fontSize: 88,
              lineHeight: 1,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: 'rgba(30,26,20,0.08)',
              fontVariantNumeric: 'tabular-nums',
              userSelect: 'none',
            }}
          >
            500
          </div>

          <div
            style={{
              marginTop: 16,
              fontSize: 10,
              fontWeight: 600,
              color: TOKENS.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.22em',
            }}
          >
            Critical Error · 잠깐 멈췄어요
          </div>
          <h1
            style={{
              marginTop: 6,
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: '-0.01em',
              wordBreak: 'keep-all',
            }}
          >
            앱을 불러오지 못했어요
          </h1>
          <p
            style={{
              marginTop: 8,
              fontSize: 13,
              color: TOKENS.muted,
              lineHeight: 1.6,
              wordBreak: 'keep-all',
            }}
          >
            새로고침으로 해결되지 않으면 오류 ID를 고객센터에 알려 주세요.
          </p>

          {error.digest && (
            <div
              style={{
                marginTop: 12,
                fontSize: 10.5,
                fontFamily:
                  "'JetBrains Mono', ui-monospace, 'SF Mono', Consolas, monospace",
                color: TOKENS.muted,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>오류 ID · {error.digest}</span>
              <button
                onClick={copyDigest}
                aria-label={copied ? '복사됨' : '오류 ID 복사'}
                style={{
                  width: 20,
                  height: 20,
                  padding: 0,
                  borderRadius: 4,
                  border: 'none',
                  background: 'transparent',
                  color: copied ? '#6B7F3A' : TOKENS.muted,
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {copied ? '✓' : '⎘'}
              </button>
            </div>
          )}

          <button
            onClick={() => {
              if (typeof window !== 'undefined') window.location.reload()
            }}
            style={{
              marginTop: 24,
              width: '100%',
              padding: '14px 0',
              borderRadius: 12,
              background: TOKENS.terracotta,
              color: '#fff',
              fontSize: 13,
              fontWeight: 900,
              border: 'none',
              cursor: 'pointer',
              letterSpacing: '-0.01em',
            }}
          >
            새로고침
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
              global-error는 root layout 붕괴 시 렌더되므로 Next RouterProvider
              자체가 없다. Link로는 SPA 전이가 불가능 → 의도적으로 <a>로 전체
              페이지 재로드. */}
          <a
            href="/"
            style={{
              display: 'inline-block',
              marginTop: 12,
              fontSize: 12.5,
              color: TOKENS.muted,
              textDecoration: 'underline',
              textUnderlineOffset: 2,
            }}
          >
            홈으로 돌아가기
          </a>
        </div>
        {/* Hair rule bottom accent — 에디토리얼 감성 유지. */}
        <div
          aria-hidden
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: 1,
            background: TOKENS.rule,
          }}
        />
      </body>
    </html>
  )
}
