'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

/**
 * /subscribe/billing-fail
 *
 * Toss billingAuth failUrl. 사용자가 카드 등록 화면에서 취소하거나 실패한
 * 케이스. 친절한 안내 + 재시도 옵션.
 */

function BillingFailInner() {
  const params = useSearchParams()
  const code = params.get('code')
  const message = params.get('message')
  const subscriptionId = params.get('subscriptionId')

  const friendly =
    code === 'USER_CANCEL'
      ? '카드 등록을 취소하셨어요'
      : (message ?? '카드 등록에 실패했어요')

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="text-center max-w-sm w-full">
        <div
          className="w-14 h-14 mx-auto mb-5 rounded-full flex items-center justify-center text-2xl"
          style={{ background: 'var(--gold)', color: 'var(--ink)' }}
        >
          !
        </div>
        <p
          className="font-serif text-[20px] font-black"
          style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
        >
          {friendly}
        </p>
        <p
          className="text-[12px] mt-3 leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          정기배송은 카드가 등록되어야 자동 결제가 진행돼요. 지금 다시 시도하거나
          마이페이지에서 나중에 등록할 수 있어요.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {subscriptionId && (
            <Link
              href={`/subscribe/billing-auth?subscriptionId=${subscriptionId}`}
              className="w-full py-3 rounded-full text-[13px] font-bold text-center"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              다시 시도하기
            </Link>
          )}
          <Link
            href="/mypage/subscriptions"
            className="w-full py-3 rounded-full text-[13px] font-bold text-center border"
            style={{
              borderColor: 'var(--rule)',
              color: 'var(--text)',
            }}
          >
            구독 관리로 가기
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function BillingFailPage() {
  return (
    <Suspense
      fallback={
        <main
          className="min-h-screen flex items-center justify-center"
          style={{ background: 'var(--bg)' }}
        >
          <div
            className="w-10 h-10 border-2 rounded-full animate-spin"
            style={{
              borderColor: 'var(--terracotta)',
              borderTopColor: 'transparent',
            }}
          />
        </main>
      }
    >
      <BillingFailInner />
    </Suspense>
  )
}
