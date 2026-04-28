'use client'

/**
 * Admin segment error boundary.
 *
 * 관리자 콘솔에서 render/effect 예외가 터졌을 때 쓰이는 fallback. 루트
 * error.tsx 는 고객 톤 (홈/고객센터 CTA) 이라 관리자 맥락에 맞지 않는다.
 * 여기선 "관리자 홈" 으로 빠져나가는 경로와 "다시 시도" 를 둔다.
 *
 * Sentry 태그에 segment='admin' 을 붙여 프로덕션에서 고객 경로와 섞이지 않게.
 */
import { useEffect } from 'react'
import { AlertOctagon } from 'lucide-react'
import * as Sentry from '@sentry/nextjs'
import { ErrorScreen } from '@/components/ui/ErrorScreen'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { segment: 'admin' },
    })
  }, [error])

  return (
    <ErrorScreen
      code="500"
      kicker="Admin · 콘솔에서 오류가 발생했어요"
      title="작업을 완료할 수 없어요"
      description="방금 수행한 작업이 저장되지 않았을 수 있어요. 목록에서 상태를 다시 확인해 주세요."
      icon={<AlertOctagon className="w-6 h-6" strokeWidth={2} aria-hidden />}
      tone="sale"
      primary={{ label: '다시 시도', onClick: reset }}
      secondary={{ label: '관리자 홈', href: '/admin' }}
      traceId={error.digest}
    />
  )
}
