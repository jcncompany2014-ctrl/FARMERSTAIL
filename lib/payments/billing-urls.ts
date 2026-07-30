import type { BillingMethodId } from './billing-methods'

/**
 * 자동결제 등록 왕복 주소 — **순수함수만.** (SDK 를 import 하지 않는다: 그래야
 * node:test 가 브라우저 코드 없이 이 규칙을 검증할 수 있다. 실제 창을 띄우는
 * 쪽은 `open-billing-window.ts`.)
 *
 * # 왜 한 곳에 모았나
 * 호출부가 둘이다 — 주문 화면(배송지와 함께 고른 수단으로 직행)과 등록 화면
 * (재등록·마이페이지 진입). successUrl/failUrl 이 두 곳에서 갈리면 **결제가
 * 조용히 깨진다**: 등록은 됐는데 우리 DB 에 빌링키가 안 남거나, 실패 후
 * '다시 시도'가 막다른 길이 된다. 그래서 규칙을 여기 하나로 두고 테스트로 고정.
 */

/** 등록 후 토스가 돌아올 주소들. */
export function billingRedirectUrls(input: {
  origin: string
  subscriptionId: string
  customerKey: string
  method: BillingMethodId
}): { successUrl: string; failUrl: string } {
  const { origin, subscriptionId, customerKey, method } = input
  return {
    // ★ method 를 실어 보낸다 — 토스페이는 카드사명·카드번호가 안 올 수 있어서
    //   완료 화면과 저장 라벨이 "무엇으로 등록했는지"를 알아야 한다.
    successUrl:
      `${origin}/subscribe/billing-success` +
      `?subscriptionId=${encodeURIComponent(subscriptionId)}` +
      `&method=${encodeURIComponent(method)}`,
    // ★ customerKey 를 failUrl 에도 실어 보낸다 — 실패 페이지의 '다시 시도하기'가
    //   이 키 없이 billing-auth 로 돌아오면 '잘못된 접근' 막다른 길
    //   (2026-07-03 감사에서 실제로 그랬다).
    // method 는 일부러 안 싣는다: 실패 후엔 다른 수단으로 바꿀 수 있게
    // 선택 화면으로 돌아가는 것이 맞다.
    failUrl:
      `${origin}/subscribe/billing-fail` +
      `?subscriptionId=${encodeURIComponent(subscriptionId)}` +
      `&customerKey=${encodeURIComponent(customerKey)}`,
  }
}

/**
 * 등록을 마치거나 그만둘 때 돌아갈 **구독 화면** — 플랫폼별로 다르다.
 *
 * # ★ 왜 필요한가 — 웹에서 결제 도중 벽을 만났다 (2026-07-30)
 * `/subscribe/*` 세 화면(billing-auth·success·fail)은 **top-level** 이라 웹과 앱이
 * 함께 쓴다. 그런데 그 화면들의 "구독 관리로 돌아가기"가 전부
 * `/mypage/subscriptions` 로 갔다. 그 경로는 proxy.ts 의 `APP_ONLY_PREFIXES` 에
 * 있어서 **웹 사용자는 `/app-required` 로 튕긴다** — 브라우저에서 카드를 등록하던
 * 사람이 마지막에 "앱을 설치하세요" 벽을 맞는다. 등록은 성공했는데 확인할 방법이
 * 없는 상태다.
 *
 * 웹의 짝은 `/account/subscriptions` 다(웹 전용으로 남겨둔 화면).
 * AGENTS.md '웹/앱 절대 분리' — 반쪽만 분기하면 이렇게 된다.
 */
export function billingReturnHref(isApp: boolean): string {
  return isApp ? '/mypage/subscriptions' : '/account/subscriptions'
}

/**
 * 토스 창을 못 띄웠을 때 되돌아갈 곳 — '다음' 버튼이 있는 등록 화면.
 * (버튼 클릭이 곧 사용자 제스처라, 자동 실행이 막히는 환경에서도 뚫린다.)
 */
export function billingAuthFallbackHref(input: {
  subscriptionId: string
  customerKey: string
}): string {
  return (
    `/subscribe/billing-auth` +
    `?subscriptionId=${encodeURIComponent(input.subscriptionId)}` +
    `&customerKey=${encodeURIComponent(input.customerKey)}`
  )
}
