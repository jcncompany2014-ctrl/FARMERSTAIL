'use client'

/**
 * Route-segment error boundary.
 *
 * Next가 라우트 세그먼트(page/layout/loading) 하위에서 render/effect 예외를
 * 잡으면 자동으로 이 파일로 fallback. Sentry React Error Boundary가 자동
 * 후킹되지만 안전망으로 명시 captureException도 한 번 더 호출 — 훅이 분리
 * 실패해도 알림이 누락되지 않게.
 *
 * UX: 사용자는 "다시 시도"를 누를 수 있고, 실패하면 홈/고객센터로 빠져나갈
 * 루트를 제공한다. digest는 지원 문의용 correlation id라 복사 가능하게 노출.
 *
 * 모양 = 웹 시안 WEB-A30(2026-10-10 웹 리뉴얼). 이 경계는 웹·앱이 같이 쓰는 최상위 경로에서 뜨고, 그 순간엔 앱인지
 * 알 수 없다(클라이언트 판정은 첫 그림에 비어 있다) — 그래서 가게 메뉴·장바구니 없이 로고만 있는 중립 화면으로 그린다
 * (앱 새 디자인도 같은 흰 바탕·먹색 포스터라 어느 쪽에서 떠도 어긋나지 않는다).
 */
import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import '@/components/store/store.css'

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="fts" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div className="fts-page" style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            height: 'calc(56px + env(safe-area-inset-top, 0px))',
            boxSizing: 'border-box',
            padding: 'env(safe-area-inset-top, 0px) 20px 0',
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid #E5E5E5',
          }}
        >
          <Link href="/" aria-label="파머스테일 홈" style={{ display: 'flex', alignItems: 'center', height: 48 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-ink.png" alt="파머스테일" width={105} height={18} style={{ height: 18, width: 'auto', display: 'block' }} />
          </Link>
        </header>
        <section role="alert" style={{ padding: '48px 20px 72px', display: 'flex', flexDirection: 'column' }}>
          <span aria-hidden style={{ width: 72, height: 72, boxSizing: 'border-box', border: '2.5px solid #B3261E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#B3261E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3.5l9.5 16.5h-19z" />
              <path d="M12 10v4.5M12 17.2v.3" />
            </svg>
          </span>
          <span style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: '#595959' }}>
            <span aria-hidden style={{ width: 8, height: 8, background: '#141414' }} />
            잠깐 멈췄어요
          </span>
          <h1 className="d" style={{ margin: '10px 0 0', fontSize: 42, lineHeight: 1.1 }}>
            문제가 생겼어요
          </h1>
          <p style={{ margin: '14px 0 0', fontSize: 18, lineHeight: 1.65, color: '#3D3D3D' }}>
            잠시 후 다시 시도해 주세요. 계속 이러면 아래 문제 코드와 함께 고객센터에 알려 주세요.
          </p>
          <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              onClick={retry}
              style={{
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />
              </svg>
              다시 시도
            </button>
            <Link
              href="/"
              style={{ height: 58, boxSizing: 'border-box', borderRadius: 4, border: '2px solid #141414', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#141414', textDecoration: 'none' }}
            >
              홈으로
            </Link>
          </div>
          {error.digest && (
            <p style={{ margin: '18px 0 0', fontSize: 15, color: '#595959', textAlign: 'center', overflowWrap: 'anywhere' }}>
              문제 코드 <span style={{ fontWeight: 800, color: '#141414', userSelect: 'all' }}>{error.digest}</span>
            </p>
          )}
          <p style={{ margin: '12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 16, color: '#595959' }}>
            도움이 필요하신가요?
            <Link
              href="/contact"
              style={{ minHeight: 48, padding: '0 4px', display: 'flex', alignItems: 'center', fontWeight: 800, color: '#141414', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              고객센터 문의
            </Link>
          </p>
        </section>
      </div>
    </main>
  )
}
