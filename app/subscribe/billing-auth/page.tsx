'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useResetLoadingOnRestore } from '@/lib/useResetLoadingOnRestore'
import { userFacingError } from '@/lib/error-message'
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
import { weekdayKo } from '@/lib/shipping-schedule'
import {
  NO_CANCEL_CONSENT_LABEL,
  NO_CANCEL_CONSENT_VERSION,
  noCancelConsentBody,
} from '@/lib/payments/no-cancel-consent'

/**
 * /subscribe/billing-auth — 자동결제 등록 화면 (카드 전용).
 *
 * ★ 토스가 "빌링은 카드 등록 전용 — 계좌이체·간편결제 미지원"이라 확정(2026-08-11)
 *   → 제공 수단은 카드 하나. 아래 "고르기" 단계는 항상 건너뛰고 카드창이 바로
 *   열린다. (수단이 늘면 선택 화면이 되살아나도록 로직은 일반형으로 남겨둔다.)
 *
 * 흐름:
 *   1) 진입점(주문 화면·구독 관리 등 5곳)이 구독 row 생성 + customerKey 발급 →
 *      이 페이지로 `?subscriptionId=X&customerKey=Y` 로 redirect.
 *   2) **고르기** — 수단이 둘 이상이면 선택 화면. 하나뿐이면 건너뛴다(현재 카드 전용).
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

type BillingTerms = {
  amount: number | null
  discountLabel: string | null
  listAmount: number | null
  /** 첫 결제일 — 결제 시점(일반 = 조리 직전 토요일, 서포터즈 체험 구간 = 발송일)을 모르면 null(2026-10-01). */
  firstChargeDate: string | null
  /** 첫 발송일(화). 결제일을 모를 때 이것만 말한다. */
  firstShipDate?: string | null
  /** promotion(첫 박스만)·trial(체험 기간만)·tier(계속) — 2026-09-26 */
  discountKind?: 'promotion' | 'trial' | 'tier' | null
  recurringAmount?: number | null
  /** 다른 구독에 할인이 먼저 쓰일 수 있어 할인 전 금액으로 안내 — 2026-09-28 */
  oneTimeDeferred?: boolean
} | null

/** 첫 결제 금액이 한정 할인이라 그 뒤 반복 금액과 다른가. */
function hasOneTimeDiscount(terms: BillingTerms): boolean {
  return (
    (terms?.discountKind === 'promotion' || terms?.discountKind === 'trial') &&
    terms.recurringAmount != null &&
    terms.amount != null &&
    terms.recurringAmount !== terms.amount
  )
}

/**
 * ★결제 금액 한 줄 — 한정 할인이면 "첫 박스 X원"만, 반복 금액은 아래 안내 줄에서 말한다
 * (2026-09-26 출시 전 점검 5차). 예전엔 이벤트 첫 박스가를 "X원 · 2주마다"로 보여 줘
 * 2번째 박스부터 정상가가 나가는 걸 숨겼다.
 */
function termsAmountText(terms: BillingTerms): string {
  if (terms?.amount == null) return '주문 화면에서 확인한 금액 · 2주마다'
  if (hasOneTimeDiscount(terms)) {
    return `${terms!.discountKind === 'trial' ? '서포터즈 혜택가' : '첫 박스'} ${terms!.amount!.toLocaleString()}원`
  }
  return `${terms.amount.toLocaleString()}원 · 2주마다`
}

/** 할인 안내 + 반복 금액 + 동의 약속(실제 있는 범위만). */
function termsNoteText(terms: BillingTerms): string {
  const label = terms?.discountLabel
  const recurring =
    hasOneTimeDiscount(terms) && terms?.recurringAmount != null
      ? terms.discountKind === 'trial'
        ? // 고객 명칭은 '서포터즈'(사장님 2026-09-26). 3단(100원 → 반값 → 정상가)이라 반값 구간을 문장에 남긴다.
          `서포터즈 혜택(100원·반값)이 모두 끝나면 2주마다 ${terms.recurringAmount.toLocaleString()}원이에요. `
        : `${label ?? '이벤트 할인'}은 첫 박스에만 적용되고, 2번째 박스부터 2주마다 ${terms.recurringAmount.toLocaleString()}원이에요. `
      : label
        ? `${label}이 적용된 금액이에요. `
        : ''
  const deferred = terms?.oneTimeDeferred
    ? '다른 정기배송에 할인이 먼저 적용될 수 있어 할인 전 금액으로 안내해요. '
    : ''
  // 동의 게이트는 레시피 변경으로 금액이 바뀔 때(PriceChangeConsentModal)만 있다 — 그 범위만 약속한다.
  return `${deferred}${recurring}레시피가 바뀌어 금액이 달라지면 미리 알려드리고 동의를 받아요.`
}

/** '2026-10-10' → '10월 10일(토)'. */
function dateKo(iso: string): string {
  return `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일(${weekdayKo(iso)})`
}

/**
 * 첫 결제일 한 줄 (2026-10-01 일정 변경). 결제일은 고객마다 다르다 — 일반 = 발송 3일 전 토요일(조리 직전),
 * 서포터즈 체험 구간 = 발송일(화). 서버(billing-terms)가 결제 시점을 조회해 실제 결제일을 주고, 모르면 null 이다.
 * 모를 때 발송일을 '첫 결제'로 부르면 일반 고객에겐 틀린 날짜이고, 결제 요일을 추측하면 서포터즈에게 토요일이
 * 보일 수 있다 — 그래서 발송일만 말하고 결제는 "발송 전"으로만 말한다.
 * "이후 2주마다 같은 요일"은 쓰지 않는다 — 서포터즈는 혜택이 끝나면 결제 요일이 바뀐다(그때 따로 알린다).
 */
function firstChargeText(terms: BillingTerms): string {
  if (terms?.firstChargeDate) return `첫 결제 ${dateKo(terms.firstChargeDate)} · 이후 2주마다`
  if (terms?.firstShipDate) return `첫 박스 ${dateKo(terms.firstShipDate)} 발송 · 결제는 발송 전에 진행돼요`
  return '첫 결제는 첫 박스를 보내기 전에 진행돼요'
}

/**
 * 정기결제 고지 — **금액 · 주기 · 첫 결제일**.
 *
 * ★2026-08-12 4라운드 감사: 이 고지가 **결제수단 선택 화면 안에만** 있었다.
 * 그런데 2026-08-11 카드 전용으로 바꾸면서 선택 화면을 건너뛰게 됐다
 * (AVAILABLE.length === 1 → 곧바로 '등록하기' 화면). 즉 코드는 있는데
 * **도달 불가 분기에 있어 고객에게 한 번도 안 보였다.** 전자상거래법상 고지이고
 * 토스 정기결제 심사가 보는 화면이라, 카드 전용 화면에도 같은 컴포넌트를 렌더한다.
 * (선택 화면 쪽 인라인 블록은 그대로 두되, 새 화면은 이 정본을 쓴다 — 문구가
 *  갈라지면 어느 쪽이 맞는지 알 수 없게 되므로 다음 정리 때 둘을 합친다.)
 */
function RecurringTerms({ terms }: { terms: BillingTerms }) {
  return (
    <div
      className="mt-4 px-4 py-3 text-left"
      style={{ background: 'var(--bg-3)', border: '1px solid var(--rule)' }}
    >
      <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
        결제 금액
      </p>
      <p
        className="text-[15px] font-black mt-0.5"
        style={{ color: 'var(--ink)' }}
      >
        {terms?.amount != null && !hasOneTimeDiscount(terms) && terms.discountLabel && terms.listAmount != null && (
          <span
            className="mr-1.5 line-through"
            style={{ color: 'var(--muted)', fontWeight: 600 }}
          >
            {terms.listAmount.toLocaleString()}원
          </span>
        )}
        {termsAmountText(terms)}
      </p>
      <p
        className="text-[11.5px] mt-1.5 leading-relaxed"
        style={{ color: 'var(--muted)' }}
      >
        {firstChargeText(terms)}
        <br />
        {termsNoteText(terms)} 다음 결제 전까지 해지할 수 있어요.
      </p>
      {/* 법정 고지 링크 (2026-09-01 출시 전 감사) — 이 화면은 AuthAwareShell 을
          쓰지 않아 푸터가 없다. 전자상거래법 §13 은 결제 전에 읽을 수 있어야 한다.
          ★새 창으로 연다 — 카드 등록 **도중**이라 같은 창에서 나가면 흐름을 잃는다. */}
      <p
        className="text-[11px] mt-2.5 leading-relaxed"
        style={{ color: 'var(--muted)' }}
      >
        {[
          ['/legal/terms', '이용약관'],
          ['/legal/refund', '환불·청약철회'],
          ['/legal/privacy', '개인정보처리방침'],
        ].map(([href, label], i) => (
          <span key={href}>
            {i > 0 && <span aria-hidden="true"> · </span>}
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--muted)', textDecoration: 'underline', textUnderlineOffset: 2 }}
            >
              {label}
            </a>
          </span>
        ))}
      </p>
    </div>
  )
}

/**
 * 결제 후 취소 안내 — **필수 체크** (2026-10-02 사장님 A안).
 *
 * 주문 제작 재화의 청약철회 제한은 그 거래에 대한 별도 고지 + 고객 동의가 요건이다. 이 화면이 카드 등록(정기결제
 * 시작) 자리라 여기서 받는다 — 앱 주문 화면이 토스를 못 띄워 이 화면으로 넘어온 경우·카드 재등록도 여기를 거친다.
 * 문구·버전 정본 lib/payments/no-cancel-consent. 체크해야 등록 버튼이 열리고, 버전이 토스 왕복 주소를 타고
 * billing-issue 에서 카드 저장과 함께 기록된다.
 */
function NoCancelConsentCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      className="mt-4 px-4 py-3 flex items-start gap-2.5 text-left cursor-pointer select-none"
      style={{ background: 'var(--bg-3)', border: `1px solid ${checked ? 'var(--moss)' : 'var(--rule)'}` }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 shrink-0 cursor-pointer"
        style={{ width: 20, height: 20, accentColor: 'var(--moss)' }}
      />
      <span className="flex flex-col gap-1">
        <span className="text-[13px] font-bold" style={{ color: 'var(--ink)' }}>
          {NO_CANCEL_CONSENT_LABEL}
        </span>
        <span className="text-[11.5px] leading-relaxed" style={{ color: 'var(--muted)', wordBreak: 'keep-all' }}>
          {noCancelConsentBody()}
        </span>
      </span>
    </label>
  )
}

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
  /**
   * 정기결제 고지 — **금액 · 주기 · 첫 결제일**.
   *
   * ★왜 이 화면에 필요한가 (2026-08-07 법정 고지 감사)
   * 주문 화면에는 다 있는데(2주 결제 · 금액 · 첫 발송일), **실제로 자동결제
   * 수단을 등록하는 이 화면**엔 "배송일마다 자동으로 결제돼요" 한 줄뿐이었다.
   * 금액도, 주기(2주)도, 첫 결제일도 없다. 카드 등록 링크는 메일·푸시에서도
   * 바로 열리므로, 주문 화면을 안 거치고 여기로 오는 사람이 있다.
   * 전자상거래법상 정기결제 고지이고, 토스 PG 정기결제 심사가 보는 화면이다.
   */
  // ★BillingTerms 전체를 담는다(2026-09-28) — 예전 좁은 타입이 discountKind·recurringAmount 를
  //   버려서 '첫 박스만 할인, 2번째부터 N원' 안내가 한 번도 안 떴고, 이벤트 첫 박스가가
  //   '2주마다' 금액처럼 보였다(정기결제 동의 화면).
  const [terms, setTerms] = useState<BillingTerms>(null)

  useEffect(() => {
    if (isInvalidEntry) return
    let alive = true
    void (async () => {
      /**
       * ★할인 **후** 금액을 서버에서 받는다 (2026-08-08 금액 감사).
       *
       * 예전엔 여기서 `total_amount`(할인 전)를 직접 읽었다. 나무 등급
       * 고객은 화면이 153,100원이라 말하는데 실제로는 137,790원이 출금됐다 —
       * **정기결제 동의를 받는 자리**라 화면 금액과 실제 출금액이 달라선
       * 안 된다. 할인 계산(resolveAutoDiscount)은 서버 전용이라 라우트를
       * 경유한다 — 청구 크론과 같은 함수를 쓰므로 값이 갈라지지 않는다.
       */
      const res = await fetch(
        `/api/subscriptions/billing-terms?subscriptionId=${encodeURIComponent(subscriptionId!)}`,
      ).catch(() => null)
      if (!alive) return
      const data = res?.ok
        ? ((await res.json().catch(() => null)) as {
            amount?: number | null
            discountLabel?: string | null
            listAmount?: number | null
            firstChargeDate?: string | null
            firstShipDate?: string | null
            discountKind?: 'promotion' | 'trial' | 'tier' | null
            recurringAmount?: number | null
            oneTimeDeferred?: boolean
          } | null)
        : null
      if (!alive) return
      // 조회가 실패해도 등록은 막지 않는다 — 고지가 빠질 뿐이고, 그건
      // 아래에서 '금액은 주문 화면에서 확인' 문구로 대체한다.
      if (!data) {
        setTerms({
          amount: null,
          discountLabel: null,
          listAmount: null,
          firstChargeDate: null,
        })
        return
      }
      setTerms({
        amount: data.amount ?? null,
        discountLabel: data.discountLabel ?? null,
        listAmount: data.listAmount ?? null,
        // ★결제일을 모르면(null) 비워 둔다 — 예전엔 발송일(nextShipDate)로 채워 '첫 결제'라 불렀다.
        //   2026-10-01 부터 일반 고객은 발송 3일 전 토요일에 결제되므로 그건 틀린 날짜다(firstChargeText).
        firstChargeDate: data.firstChargeDate ?? null,
        firstShipDate: data.firstShipDate ?? null,
        discountKind: data.discountKind ?? null,
        recurringAmount: data.recurringAmount ?? null,
        oneTimeDeferred: data.oneTimeDeferred === true,
      })
    })()
    return () => {
      alive = false
    }
  }, [isInvalidEntry, subscriptionId])

  /** 지금 창을 여는 중인 수단. 두 번 눌러 창이 두 번 열리는 것도 이걸로 막는다. */
  const [launchingId, setLaunchingId] = useState<BillingMethodId | null>(null)
  // 토스 창에서 뒤로(스와이프·하드웨어) 돌아오면 캐시된 이 화면이 "여는 중이에요..."에 멈춰
  // 버튼을 다시 못 누른다 — 로그인 버튼과 같은 처리(2026-09-24 출시 전 점검).
  useResetLoadingOnRestore(useCallback(() => setLaunchingId(null), []))
  const [error, setError] = useState<string | null>(
    isInvalidEntry ? '잘못된 접근이에요' : null,
  )

  /** 결제 후 취소 안내 필수 동의(NoCancelConsentCheck). 기본 해제. */
  const [noCancelAgreed, setNoCancelAgreed] = useState(false)

  /** 버튼 클릭 → 곧바로 토스 창. 이 클릭이 사용자 제스처다(docstring ① 참조). */
  async function launch(methodId: BillingMethodId) {
    if (launchingId) return
    // 버튼이 막혀 있지만 한 번 더 — 동의 없이 카드 등록으로 넘어가지 않는다.
    // ⚠️ setError 를 쓰지 않는다: 이 화면의 error 는 화면 전체를 '돌아가기' 막다른 화면으로 바꾼다.
    if (!noCancelAgreed) return
    setLaunchingId(methodId)
    try {
      // 주문 화면과 **같은 헬퍼**를 쓴다 — successUrl/failUrl 규칙이 두 곳에서
      // 갈리면 등록은 됐는데 빌링키가 안 남는 식으로 조용히 깨진다.
      await openBillingWindow({
        subscriptionId: subscriptionId!,
        customerKey: customerKey!,
        method: methodId,
        noCancelConsent: NO_CANCEL_CONSENT_VERSION,
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
      setError(userFacingError(e, '등록 화면을 띄우지 못했어요'))
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
                정기배송 관리로 돌아가기
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
                등록해두면 <strong>2주마다</strong> 자동으로 결제돼요.
                <br />
                다음 결제 전까지 해지할 수 있어요.
              </p>

              {/* 정기결제 고지 — 금액 · 주기 · 첫 결제일 */}
              <div
                className="mt-4 px-4 py-3 text-left"
                style={{
                  background: 'var(--bg-3)',
                  border: '1px solid var(--rule)',
                }}
              >
                <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  결제 금액
                </p>
                <p
                  className="text-[15px] font-black mt-0.5"
                  style={{ color: 'var(--ink)' }}
                >
                  {terms?.amount != null && !hasOneTimeDiscount(terms) && terms.discountLabel && terms.listAmount != null && (
                    <span
                      className="mr-1.5 line-through"
                      style={{ color: 'var(--muted)', fontWeight: 600 }}
                    >
                      {terms.listAmount.toLocaleString()}원
                    </span>
                  )}
                  {termsAmountText(terms)}
                </p>
                <p
                  className="text-[11.5px] mt-1.5 leading-relaxed"
                  style={{ color: 'var(--muted)' }}
                >
                  {firstChargeText(terms)}
                  <br />
                  {termsNoteText(terms)}
                </p>
              </div>
              <NoCancelConsentCheck checked={noCancelAgreed} onChange={setNoCancelAgreed} />
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
                      disabled={!!launchingId || !noCancelAgreed}
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
              {/* ★법정 고지 — 이 화면이 실제로 카드를 등록하는 자리다.
                  선택 화면에만 있던 고지가 카드 전용 전환 후 도달 불가가 됐다. */}
              <RecurringTerms terms={terms} />
              <NoCancelConsentCheck checked={noCancelAgreed} onChange={setNoCancelAgreed} />
              <button
                type="button"
                onClick={() => void launch(method.id)}
                disabled={!!launchingId || !noCancelAgreed}
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
