'use client'

/**
 * Root-level error boundary — catches errors thrown in the root layout
 * itself. Because the root layout failed, Next.js renders this file with
 * its own <html><body> (no layout wrapping), so we must re-declare them
 * and keep dependencies minimal (no fonts, no tailwind utility relying
 * on layout-level CSS var fonts).
 *
 * This is the absolute last line of defense — nothing above it can catch.
 * Always report to Sentry because the automatic integration lives inside
 * the tree that just blew up.
 */
import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backgroundColor: '#F5F0E6',
          color: '#3D2B1F',
          fontFamily:
            "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <div style={{ maxWidth: 360, textAlign: 'center' }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#8A7668',
              textTransform: 'uppercase',
              letterSpacing: '0.3em',
            }}
          >
            Critical Error
          </div>
          <h1
            style={{
              marginTop: 8,
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: '-0.01em',
            }}
          >
            앱을 불러오지 못했어요
          </h1>
          <p
            style={{
              marginTop: 8,
              fontSize: 12,
              color: '#8A7668',
              lineHeight: 1.6,
            }}
          >
            잠시 후 새로고침해 주세요. 문제가 계속되면 고객센터로
            연락해 주세요.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: 12,
                fontSize: 10,
                fontFamily: 'monospace',
                color: '#8A7668',
              }}
            >
              오류 ID · {error.digest}
            </p>
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
              background: '#A0452E',
              color: '#fff',
              fontSize: 13,
              fontWeight: 900,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            새로고침
          </button>
        </div>
      </body>
    </html>
  )
}
