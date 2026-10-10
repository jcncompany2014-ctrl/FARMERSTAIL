'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { NATIVE_BACK_EVENT } from '@/lib/native-back'
import { isUserCancelledPayment } from '@/lib/payments/cancel-detect'
import { billingFailMessage } from '@/lib/payments/billing-fail-message'
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { billingReturnHref } from '@/lib/payments/billing-urls'
import { useIsAppContext } from '@/lib/app-context-client'
import { useServerAppContext } from '@/components/app/ServerAppContext'
import WebResultScreen, { WebResultAction } from '@/components/store/WebResultScreen'
import AppResultScreen, { ResultAction } from '@/components/v3/billing/AppResultScreen'
import { V3 } from '@/lib/design/tokens'

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
  // 모양만 — 서버 판정(app/subscribe/layout.tsx). 이동 주소도 함께 본다(클라이언트 판정은 마운트 직후 잠깐 false).
  const appLook = useServerAppContext()
  const params = useSearchParams()
  const router = useRouter()
  // 안드로이드 뒤로가기 — 토스 창으로 되돌아가지 않고 정기배송 화면으로(2026-09-24 점검).
  useEffect(() => {
    const onBack = (event: Event) => {
      event.preventDefault()
      router.replace(billingReturnHref(isApp || appLook))
    }
    window.addEventListener(NATIVE_BACK_EVENT, onBack)
    return () => window.removeEventListener(NATIVE_BACK_EVENT, onBack)
  }, [router, isApp, appLook])
  const code = params.get('code')
  const message = params.get('message')
  const subscriptionId = params.get('subscriptionId')
  const customerKey = params.get('customerKey')

  // 취소 판정은 코드·메시지를 함께 본다(lib/payments/cancel-detect) — 토스가
  // USER_CANCEL 대신 다른 취소 코드나 "취소되었습니다." 메시지만 보낼 때도
  // 실패처럼 보이지 않게. 실패 사유가 섞인 메시지는 그대로 실패로 남는다.
  const cancelled = isUserCancelledPayment({ code, message })
  // 토스는 message 에 코드를 붙여 보낸다(사장님 실기기: 'A0: 카드번호 오류').
  // 그대로 렌더하면 결제 첫 관문에서 개발자 문자열이 노출된다 — 고객 말로 바꾼다.
  const friendly = cancelled ? '등록을 취소하셨어요' : billingFailMessage({ code, message })

  // 화면에서만 지우고 진단은 남긴다 — 어떤 코드로 실패했는지 못 보면 고칠 수 없다.
  useEffect(() => {
    if (cancelled) return
    Sentry.captureMessage('billing auth failed', {
      level: 'warning',
      tags: { step: 'billing_auth_fail', tossCode: code ?? 'none' },
      extra: { tossMessage: message ?? null },
    })
  }, [cancelled, code, message])

  if (appLook) {
    // ── 앱 모양(캔버스 S37) — 문구 판정·이동 주소는 아래 웹과 같다. 앱엔 '마이페이지'가 없어(앱시안 결정 3번
    //    '동작') 하단 탭 이름 '정기배송'으로 말한다. ────────────────────────────────────────────────
    return (
      <AppResultScreen
        alert={!cancelled}
        mark="card"
        // 큰 제목이라 끝 마침표는 뗀다(시안 S37) — 문장 자체는 웹과 같은 billingFailMessage.
        title={friendly.replace(/\.$/, '')}
        body={
          <span style={{ color: V3.inkSoft }}>
            정기배송은 결제수단이 등록되어야 자동 결제가 진행돼요. 지금 다시 시도하거나 정기배송 화면에서 나중에 등록할 수
            있어요.
          </span>
        }
        actions={
          <>
            {/* billing-auth 는 customerKey 필수 — 둘 다 있을 때만 원클릭 재시도(웹과 같은 조건). */}
            {subscriptionId && customerKey && (
              <ResultAction
                primary
                href={`/subscribe/billing-auth?subscriptionId=${encodeURIComponent(subscriptionId)}&customerKey=${encodeURIComponent(customerKey)}`}
              >
                다시 시도하기
              </ResultAction>
            )}
            <ResultAction primary={!(subscriptionId && customerKey)} href={billingReturnHref(true)}>
              정기배송으로 가기
            </ResultAction>
          </>
        }
      />
    )
  }

  // ── 웹 모양(웹 시안 WEB-A26, 2026-10-10 웹 리뉴얼) — 문구 판정·이동 주소는 위 앱 갈래와 같다. 웹은 '정기배송 관리'.
  return (
    <WebResultScreen
      alert={!cancelled}
      mark="card"
      closeHref={billingReturnHref(isApp)}
      // 큰 제목이라 끝 마침표는 뗀다 — 문장 자체는 앱과 같은 billingFailMessage.
      title={friendly.replace(/\.$/, '')}
      body="정기배송은 결제수단이 등록되어야 자동 결제가 진행돼요. 지금 다시 시도하거나, 정기배송 관리에서 나중에 등록할 수 있어요."
      actions={
        <>
          {/* billing-auth 는 customerKey 필수('잘못된 접근' 가드) — 둘 다 있을 때만 원클릭 재시도. 없으면 구독 관리(키 재발급 경로)로(2026-07-03 감사). */}
          {subscriptionId && customerKey && (
            <WebResultAction
              primary
              href={`/subscribe/billing-auth?subscriptionId=${encodeURIComponent(subscriptionId)}&customerKey=${encodeURIComponent(customerKey)}`}
            >
              다시 시도하기
            </WebResultAction>
          )}
          <WebResultAction primary={!(subscriptionId && customerKey)} href={billingReturnHref(isApp)}>
            구독 관리로 가기
          </WebResultAction>
        </>
      }
    />
  )
}

export default function BillingFailPage() {
  // 기다리는 동안 흰 바탕·먹색 원 — 앱 새 디자인·웹 리뉴얼(2026-10-10) 둘 다.
  return (
    <Suspense
      fallback={
        <main
          className="min-h-[100dvh] flex items-center justify-center"
          style={{ background: '#FFFFFF' }}
        >
          <div
            className="w-10 h-10 border-2 rounded-full animate-spin"
            style={{
              borderColor: V3.ink,
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
