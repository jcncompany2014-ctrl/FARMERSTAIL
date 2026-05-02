'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

/**
 * /subscribe/billing-success
 *
 * Toss billingAuth successUrl. query 로 `authKey`, `customerKey`, `subscriptionId`
 * 를 받아 서버에 영구 billingKey 교환 요청.
 *
 * 사용자에게 보이는 화면:
 *   - exchanging: "카드 등록 중이에요" spinner
 *   - succeeded: "카드 등록 완료" + 카드 정보 + "구독 시작하기" CTA
 *   - failed: 에러 메시지 + "다시 시도하기" 링크
 */

type Status = 'exchanging' | 'succeeded' | 'failed'

function BillingSuccessInner() {
  const params = useSearchParams()
  const router = useRouter()
  const authKey = params.get('authKey')
  const customerKey = params.get('customerKey')
  const subscriptionId = params.get('subscriptionId')

  // 잘못된 진입을 useState initializer 에서 derive — useEffect 안에서 동기
  // setState 를 부르면 React 19 `react-hooks/set-state-in-effect` 룰이
  // cascading render 위험으로 막는다.
  const isInvalidEntry = !authKey || !customerKey || !subscriptionId
  const [status, setStatus] = useState<Status>(
    isInvalidEntry ? 'failed' : 'exchanging',
  )
  const [card, setCard] = useState<{ brand: string | null; last4: string | null } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(
    isInvalidEntry ? '잘못된 접근이에요' : null,
  )

  useEffect(() => {
    if (isInvalidEntry) return

    let cancelled = false

    async function exchange() {
      try {
        const res = await fetch('/api/payments/billing-issue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authKey, customerKey, subscriptionId }),
        })
        const data = (await res.json()) as {
          ok?: boolean
          cardBrand?: string | null
          last4?: string | null
          message?: string
        }
        if (cancelled) return
        if (!res.ok || !data.ok) {
          setStatus('failed')
          setErrorMsg(data.message ?? '카드 등록에 실패했어요')
          return
        }
        setCard({ brand: data.cardBrand ?? null, last4: data.last4 ?? null })
        setStatus('succeeded')
      } catch (e) {
        if (cancelled) return
        setStatus('failed')
        setErrorMsg(e instanceof Error ? e.message : '네트워크 오류')
      }
    }

    exchange()
    return () => {
      cancelled = true
    }
  }, [authKey, customerKey, subscriptionId, isInvalidEntry])

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="text-center max-w-sm w-full">
        {status === 'exchanging' && (
          <>
            <div
              className="w-10 h-10 mx-auto mb-4 border-2 rounded-full animate-spin"
              style={{
                borderColor: 'var(--terracotta)',
                borderTopColor: 'transparent',
              }}
            />
            <p
              className="text-[14px]"
              style={{ color: 'var(--text)', fontWeight: 700 }}
            >
              카드 등록 처리 중이에요
            </p>
            <p
              className="text-[11.5px] mt-1.5"
              style={{ color: 'var(--muted)' }}
            >
              잠시만 기다려 주세요. 페이지를 닫지 마세요.
            </p>
          </>
        )}

        {status === 'succeeded' && (
          <>
            <div
              className="w-14 h-14 mx-auto mb-5 rounded-full flex items-center justify-center text-2xl"
              style={{ background: 'var(--moss)', color: 'var(--bg)' }}
            >
              ✓
            </div>
            <p
              className="font-serif text-[22px] font-black"
              style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
            >
              카드 등록 완료
            </p>
            {(card?.brand || card?.last4) && (
              <p
                className="text-[12px] mt-2"
                style={{ color: 'var(--muted)' }}
              >
                {card.brand ? `${card.brand} ` : ''}
                {card.last4 ? `**** ${card.last4}` : ''}
              </p>
            )}
            <p
              className="text-[12.5px] leading-relaxed mt-4"
              style={{ color: 'var(--text)' }}
            >
              다음 배송일에 등록한 카드로 자동 결제돼요.
              <br />
              마이페이지에서 언제든 해지할 수 있어요.
            </p>
            <button
              type="button"
              onClick={() => router.push('/mypage/subscriptions?new=1')}
              className="mt-6 w-full py-3.5 rounded-full text-[13px] font-bold"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              내 정기배송 보기
            </button>
          </>
        )}

        {status === 'failed' && (
          <>
            <div
              className="w-14 h-14 mx-auto mb-5 rounded-full flex items-center justify-center text-2xl"
              style={{ background: 'var(--sale)', color: 'var(--bg)' }}
            >
              !
            </div>
            <p
              className="font-serif text-[20px] font-black"
              style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
            >
              카드 등록에 실패했어요
            </p>
            <p
              className="text-[12px] mt-3 leading-relaxed"
              style={{ color: 'var(--muted)' }}
            >
              {errorMsg ?? '잠시 후 다시 시도해 주세요.'}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                href={
                  subscriptionId
                    ? `/subscribe/billing-auth?subscriptionId=${subscriptionId}&customerKey=${customerKey ?? ''}`
                    : '/mypage/subscriptions'
                }
                className="w-full py-3 rounded-full text-[13px] font-bold text-center"
                style={{ background: 'var(--ink)', color: 'var(--bg)' }}
              >
                다시 시도하기
              </Link>
              <Link
                href="/mypage/subscriptions"
                className="w-full py-3 rounded-full text-[13px] font-bold text-center border"
                style={{
                  borderColor: 'var(--rule)',
                  color: 'var(--text)',
                }}
              >
                나중에 등록할게요
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

export default function BillingSuccessPage() {
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
      <BillingSuccessInner />
    </Suspense>
  )
}
