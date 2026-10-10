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
 *
 * ★2026-10-09 앱 갈래 (앱 새 디자인 'A 포스터', 시안 B04) — 이 파일은 웹·앱 공용이다.
 * 웹 화면(아래 두 번째 return)은 한 픽셀도 바꾸지 않았다(웹/앱 절대 분리 — 웹 쪽 '500'·영어 머리말·
 * 문제 코드 정리는 웹 리뉴얼 때). 앱(네이티브·설치형 PWA)이면 앱 상태 화면을 그린다:
 * 휴대폰 그림 · "앱을 불러오지 못했어요" · 새로고침 · 홈으로 — 오류 번호·영어 없음(결정: 오류는 뜨는
 * 순간 자동 기록되니 고객에게 문제 코드를 보이지 않는다). 위 Sentry 호출은 두 갈래 공통.
 * 앱 판정: 정본 isAppRequest(ft_app 쿠키·UA 표식) + Capacitor 브리지. 서버가 그린 HTML 은 항상 웹
 * 갈래(서버 스냅숏 = 웹)이고 브라우저가 앱이면 곧바로 앱 갈래로 바뀐다. 클라이언트에서 처음 그려질
 * 때는 첫 그림부터 앱 갈래다(useSyncExternalStore — 웹 화면이 한 번 비치지 않는다).
 * 여기엔 globals.css·글꼴 변수가 없어 앱 갈래도 인라인 스타일뿐인 AppStatusScreen(standalone)을 쓴다.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import * as Sentry from '@sentry/nextjs'
import { RotateCw } from 'lucide-react'
import { isAppRequest } from '@/lib/app-context-request'
import { isNativeApp } from '@/lib/capacitor'
import { V3 } from '@/lib/design/tokens'
import AppStatusScreen from '@/components/v3/system/AppStatusScreen'
import { AppCrashIcon } from '@/components/v3/system/StatusIcons'

// FD 브랜드 토큰 inline mirror — globals.css 없이도 쓰려고 복제(루트 layout 붕괴
// 시엔 var(--fd-*) 가 안 잡힘). globals.css 가 바뀌면 여기도 수동으로 맞춰야 한다.
// (회차170: 옛 v4 warm-brown → FD 팔레트로 동기화. accent 는 흰 텍스트 AA pass.)
const TOKENS = {
  bg: '#F7F5F0', // --fd-offwhite
  text: '#173B33', // --fd-pine
  muted: '#5A6C61', // --fd-muted
  terracotta: '#B63619', // --fd-coral-text (흰 텍스트 버튼 배경, AA pass)
  rule: '#DCD6C4', // --fd-line
} as const

/** ft_app 쿠키 값(없으면 null) — 앱/웹 판정 자체는 정본 isAppRequest 가 한다(규칙58). */
function appCookieValue(): string | null {
  const hit = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('ft_app='))
  return hit ? hit.slice('ft_app='.length) : null
}

/** 앱(네이티브·설치형 PWA)인가 — 쿠키·UA 표식(정본) 또는 Capacitor 브리지. 못 읽으면 웹. */
function detectAppShell(): boolean {
  try {
    return isAppRequest({ appCookie: appCookieValue(), userAgent: navigator.userAgent }) || isNativeApp()
  } catch {
    return false
  }
}
// 쿠키·UA 는 이 화면이 떠 있는 동안 바뀌지 않는다 — 구독할 것이 없다.
const subscribeNothing = () => () => {}
const serverIsWeb = () => false

/** 앱 갈래 body — 흰 바탕·먹색(앱 새 디자인). 여기선 웹 글꼴이 안 실려 휴대폰 시스템 한글 글꼴로 그린다. */
const APP_BODY_STYLE = {
  margin: 0,
  backgroundColor: V3.paper,
  color: V3.ink,
  fontFamily:
    "'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif",
  letterSpacing: '-0.012em',
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

  const reload = () => {
    if (typeof window !== 'undefined') window.location.reload()
  }

  const isApp = useSyncExternalStore(subscribeNothing, detectAppShell, serverIsWeb)
  if (isApp) {
    return (
      <html lang="ko">
        <body style={APP_BODY_STYLE}>
          <AppStatusScreen
            frame="standalone"
            icon={<AppCrashIcon />}
            kicker="잠깐 멈췄어요"
            title={'앱을 불러오지\n못했어요'}
            body={'문제 내용은 저희에게 자동으로 전달돼요.\n새로고침해도 안 되면\n잠시 후 다시 열어 주세요.'}
            primary={{
              label: '새로고침',
              icon: <RotateCw size={20} strokeWidth={2.4} aria-hidden />,
              onClick: reload,
            }}
            // 루트 layout 이 무너진 자리라 라우터 이동이 아니라 전체 새로 불러오기(a 태그)로 홈에 간다.
            secondary={{ label: '홈으로 돌아가기', href: '/dashboard', fullReload: true }}
          />
        </body>
      </html>
    )
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
            새로고침으로 해결되지 않으면 문제 코드를 고객센터에 알려 주세요.
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
              <span>문제 코드 · {error.digest}</span>
              <button
                onClick={copyDigest}
                aria-label={copied ? '복사됨' : '문제 코드 복사'}
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
