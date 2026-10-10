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
 * 웹 화면(아래 두 번째 return)은 2026-10-10 웹 리뉴얼로 웹 시안 WEB-A31 모양('500'·영어 머리말 없음). 앱(네이티브·설치형 PWA)이면 앱 상태 화면을 그린다:
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
import { business } from '@/lib/business'
import { isNativeApp } from '@/lib/capacitor'
import { V3 } from '@/lib/design/tokens'
import AppStatusScreen from '@/components/v3/system/AppStatusScreen'
import { AppCrashIcon } from '@/components/v3/system/StatusIcons'

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

  // ── 웹 = 웹 시안 WEB-A31(2026-10-10 웹 리뉴얼) — 흰 바탕·먹색, 왼쪽 정렬. 여기엔 globals.css·글꼴 변수가 없어
  //    전부 인라인이고 제목은 시스템 굵은 글꼴이다. 문제 코드(복사)는 웹만 — 웹 손님은 고객센터에 코드를 불러 줄 수 있다.
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          backgroundColor: '#FFFFFF',
          color: '#141414',
          fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', 'Malgun Gothic', sans-serif",
          letterSpacing: '-0.02em',
          wordBreak: 'keep-all',
        }}
      >
        <main style={{ maxWidth: 480, margin: '0 auto', padding: '72px 20px 48px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          <span aria-hidden style={{ width: 72, height: 72, boxSizing: 'border-box', border: '2.5px solid #141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#141414" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="13" rx="1.5" />
              <path d="M9 21h6M12 17v4M9.5 8.5l5 5M14.5 8.5l-5 5" />
            </svg>
          </span>
          <span style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: '#595959' }}>
            <span aria-hidden style={{ width: 8, height: 8, background: '#141414' }} />
            잠깐 멈췄어요
          </span>
          <h1 style={{ margin: '10px 0 0', fontSize: 40, lineHeight: 1.12, fontWeight: 900, letterSpacing: '-0.03em' }}>
            화면을
            <br />
            불러오지 못했어요
          </h1>
          <p style={{ margin: '14px 0 0', fontSize: 18, lineHeight: 1.65, color: '#3D3D3D' }}>새로고침해도 안 되면 고객센터에 알려 주세요.</p>

          {error.digest && (
            <p style={{ margin: '14px 0 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, color: '#595959', overflowWrap: 'anywhere' }}>
              <span>
                문제 코드 <strong style={{ color: '#141414', userSelect: 'all' }}>{error.digest}</strong>
              </span>
              <button
                type="button"
                onClick={copyDigest}
                aria-label={copied ? '복사했어요' : '문제 코드 복사'}
                style={{ height: 32, padding: '0 10px', borderRadius: 4, border: '1.5px solid #141414', background: '#FFFFFF', color: '#141414', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
              >
                {copied ? '복사했어요' : '복사'}
              </button>
            </p>
          )}

          <button
            type="button"
            onClick={reload}
            style={{
              marginTop: 30,
              height: 60,
              border: 0,
              borderRadius: 4,
              background: '#141414',
              color: '#FFFFFF',
              fontFamily: 'inherit',
              fontSize: 18,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <RotateCw size={20} strokeWidth={2.4} aria-hidden />
            새로고침
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
              global-error는 root layout 붕괴 시 렌더되므로 Next RouterProvider
              자체가 없다. Link로는 SPA 전이가 불가능 → 의도적으로 <a>로 전체
              페이지 재로드. */}
          <a
            href="/"
            style={{ alignSelf: 'center', marginTop: 10, minHeight: 48, padding: '0 8px', display: 'flex', alignItems: 'center', fontSize: 17, fontWeight: 700, color: '#3D3D3D', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            홈으로 돌아가기
          </a>
          <div style={{ marginTop: 26, padding: 16, borderRadius: 4, background: '#F6F4F5', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 15, color: '#595959' }}>고객센터</span>
            <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <a href={`tel:${business.phone.replace(/[^\d+]/g, '')}`} style={{ fontSize: 24, fontWeight: 900, color: '#141414', textDecoration: 'none' }}>
                {business.phone}
              </a>
              <a href={`mailto:${business.email}`} style={{ fontSize: 16, color: '#3D3D3D' }}>
                {business.email}
              </a>
            </span>
          </div>
        </main>
      </body>
    </html>
  )
}
