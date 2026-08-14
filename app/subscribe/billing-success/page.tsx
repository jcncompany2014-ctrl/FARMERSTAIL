'use client'

import { Suspense, useEffect, useState } from 'react'
import { userFacingError } from '@/lib/error-message'
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
import {
  billingAuthFallbackHref,
  billingReturnHref,
} from '@/lib/payments/billing-urls'
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

/**
 * 이 authKey 로 교환에 성공했다는 기록 — **새로고침·뒤로가기 재교환 차단용.**
 *
 * # 왜 (2026-08-14 4라운드 감사)
 * authKey 는 **1회용**이라 두 번째 교환은 토스가 거절한다. 그런데 이 화면은
 * "등록 처리 중이에요 / 페이지를 닫지 마세요" 로 고객을 붙잡아 두므로 응답이
 * 조금만 늦어도 새로고침 유혹이 크고, iOS 는 bfcache 가 축출되면 **뒤로가기가
 * 곧 재실행**이다. 그러면 카드가 정상 등록됐는데도 '등록에 실패했어요' 가 뜬다 —
 * 고객은 실패한 줄 알고 다시 등록하거나 이탈한다.
 *
 * 서버에서 "빌링키가 있으니 성공으로 치자" 로 덮으면 **카드 교체 실패가
 * 은폐**된다(옛 카드가 그대로인데 새 카드로 바뀐 줄 안다). 그래서 판정은
 * 서버가 아니라 여기서, **정확히 같은 authKey 일 때만** 한다.
 *
 * sessionStorage 는 탭 범위·same-origin 이고, authKey 는 어차피 주소창과
 * 히스토리에 이미 있는 값이라 노출이 늘지 않는다.
 */
type IssuedMemo = {
  authKey: string
  brand: string | null
  last4: string | null
}

function issuedMemoKey(subscriptionId: string): string {
  return `ft-billing-issued:${subscriptionId}`
}

function readIssuedMemo(subscriptionId: string | null): IssuedMemo | null {
  if (!subscriptionId) return null
  try {
    const raw = sessionStorage.getItem(issuedMemoKey(subscriptionId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<IssuedMemo>
    return typeof parsed?.authKey === 'string'
      ? {
          authKey: parsed.authKey,
          brand: parsed.brand ?? null,
          last4: parsed.last4 ?? null,
        }
      : null
  } catch {
    // storage 차단·JSON 깨짐 — 기록이 없는 것과 같게 취급(교환을 시도한다).
    return null
  }
}

function writeIssuedMemo(subscriptionId: string, memo: IssuedMemo): void {
  try {
    sessionStorage.setItem(issuedMemoKey(subscriptionId), JSON.stringify(memo))
  } catch {
    /* storage 차단 — 재교환 가드만 없어지고 첫 등록은 정상 */
  }
}

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
  /**
   * 실패의 **종류**. 화면이 내밀 다음 행동이 서로 다르다.
   *  · 'auth'    — 로그인이 풀렸다. '다시 시도하기'는 같은 401 로 되돌아오므로
   *                내밀면 안 된다. 로그인이 1순위.
   *  · 'already' — 이미 등록된 결제수단이 있다. 재시도가 아니라 확인이 할 일.
   *  · 'retry'   — 그 외(네트워크·토스 오류). 기존대로 재시도.
   */
  const [failKind, setFailKind] = useState<'retry' | 'auth' | 'already'>('retry')

  useEffect(() => {
    if (isInvalidEntry) return

    let cancelled = false

    async function exchange() {
      try {
        // ★재교환 차단 — 이 authKey 로 이미 성공했으면 서버를 부르지 않는다.
        //   (authKey 는 1회용이라 두 번째 호출은 토스가 거절한다 → 정상 등록인데
        //    '등록에 실패했어요'.) IssuedMemo docstring 참조.
        const memo = readIssuedMemo(subscriptionId)
        if (memo && memo.authKey === authKey) {
          if (cancelled) return
          setCard({ brand: memo.brand, last4: memo.last4 })
          setStatus('succeeded')
          // 전환 이벤트는 다시 쏘지 않는다 — 같은 등록 1건이다.
          return
        }
        // ★타임아웃이 없으면 **영원히 기다린다**(2026-08-05 감사).
        //   이 화면은 "등록 처리 중이에요 / 페이지를 닫지 마세요"로 고객을
        //   붙잡아 놓는다. 응답이 안 오면 그 상태로 멈춘 채 아무 일도 안
        //   일어난다 — 돈이 걸린 화면에서 가장 나쁜 조합이다.
        //   결제 승인 쪽(checkout/success)은 이미 25초 타임아웃 + 원인별
        //   한국어 안내로 잘 짜여 있다. 그 패턴을 그대로 가져온다.
        const res = await fetch('/api/payments/billing-issue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            authKey,
            customerKey,
            subscriptionId,
            method: method.id,
          }),
          signal: AbortSignal.timeout(25_000),
        })
        const data = (await res.json()) as {
          ok?: boolean
          code?: string
          cardBrand?: string | null
          last4?: string | null
          message?: string
        }
        if (cancelled) return
        if (!res.ok || !data.ok) {
          setStatus('failed')
          setErrorMsg(data.message ?? '등록에 실패했어요')
          // 401 은 '다시 시도'가 구조적으로 안 통한다 — billing-auth 에는 인증
          // 검사가 없어 토스 창이 다시 뜨고, 돌아와서 또 401 이다(무한 왕복).
          setFailKind(
            res.status === 401
              ? 'auth'
              : data.code === 'ALREADY_REGISTERED'
                ? 'already'
                : 'retry',
          )
          return
        }
        setCard({ brand: data.cardBrand ?? null, last4: data.last4 ?? null })
        setStatus('succeeded')
        // 성공을 남긴다 — 새로고침·뒤로가기가 같은 authKey 로 재교환하지 않게.
        writeIssuedMemo(subscriptionId!, {
          authKey: authKey!,
          brand: data.cardBrand ?? null,
          last4: data.last4 ?? null,
        })
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
        // 타임아웃과 연결 실패를 가른다 — 고객이 할 일이 다르다.
        // 타임아웃은 서버에서 등록이 끝났을 수도 있어 "다시 시도"가 위험하다.
        const timedOut = e instanceof DOMException && e.name === 'TimeoutError'
        setErrorMsg(
          timedOut
            ? '등록 확인이 늦어지고 있어요. 정기배송 화면에서 결제수단이 등록됐는지 확인해 주세요.'
            : userFacingError(e, '네트워크가 불안정해요. 다시 시도해 주세요'),
        )
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
      {/* ★상태 전환을 SR 에 발표한다 (2026-08-07 a11y 감사).
          없으면 "등록 처리 중"만 듣고 성공/실패가 발표되지 않아 —
          실패를 모른 채 이탈하면 첫 배송이 스케줄되지 않는다.
          실패 분기는 assertive(즉시 끊고 알림), 나머지는 polite. */}
      <div
        className="text-center max-w-sm w-full"
        role={status === 'failed' ? 'alert' : 'status'}
        aria-live={status === 'failed' ? 'assertive' : 'polite'}
      >
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
              {failKind === 'auth'
                ? '로그인이 풀렸어요'
                : failKind === 'already'
                  ? '이미 등록돼 있어요'
                  : '등록에 실패했어요'}
            </p>
            <p
              className="text-[12px] mt-3 leading-relaxed"
              style={{ color: 'var(--muted)' }}
            >
              {errorMsg ?? '잠시 후 다시 시도해 주세요.'}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {/**
               * ★1순위 버튼을 실패 원인에 맞춘다 (2026-08-14 4라운드 감사).
               *
               * 전에는 어떤 실패든 '다시 시도하기'(→ billing-auth)가 1순위였다.
               * 그런데 세션이 끊겨 401 이 난 경우 billing-auth 에는 인증 검사가
               * 없어서 토스 창이 다시 뜨고, 돌아와 또 401 이 난다 — **화면
               * 어디에도 로그인 링크가 없어** 카드 등록이 무한 왕복이 됐다.
               * 결제 직전 단계라 여기서 막히면 그대로 이탈이다.
               *
               * next 는 **통째로 encodeURIComponent** 한다. 날것으로 붙이면
               * `&customerKey` 가 /login 의 형제 파라미터로 파싱돼 next 가
               * `?subscriptionId=..` 까지만 잘리고, billing-auth 의
               * isInvalidEntry 가 '잘못된 접근이에요' 라는 **새 막다른 길**을
               * 만든다(고치려다 더 나빠지는 형태).
               */}
              {failKind === 'auth' ? (
                <Link
                  href={
                    subscriptionId && customerKey
                      ? `/login?next=${encodeURIComponent(
                          billingAuthFallbackHref({
                            subscriptionId,
                            customerKey,
                          }),
                        )}`
                      : '/login'
                  }
                  className="w-full py-3 rounded-full text-[13px] font-bold text-center"
                  style={{ background: 'var(--ink)', color: 'var(--bg)' }}
                >
                  로그인하고 이어서 등록하기
                </Link>
              ) : failKind === 'already' ? (
                <Link
                  href={subsHref}
                  className="w-full py-3 rounded-full text-[13px] font-bold text-center"
                  style={{ background: 'var(--ink)', color: 'var(--bg)' }}
                >
                  등록된 결제수단 확인하기
                </Link>
              ) : (
                <Link
                  href={
                    subscriptionId && customerKey
                      ? billingAuthFallbackHref({ subscriptionId, customerKey })
                      : subsHref
                  }
                  className="w-full py-3 rounded-full text-[13px] font-bold text-center"
                  style={{ background: 'var(--ink)', color: 'var(--bg)' }}
                >
                  다시 시도하기
                </Link>
              )}
              {failKind !== 'already' && (
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
              )}
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
