/**
 * 웹 가게 결제위젯 키 고르기(브라우저 쪽) — 서버 쪽 비밀 키는 lib/payments/toss tossSecretKey('widget').
 * 위젯 계약 전(토스 일반결제 심사 중)에는 운영에 키가 없다 → null 이면 주문서가 '결제 준비 중'을 보인다.
 * 미리보기·로컬은 토스가 문서에 공개한 테스트 키(돈이 나가지 않는다)로 흐름을 끝까지 시험한다.
 */
import { createHash } from 'node:crypto'
import { TOSS_DOCS_TEST_WIDGET_CLIENT_KEY } from '../payments/toss.ts'

export function widgetClientKey(): string | null {
  const k = process.env.NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY
  if (k) return k
  return process.env.VERCEL_ENV === 'production' ? null : TOSS_DOCS_TEST_WIDGET_CLIENT_KEY
}

/**
 * 자사몰 결제 막음 + 스마트스토어 안내 — 사장님 2026-10-11 "심사 신청하기 전까지 결제 부분은 회색, 위에 초록색 스마트스토어 바로가기".
 * ★값은 true 로 둔다(사장님 2026-10-13 결정) — 막음은 운영에 결제위젯 클라이언트 키가 들어오면 **저절로 풀린다**
 * (storeSalesPaused = 이 값 && 키 없음). 심사 동안엔 사장님이 토스 '테스트' 클라이언트 키(test_gck…)만 넣는다 → 결제창은 열리고
 * 승인은 하지 않는다(아래 storeConfirmTestOnly · 규칙209). 키가 빠지면 다시 스마트스토어 안내로 돌아가는 안전망이라 false 로 바꾸지 않는다.
 * 미리보기·로컬은 테스트 키라 늘 풀린 모양 — 막힌 모양은 /design-check-store?s=paused-* 로 본다.
 */
export const SMARTSTORE_NOTICE = true as boolean

/** 가게의 담기·구매·결제를 회색으로 막고 스마트스토어로 보내나 — 화면마다 정하지 않고 여기 한 곳에서(규칙177). */
export function storeSalesPaused(): boolean {
  return SMARTSTORE_NOTICE && widgetClientKey() === null
}

/**
 * 결제 시험 모드 — 운영인데 결제창 키가 토스 테스트 키(test_)다(토스 일반결제 심사 기간, 사장님 2026-10-13).
 * 주문서가 "실제 결제·배송은 되지 않아요" 안내를 띄운다. 미리보기·로컬은 원래 테스트라 해당 없음.
 */
export function widgetTestMode(): boolean {
  if (process.env.VERCEL_ENV !== 'production') return false
  const k = widgetClientKey()
  return !!k && k.trim().startsWith('test_')
}

/**
 * 지금 웹 가게에서 **실제로** 팔 수 있나 — 검색·AI 에 내보내는 '판매 중' 신호(상품 구조화 데이터의 offers · /llms.txt)는 이것 하나로 정한다.
 * 결제 막음(storeSalesPaused)이거나 결제 시험 기간(widgetTestMode — 결제창은 열리지만 승인하지 않는다)이면 못 판다.
 * ★화면(담기·구매·장바구니·주문서)은 이걸 쓰지 않고 storeSalesPaused 를 그대로 쓴다 — 시험 기간에도 토스 심사관이 결제창까지
 *   가야 한다(사장님 2026-10-14 "검색·AI 만 '준비 중', 화면은 그대로", 규칙220).
 */
export function storeSellable(): boolean {
  return !storeSalesPaused() && !widgetTestMode()
}

/** 결제 시험 기간에 승인 라우트가 돌려주는 코드·문구 — 완료 화면이 이 문구를 그대로 보인다(규칙209). */
export const STORE_TEST_MODE_CODE = 'STORE_TEST_MODE'
export const STORE_TEST_MODE_MESSAGE = '지금은 결제 시험 기간이라 실제 결제는 되지 않았어요. 돈은 나가지 않았어요.'

/**
 * 운영에서 가게 결제(FTS-)를 **승인하면 안 되는가** — 시크릿 키가 없거나, 테스트 키(test_)거나, 결제창을 테스트 키로 열었다.
 * 참이면 승인 라우트는 토스를 부르지 않고 주문을 실패로 남긴다(paid 금지). 시크릿이 없을 때 그냥 부르면 tossSecretKey 가 throw 해
 * '결제 서버와 통신할 수 없어요'(TOSS_NETWORK)라는 엉뚱한 말이 떴다. 정기결제(billing)는 이 판정을 쓰지 않는다.
 */
export function storeConfirmTestOnly(): boolean {
  if (process.env.VERCEL_ENV !== 'production') return false
  const secret = process.env.TOSS_WIDGET_SECRET_KEY?.trim()
  return !secret || secret.startsWith('test_') || widgetTestMode()
}

/** 위젯 고객 키 — 회원 id 에서 만든 해시(토스 권고: 이메일·전화처럼 알아볼 수 있는 값 금지). 같은 회원이면 같은 값. */
export function widgetCustomerKey(userId: string): string {
  return `ft-${createHash('sha256').update(`${userId}:store-widget`).digest('hex').slice(0, 40)}`
}
