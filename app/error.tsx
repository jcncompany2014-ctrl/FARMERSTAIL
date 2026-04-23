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
 */
import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import * as Sentry from '@sentry/nextjs'
import { ErrorScreen } from '@/components/ui/ErrorScreen'
import { business } from '@/lib/business'

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
    <ErrorScreen
      code="500"
      kicker="Oh Dear · 잠깐 멈췄어요"
      title="문제가 발생했어요"
      description="잠시 후 다시 시도해 주세요. 반복되면 오류 ID를 고객센터에 알려 주세요."
      icon={<AlertTriangle className="w-6 h-6" strokeWidth={2} aria-hidden />}
      tone="sale"
      primary={{ label: '다시 시도', onClick: reset }}
      secondary={{ label: '홈으로', href: '/' }}
      traceId={error.digest}
      footer={
        <>
          도움이 필요하신가요?{' '}
          <a
            href={`mailto:${business.email}`}
            className="font-bold underline underline-offset-2 text-terracotta"
          >
            고객센터 문의
          </a>
        </>
      }
    />
  )
}
