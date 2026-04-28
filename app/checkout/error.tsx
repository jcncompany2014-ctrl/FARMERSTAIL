'use client'

/**
 * Checkout segment error boundary.
 *
 * 결제 흐름에서 발생하는 render/effect 예외 전용 fallback. 루트 error.tsx 로만
 * 흘러가면 사용자가 "어디서 돈이 떨어졌는지" 맥락을 잃는다 — 이 경계는 장바구니
 * 로 돌아갈 루트를 primary 로 제공해서 "결제 재시도 or 장바구니 재확인" 중
 * 선택할 수 있게 한다.
 */
import { useEffect } from 'react'
import { CreditCard } from 'lucide-react'
import * as Sentry from '@sentry/nextjs'
import { ErrorScreen } from '@/components/ui/ErrorScreen'
import { business } from '@/lib/business'

export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { segment: 'checkout' },
    })
  }, [error])

  return (
    <ErrorScreen
      code="500"
      kicker="Checkout · 결제가 잠깐 멈췄어요"
      title="결제 페이지에 문제가 생겼어요"
      description="결제는 아직 진행되지 않았어요. 다시 시도하거나 장바구니에서 주문을 확인해 주세요."
      icon={<CreditCard className="w-6 h-6" strokeWidth={2} aria-hidden />}
      tone="sale"
      primary={{ label: '다시 시도', onClick: reset }}
      secondary={{ label: '장바구니로', href: '/cart' }}
      traceId={error.digest}
      footer={
        <>
          결제가 이미 진행됐을 수 있어요.{' '}
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
