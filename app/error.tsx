'use client'

/**
 * Route-segment error boundary.
 *
 * Caught automatically when any component inside a route segment (page,
 * layout, loading) throws during render or effect phase. Sentry SDK has
 * its own React error boundary integration, so we don't need to manually
 * call captureException here — but we do it anyway as a safety net in
 * case the auto-hook is disabled or fails to attach.
 */
import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import * as Sentry from '@sentry/nextjs'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="min-h-[100dvh] bg-bg flex flex-col items-center justify-center px-6 py-12">
      <div className="w-16 h-16 rounded-full bg-sale/10 flex items-center justify-center text-sale">
        <AlertTriangle className="w-8 h-8" strokeWidth={2} />
      </div>

      <div className="mt-6 text-[10px] font-semibold text-muted uppercase tracking-[0.3em]">
        Something went wrong
      </div>
      <h1 className="mt-2 font-serif text-[22px] font-black text-text tracking-tight text-center">
        문제가 발생했어요
      </h1>
      <p className="mt-2 text-[12px] text-muted text-center leading-relaxed max-w-xs">
        잠시 후 다시 시도해 주세요. 문제가 계속되면 고객센터로 연락해 주세요.
      </p>

      {error.digest && (
        <p className="mt-3 text-[10px] font-mono text-muted">
          오류 ID · {error.digest}
        </p>
      )}

      <div className="mt-8 w-full max-w-xs space-y-2">
        <button
          onClick={reset}
          className="w-full py-3.5 rounded-xl bg-terracotta text-white text-[13px] font-black active:scale-[0.98] transition"
        >
          다시 시도
        </button>
        <Link
          href="/"
          className="block w-full text-center py-3.5 rounded-xl bg-white border border-rule text-[13px] font-bold text-[#5C4A3A] active:scale-[0.98] transition"
        >
          홈으로
        </Link>
      </div>
    </main>
  )
}
