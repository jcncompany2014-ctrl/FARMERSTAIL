import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { billingMethod, type BillingMethodId } from './billing-methods'
import { billingRedirectUrls } from './billing-urls'

/**
 * 토스 자동결제 등록창을 띄운다. 호출부 두 곳이 같은 경로를 쓰게 하는 얇은 층.
 *
 *  · 주문 화면(`/dogs/[id]/order`) — 배송지와 함께 고른 수단으로 신청 버튼에서 직행
 *  · 등록 화면(`/subscribe/billing-auth`) — 재등록·마이페이지 진입 등
 *
 * # 왜 주문 화면은 중간 확인 화면 없이 바로 여는가 (사장님 2026-07-30)
 * 토스페이는 `flowMode: 'DIRECT'` 로 열면 토스가 **자체 안내 화면**("토스페이로
 * 결제하려면 다음을 눌러주세요" + 다음 버튼)을 이미 띄운다. 우리가 확인 화면을
 * 하나 더 두면 '다음'을 두 번 누르게 된다.
 *
 * # ★ iOS 제스처 — 반드시 클릭 핸들러 안에서 부를 것
 * iOS 는 사용자가 직접 누르지 않은 화면 이동을 막을 수 있다. `useEffect` 에서
 * 자동 호출하면 막히고, 막히면 고객은 멈춘 화면만 본다. 모바일에서 토스는
 * 같은 탭 이동(`windowTarget` 기본 'self')이라 팝업보다 관대하지만, 그래도
 * 클릭 안에서 부르는 것이 유일하게 안전한 방법이다.
 *
 * URL 규칙은 `billing-urls.ts`(순수함수 + 테스트)에 있다.
 */
export async function openBillingWindow(input: {
  subscriptionId: string
  customerKey: string
  method: BillingMethodId
}): Promise<void> {
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY
  if (!clientKey) {
    throw new Error(
      '결제 시스템이 설정되지 않았어요. 잠시 후 다시 시도해 주세요.',
    )
  }
  const tossPayments = await loadTossPayments(clientKey)
  const { successUrl, failUrl } = billingRedirectUrls({
    origin: window.location.origin,
    ...input,
  })
  // 비로그인(ANONYMOUS) 플로우 사용 안 함 — 본인 수단 등록은 customer 식별이
  // 필수. customerKey 는 server 가 발급한 UUID.
  const billing = tossPayments.payment({ customerKey: input.customerKey })
  await billing.requestBillingAuth({
    ...billingMethod(input.method).params,
    successUrl,
    failUrl,
  })
  // 정상 흐름에서는 토스가 화면을 넘기므로 여기 도달하지 않는다.
}
