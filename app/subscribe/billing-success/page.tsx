'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  trackSubscriptionBillingCompleted,
  trackPurchase,
  type AnalyticsItem,
} from '@/lib/analytics'
import { createClient } from '@/lib/supabase/client'
import {
  billingMethodFlags,
  resolveBillingMethod,
} from '@/lib/payments/billing-methods'
import { billingReturnHref } from '@/lib/payments/billing-urls'
import { useIsAppContext } from '@/lib/app-context-client'

/**
 * /subscribe/billing-success
 *
 * Toss billingAuth successUrl. query 로 `authKey`, `customerKey`, `subscriptionId`
 * 를 받아 서버에 영구 billingKey 교환 요청.
 *
 * billing-auth 가 심어 보낸 `method`(card | tosspay) 도 함께 온다 — 토스페이는
 * 카드사명·카드번호가 안 올 수 있어서 화면 문구와 저장 라벨이 "무엇으로
 * 등록했는지"를 알아야 한다. 값이 없거나 모르는 값이면 카드로 낙하한다.
 *
 * 사용자에게 보이는 화면:
 *   - exchanging: "등록 처리 중이에요" spinner
 *   - succeeded: "카드 등록 완료" / "토스페이 연결 완료" + 수단 정보 + CTA
 *   - failed: 에러 메시지 + "다시 시도하기" 링크(선택 화면으로 되돌아감)
 */

type Status = 'exchanging' | 'succeeded' | 'failed'

function BillingSuccessInner() {
  const params = useSearchParams()
  const router = useRouter()
  // 웹/앱 목적지가 다르다 — 앱 전용 경로로 보내면 웹 사용자가 '/app-required'
  // 벽을 맞는다(등록은 끝났는데 확인할 데가 없어진다).
  const isApp = useIsAppContext()
  const subsHref = billingReturnHref(isApp)
  const authKey = params.get('authKey')
  const customerKey = params.get('customerKey')
  const subscriptionId = params.get('subscriptionId')
  const method = resolveBillingMethod(params.get('method'), billingMethodFlags())

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
          body: JSON.stringify({
            authKey,
            customerKey,
            subscriptionId,
            method: method.id,
          }),
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
          setErrorMsg(data.message ?? '등록에 실패했어요')
          return
        }
        setCard({ brand: data.cardBrand ?? null, last4: data.last4 ?? null })
        setStatus('succeeded')
        // GA4 — Toss billing key 등록 성공. subscription_started 와 함께 funnel
        // 핵심 step (실제 매출이 시작되는 시점).
        trackSubscriptionBillingCompleted({
          subscriptionId: subscriptionId!,
          cardBrand: data.cardBrand ?? null,
        })
        // GA4/Meta 표준 purchase(전환) 이벤트 — 구독 첫 결제 완료. 광고 성과
        // 측정용(구 커스텀 이벤트만으론 전환 0). 결제 로직 무손상: 성공 확인
        // 후 구독 금액/구성만 조회해 발화하고, 트래킹 실패는 격리해 삼킨다.
        try {
          const supabase = createClient()
          const { data: sub } = await supabase
            .from('subscriptions')
            .select(
              'total_amount, subscription_items(product_id, product_name, quantity, unit_price)',
            )
            .eq('id', subscriptionId!)
            .single()
          if (sub && sub.total_amount && !cancelled) {
            const dedupKey = `ft-purchase-tracked-${subscriptionId}`
            let already = false
            try {
              already = !!sessionStorage.getItem(dedupKey)
              if (!already) sessionStorage.setItem(dedupKey, '1')
            } catch {
              /* storage 차단 — 그냥 1회 발화 */
            }
            if (!already) {
              const items: AnalyticsItem[] = (sub.subscription_items ?? []).map(
                (it) => ({
                  item_id: it.product_id,
                  item_name: it.product_name,
                  price: it.unit_price,
                  quantity: it.quantity,
                }),
              )
              trackPurchase({
                transactionId: subscriptionId!,
                value: sub.total_amount,
                items,
              })
            }
          }
        } catch {
          /* 트래킹 실패는 결제 성공에 영향 없음 */
        }
      } catch (e) {
        if (cancelled) return
        setStatus('failed')
        setErrorMsg(e instanceof Error ? e.message : '네트워크가 불안정해요. 다시 시도해 주세요')
      }
    }

    void exchange()
    return () => {
      cancelled = true
    }
  }, [authKey, customerKey, subscriptionId, isInvalidEntry, method.id])

  return (
    <main
      className="min-h-[100dvh] flex items-center justify-center px-6"
      style={{
        background: 'var(--bg)',
        // 짧은 화면(가로 모드·작은 폰)에서 내용이 가장자리에 붙지 않게.
        // safe-area 는 top-level 라우트라 AppChrome 이 안 챙겨 준다
        // (billing-auth 헤더가 같은 이유로 이미 inset 을 더하고 있다).
        paddingTop: 'calc(32px + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))',
      }}
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
              등록 처리 중이에요
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
              className="w-16 h-16 mx-auto mb-7 rounded-full flex items-center justify-center text-[26px]"
              style={{ background: 'var(--moss)', color: 'var(--bg)' }}
            >
              ✓
            </div>
            <p
              className="font-serif text-[23px] font-black leading-tight"
              style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
            >
              {method.doneTitle}
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
              className="text-[13px] leading-[1.75] mt-5"
              style={{ color: 'var(--text)' }}
            >
              다음 배송일에 {method.label}로 자동 결제돼요.
              <br />
              마이페이지에서 다음 결제 전까지 해지할 수 있어요.
            </p>
            <button
              type="button"
              onClick={() => router.push(`${subsHref}?new=1`)}
              className="mt-9 w-full py-4 rounded-full text-[13.5px] font-bold"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              내 정기배송 보기
            </button>
          </>
        )}

        {status === 'failed' && (
          <>
            <div
              className="w-16 h-16 mx-auto mb-7 rounded-full flex items-center justify-center text-[26px]"
              style={{ background: 'var(--sale)', color: 'var(--bg)' }}
            >
              !
            </div>
            <p
              className="font-serif text-[20px] font-black"
              style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
            >
              등록에 실패했어요
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
                    : subsHref
                }
                className="w-full py-3 rounded-full text-[13px] font-bold text-center"
                style={{ background: 'var(--ink)', color: 'var(--bg)' }}
              >
                다시 시도하기
              </Link>
              <Link
                href={subsHref}
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
          className="min-h-[100dvh] flex items-center justify-center"
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
