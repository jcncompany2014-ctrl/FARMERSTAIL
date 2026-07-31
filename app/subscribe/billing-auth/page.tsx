'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { openBillingWindow } from '@/lib/payments/open-billing-window'
import { ChevronLeft, X } from 'lucide-react'
import {
  availableBillingMethods,
  billingMethod,
  billingMethodFlags,
  resolveBillingMethod,
  type BillingMethodId,
} from '@/lib/payments/billing-methods'
import { isUserCancelledPayment } from '@/lib/payments/cancel-detect'
import { billingReturnHref } from '@/lib/payments/billing-urls'
import { useIsAppContext } from '@/lib/app-context-client'

/**
 * /subscribe/billing-auth — 자동결제 등록 화면 (카드 / 토스페이).
 *
 * 흐름:
 *   1) 진입점(주문 화면·구독 관리 등 5곳)이 구독 row 생성 + customerKey 발급 →
 *      이 페이지로 `?subscriptionId=X&customerKey=Y` 로 redirect.
 *   2) **고르기** — 수단이 둘 이상이면 선택 화면. 하나뿐이면 건너뛴다.
 *   3) **확인** — "다음"을 누르면 그때 토스 창을 띄운다.
 *   4) Toss 가 successUrl=/subscribe/billing-success 로 `?authKey=&customerKey=`
 *      를 붙여 redirect. 우리가 심은 `subscriptionId`·`method` 도 함께 실려온다.
 *   5) billing-success 가 /api/payments/billing-issue 호출 → billingKey 교환·저장.
 *
 * # ★ 왜 "다음" 버튼이 있나 (2026-07-30, 사장님 요청 + 기술적 필요)
 * 예전엔 화면에 들어오는 순간 `useEffect` 에서 토스를 자동 호출했다. 두 가지가
 * 문제였다:
 *  ① **iOS/사파리는 사용자 제스처 없는 화면 이동을 막을 수 있다.** 자동 호출은
 *     팝업·이동 차단에 걸릴 수 있고, 걸리면 고객은 멈춘 화면만 본다.
 *     버튼 클릭 안에서 호출하면 확실한 사용자 제스처가 된다.
 *  ② 아무 설명 없이 결제창으로 튕겨 나가는 느낌이 났다. 배민도 토스페이로 갈 때
 *     "다음을 눌러주세요" 화면을 한 번 거친다(사장님 제공 스크린샷).
 *
 * # 주소창에 대해
 * 홈 화면에 설치한 앱(PWA)에서 **다른 회사 도메인(토스)으로 이동하면 iOS 가
 * 도메인을 표시한다** — 피싱 방지용이라 우리가 끌 수 없다. 이 화면은 우리
 * 도메인이라 헤더를 우리가 그린다. 토스 화면 위 도메인 표시까지 없애려면
 * 네이티브 앱에서 웹뷰를 직접 띄워야 한다(NATIVE_APP_SETUP.md).
 *
 * 수단 정의·플래그·낙하 규칙은 전부 lib/payments/billing-methods 에 있다.
 * 진입점 5곳은 `method` 를 싣지 않는다 → resolveBillingMethod 가 카드로 낙하
 * 하므로 링크를 하나도 고치지 않아도 무손상이다.
 */

// 플래그는 빌드 시점 상수 — 컴포넌트마다 다시 읽을 이유가 없다.
const FLAGS = billingMethodFlags()
const AVAILABLE = availableBillingMethods(FLAGS)

function BillingAuthInner() {
  const router = useRouter()
  const isApp = useIsAppContext()
  const params = useSearchParams()
  const subscriptionId = params.get('subscriptionId')
  const customerKey = params.get('customerKey')
  const requestedMethod = params.get('method')

  // 잘못된 진입은 useState 의 initializer 로 derive — useEffect 안에서
  // 동기 setState 를 호출하면 React 19 `react-hooks/set-state-in-effect`
  // 룰이 cascading render 위험으로 막는다.
  const isInvalidEntry = !subscriptionId || !customerKey

  // 선택 화면을 건너뛰는 두 경우:
  //   · 수단이 하나뿐 (토스페이 꺼짐) → 바로 확인 화면
  //   · 이미 `?method=` 로 지정돼 들어옴 (재시도 링크 등)
  const onlyOne = AVAILABLE.length === 1
  const [chosen, setChosen] = useState<BillingMethodId | null>(
    !isInvalidEntry && (onlyOne || requestedMethod !== null)
      ? resolveBillingMethod(requestedMethod, FLAGS).id
      : null,
  )
  /** 지금 창을 여는 중인 수단. 두 번 눌러 창이 두 번 열리는 것도 이걸로 막는다. */
  const [launchingId, setLaunchingId] = useState<BillingMethodId | null>(null)
  const [error, setError] = useState<string | null>(
    isInvalidEntry ? '잘못된 접근이에요' : null,
  )

  /** 버튼 클릭 → 곧바로 토스 창. 이 클릭이 사용자 제스처다(docstring ① 참조). */
  async function launch(methodId: BillingMethodId) {
    if (launchingId) return
    setLaunchingId(methodId)
    try {
      // 주문 화면과 **같은 헬퍼**를 쓴다 — successUrl/failUrl 규칙이 두 곳에서
      // 갈리면 등록은 됐는데 빌링키가 안 남는 식으로 조용히 깨진다.
      await openBillingWindow({
        subscriptionId: subscriptionId!,
        customerKey: customerKey!,
        method: methodId,
      })
      // Toss SDK 가 화면을 넘긴다 — 정상 흐름은 여기 도달 안 함.
    } catch (e) {
      // 고객이 창을 닫은 것은 **실패가 아니다**. 예전엔 이걸 그대로 에러로 찍어서
      // 빨간 "취소되었습니다." 막다른 화면이 떴다(사장님 제보 2026-07-30).
      // 조용히 확인 화면으로 되돌려 다시 누르거나 다른 수단을 고를 수 있게 한다.
      if (isUserCancelledPayment(e)) {
        setLaunchingId(null)
        return
      }
      setError(e instanceof Error ? e.message : '등록 화면을 띄우지 못했어요')
      setLaunchingId(null)
    }
  }

  // ★ 웹/앱 목적지가 다르다. 이 화면은 top-level 이라 둘 다 들어오는데
  //   앱 전용 경로로 보내면 웹 사용자가 '/app-required' 벽을 맞는다
  //   (2026-07-30 — 카드 등록 끝에 "앱을 설치하세요"가 떴다).
  const close = () => router.push(billingReturnHref(isApp))
  const method = chosen ? billingMethod(chosen) : null
  // 선택 화면으로 되돌아갈 수 있을 때만 '뒤로'. 수단이 하나뿐이면 되돌아갈
  // 곳이 없으므로 닫기(✕)를 보여준다 — 앱에서 막다른 화살표는 혼란스럽다.
  const canGoBack = !!method && !onlyOne && !launchingId

  return (
    <main
      className="min-h-[100dvh] flex flex-col"
      style={{ background: 'var(--bg)' }}
    >
      {/* 우리 도메인 화면이므로 헤더를 우리가 그린다 — 앱에서 브라우저처럼
          보이지 않게. 토스 화면의 도메인 표시는 iOS 가 붙이는 것이라 별개다. */}
      {/* ★ safe-area 를 헤더에 더한다 (2026-07-30 누락 수정).
          홈 화면에 설치한 앱(standalone)은 상태바 아래로 화면이 시작하지 않는다 —
          노치·상태바가 이 헤더를 덮어 닫기(✕) 버튼이 반쯤 가려졌다. 앱 껍데기가
          아니라 top-level 라우트라 AppChrome 의 safe-area 처리를 못 받는다.
          웹 브라우저에서는 inset 이 0 이라 아무 변화가 없다. */}
      <header
        className="sticky top-0 z-10 flex items-center px-2"
        style={{
          background: 'var(--bg)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          // h-14(3.5rem) + 노치. 클래스로 두면 inline height 와 겹쳐 헷갈린다.
          height: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
        }}
      >
        <button
          type="button"
          onClick={canGoBack ? () => setChosen(null) : close}
          aria-label={canGoBack ? '결제수단 다시 고르기' : '닫기'}
          className="w-10 h-10 flex items-center justify-center rounded-full active:opacity-60"
          style={{ color: 'var(--ink)' }}
        >
          {canGoBack ? (
            <ChevronLeft size={22} strokeWidth={2.2} />
          ) : (
            <X size={20} strokeWidth={2.2} />
          )}
        </button>
        <span
          className="flex-1 text-center text-[15px] font-bold"
          style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}
        >
          결제하기
        </span>
        {/* 좌측 버튼과 폭을 맞춰 제목을 진짜 가운데로 */}
        <span className="w-10" aria-hidden />
      </header>

      <div className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm text-center">
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
                onClick={close}
                className="px-5 py-2.5 text-[13px] font-bold"
                style={{
                  background: 'var(--ink)',
                  color: 'var(--bg)',
                  borderRadius: 4,
                }}
              >
                구독 관리로 돌아가기
              </button>
            </>
          ) : !method ? (
            /* ── 고르기 = 곧바로 열기 ──────────────────────────────────
               예전엔 고른 뒤 "○○로 등록하려면 다음을 눌러주세요" 확인 화면을
               한 번 더 뒀다. 두 가지가 문제였다(사장님 2026-07-30):
                ① 그 문구가 **토스 자체 화면의 문구와 거의 같아서**, 우리
                   화면을 토스 화면으로 착각하게 만들었다("우리 앱 컬러로
                   나와버리는데 왜이래"). 남의 화면을 흉내내면 안 된다.
                ② 토스페이는 토스가 이미 같은 안내 화면을 띄운다 → '다음'을
                   두 번 누르게 된다.
               **버튼을 누르는 것 자체가 사용자 제스처**라, 여기서 바로 열어도
               iOS 이동 차단에 걸리지 않는다. 확인 화면은 없앴다. */
            <>
              <p
                className="text-[19px] font-black"
                style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}
              >
                결제수단을 골라주세요
              </p>
              <p
                className="text-[12px] mt-2 leading-relaxed"
                style={{ color: 'var(--muted)' }}
              >
                등록해두면 배송일마다 자동으로 결제돼요.
                <br />
                다음 결제 전까지 해지할 수 있어요.
              </p>
              <div className="mt-6 flex flex-col gap-2.5 text-left">
                {AVAILABLE.map((m) => {
                  // 토스페이는 **토스 브랜드 색**으로 — 카드와 나란히 두면
                  // 회색 카드 두 장이라 구분이 안 됐다(사장님 "너무 똑같애").
                  // 로고 이미지는 토스 브랜드 자산이라 임의로 만들지 않는다.
                  const brand = m.brandColor
                  const busy = launchingId === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => void launch(m.id)}
                      disabled={!!launchingId}
                      className="w-full px-5 py-4 border text-left transition-opacity active:opacity-70 disabled:opacity-60"
                      style={{
                        borderColor: brand ?? 'var(--rule)',
                        background: brand ?? 'transparent',
                        borderRadius: 4,
                      }}
                    >
                      <span
                        className="block text-[14px] font-bold"
                        style={{ color: brand ? '#fff' : 'var(--ink)' }}
                      >
                        {busy ? '여는 중이에요...' : m.label}
                      </span>
                      <span
                        className="block text-[11.5px] mt-1"
                        style={{
                          color: brand
                            ? 'rgba(255,255,255,0.82)'
                            : 'var(--muted)',
                        }}
                      >
                        {m.hint}
                      </span>
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={close}
                className="mt-5 text-[12px] underline"
                style={{ color: 'var(--muted)' }}
              >
                나중에 등록할게요
              </button>
            </>
          ) : (
            /* ── 수단이 하나뿐이거나 ?method= 로 지정돼 들어온 경우 ──
               고를 게 없어 클릭할 대상이 없다 → 열기 버튼 하나를 둔다.
               문구는 **우리 말투로** 쓴다(토스 화면 흉내 금지). */
            <>
              <p
                className="text-[19px] font-black"
                style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}
              >
                결제수단 등록
              </p>
              <p
                className="text-[12px] mt-2 leading-relaxed"
                style={{ color: 'var(--muted)' }}
              >
                {method.hint}.
                <br />
                등록만 하는 단계라 지금 결제되지 않아요.
              </p>
              <button
                type="button"
                onClick={() => void launch(method.id)}
                disabled={!!launchingId}
                className="mt-7 w-full py-4 text-[14px] font-bold disabled:opacity-60"
                style={{
                  background: method.brandColor ?? 'var(--ink)',
                  color: method.brandColor ? '#fff' : 'var(--bg)',
                  borderRadius: 4,
                }}
              >
                {launchingId ? '여는 중이에요...' : `${method.label} 등록하기`}
              </button>
              {!onlyOne && !launchingId && (
                <button
                  type="button"
                  onClick={() => setChosen(null)}
                  className="mt-4 text-[12px] underline"
                  style={{ color: 'var(--muted)' }}
                >
                  다른 결제수단으로
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}

export default function BillingAuthPage() {
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
      <BillingAuthInner />
    </Suspense>
  )
}
