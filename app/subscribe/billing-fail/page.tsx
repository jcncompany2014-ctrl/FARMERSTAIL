'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { isUserCancelledPayment } from '@/lib/payments/cancel-detect'
import { billingReturnHref } from '@/lib/payments/billing-urls'
import { useIsAppContext } from '@/lib/app-context-client'

/**
 * /subscribe/billing-fail
 *
 * Toss billingAuth failUrl. 사용자가 등록 화면에서 취소하거나 실패한 케이스.
 * 친절한 안내 + 재시도 옵션.
 *
 * 문구는 수단 중립이어야 한다 — 토스페이로 등록하다 실패한 사람에게 "카드
 * 등록에 실패" 라고 하면 무슨 말인지 모른다 (2026-07-30 토스페이 추가).
 * '다시 시도하기'는 `method` 를 싣지 않아 **선택 화면으로** 돌아간다 — 실패한
 * 수단을 또 시도하게 만들지 않고 다른 수단으로 바꿀 수 있게.
 */

function BillingFailInner() {
  // 웹/앱 목적지가 다르다 — 앱 전용 경로로 보내면 웹 사용자가 '/app-required'
  // 벽을 맞는다(실패 화면에서 벽으로 이어지는 최악의 조합).
  const isApp = useIsAppContext()
  const params = useSearchParams()
  const code = params.get('code')
  const message = params.get('message')
  const subscriptionId = params.get('subscriptionId')
  const customerKey = params.get('customerKey')

  // 취소 판정은 코드·메시지를 함께 본다(lib/payments/cancel-detect) — 토스가
  // USER_CANCEL 대신 다른 취소 코드나 "취소되었습니다." 메시지만 보낼 때도
  // 실패처럼 보이지 않게. 실패 사유가 섞인 메시지는 그대로 실패로 남는다.
  const cancelled = isUserCancelledPayment({ code, message })
  const friendly = cancelled
    ? '등록을 취소하셨어요'
    : (message ?? '등록에 실패했어요')

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
          정기배송은 결제수단이 등록되어야 자동 결제가 진행돼요. 지금 다시
          시도하거나 마이페이지에서 나중에 등록할 수 있어요.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {/* billing-auth 는 customerKey 필수('잘못된 접근' 가드) — 둘 다 있을 때만
              원클릭 재시도. 없으면 구독 관리(키 재발급 경로)로 유도 (2026-07-03 감사). */}
          {subscriptionId && customerKey && (
            <Link
              href={`/subscribe/billing-auth?subscriptionId=${encodeURIComponent(subscriptionId)}&customerKey=${encodeURIComponent(customerKey)}`}
              className="w-full py-3 rounded-full text-[13px] font-bold text-center"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              다시 시도하기
            </Link>
          )}
          <Link
            href={billingReturnHref(isApp)}
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
