'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk'

/**
 * /subscribe/billing-auth — Toss 카드 등록 트리거 페이지.
 *
 * 흐름:
 *   1) /subscribe/[slug] 에서 구독 row 생성 + customerKey 발급 → 이 페이지로
 *      `?subscriptionId=X&customerKey=Y` 쿼리로 redirect.
 *   2) 본 페이지가 Toss SDK 로드 + `requestBillingAuth({ method: 'CARD' })` 호출.
 *   3) 사용자는 Toss 가 띄운 카드 등록 화면에서 카드정보 입력.
 *   4) Toss 가 successUrl=/subscribe/billing-success 로 `?authKey=xxx&customerKey=xxx`
 *      query 와 함께 redirect.
 *   5) billing-success 페이지가 /api/payments/billing-issue 호출 → billingKey
 *      교환 + DB 저장.
 *
 * 이 페이지는 SDK 가 자동으로 navigate 하므로 UI 는 진행 안내만.
 */

function BillingAuthInner() {
  const router = useRouter()
  const params = useSearchParams()
  const subscriptionId = params.get('subscriptionId')
  const customerKey = params.get('customerKey')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!subscriptionId || !customerKey) {
      setError('잘못된 접근이에요')
      return
    }

    let cancelled = false

    async function trigger() {
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY
      if (!clientKey) {
        setError('결제 시스템이 설정되지 않았어요. 잠시 후 다시 시도해 주세요.')
        return
      }
      try {
        const tossPayments = await loadTossPayments(clientKey)
        if (cancelled) return

        const origin = window.location.origin
        const successUrl =
          `${origin}/subscribe/billing-success` +
          `?subscriptionId=${encodeURIComponent(subscriptionId!)}`
        const failUrl =
          `${origin}/subscribe/billing-fail` +
          `?subscriptionId=${encodeURIComponent(subscriptionId!)}`

        // 비로그인 (= ANONYMOUS) 플로우 사용 안 함 — 본인 카드 등록은 customer
        // 식별이 필수. customerKey 는 server 가 발급한 UUID.
        const billing = tossPayments.payment({ customerKey: customerKey! })
        await billing.requestBillingAuth({
          method: 'CARD',
          successUrl,
          failUrl,
        })
        // Toss SDK 가 redirect — 여기 도달 안 함.
      } catch (e) {
        if (cancelled) return
        setError(
          e instanceof Error ? e.message : '카드 등록 화면을 띄우지 못했어요',
        )
      }
    }

    trigger()
    // ANONYMOUS 는 `loadTossPayments(ANONYMOUS)` 로 빈 함수 prevent — 실 사용 안 함.
    void ANONYMOUS

    return () => {
      cancelled = true
    }
  }, [subscriptionId, customerKey])

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="text-center max-w-sm">
        {error ? (
          <>
            <p
              className="text-[14px] font-bold mb-3"
              style={{ color: 'var(--sale)' }}
            >
              {error}
            </p>
            <button
              type="button"
              onClick={() => router.push('/mypage/subscriptions')}
              className="px-5 py-2.5 rounded-full text-[13px] font-bold"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              구독 관리로 돌아가기
            </button>
          </>
        ) : (
          <>
            <div
              className="w-10 h-10 mx-auto mb-4 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--terracotta)', borderTopColor: 'transparent' }}
            />
            <p
              className="text-[13px]"
              style={{ color: 'var(--text)', fontWeight: 700 }}
            >
              카드 등록 화면을 여는 중이에요...
            </p>
            <p
              className="text-[11.5px] mt-1.5"
              style={{ color: 'var(--muted)' }}
            >
              잠시만 기다려 주세요. 자동으로 결제 화면으로 이동돼요.
            </p>
          </>
        )}
      </div>
    </main>
  )
}

export default function BillingAuthPage() {
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
      <BillingAuthInner />
    </Suspense>
  )
}
