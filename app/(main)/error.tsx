'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, RotateCcw } from 'lucide-react'

/**
 * (main) 그룹 전용 error boundary.
 *
 * 이 그룹은 AppChrome 으로 감싸진 모바일 앱 영역 (dashboard / dogs / mypage / etc).
 * 루트 error.tsx 로 떨어지면 phone-frame 사라지고 풀폭 데스크톱 layout 으로 보여
 * UX 가 어그러짐. 여기에 자체 error UI 를 두어 chrome 톤 유지.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 운영 중 Sentry 활성화 시 자동으로 캡처됨 (instrumentation-client.ts).
    // 추가로 콘솔에 남겨 디버깅 단서 제공.
    console.error('[(main) error]', error)
  }, [error])

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-6 py-12">
      <div className="max-w-sm w-full text-center">
        <div
          className="mx-auto mb-5 w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: 'var(--bg-2)' }}
        >
          <AlertCircle
            className="w-6 h-6"
            strokeWidth={1.8}
            color="var(--terracotta)"
          />
        </div>
        <h1
          className="font-serif text-[20px] mb-2"
          style={{
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          문제가 생겼어요
        </h1>
        <p
          className="text-[12.5px] leading-relaxed mb-6"
          style={{ color: 'var(--muted)' }}
        >
          잠시 후 다시 시도해 주세요. 문제가 계속되면 아래 ‘홈으로’ 를 눌러
          처음부터 진행해 보세요.
        </p>
        {error.digest && (
          <p
            className="text-[10px] font-mono mb-5"
            style={{ color: 'var(--muted)', opacity: 0.6 }}
          >
            ref: {error.digest}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-1.5 w-full py-3 rounded-full font-bold text-[13px] transition active:scale-[0.97]"
            style={{
              background: 'var(--ink)',
              color: 'var(--bg)',
              letterSpacing: '-0.01em',
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={2.25} />
            다시 시도
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center w-full py-3 rounded-full font-bold text-[12.5px] transition active:scale-[0.97]"
            style={{
              background: 'transparent',
              color: 'var(--ink)',
              boxShadow: 'inset 0 0 0 1px var(--rule)',
            }}
          >
            홈으로
          </Link>
        </div>
      </div>
    </main>
  )
}
