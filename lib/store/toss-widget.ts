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
 * ★토스 일반결제 심사를 **신청할 때 false** 로 바꿔 배포한다 — 계속 막아 두면 심사가 안 된다(규칙165 의 이유).
 * 혹시 잊어도 운영에 위젯 키가 들어오면(승인 뒤) 저절로 꺼진다. 미리보기·로컬은 테스트 키라 늘 꺼진 모양 — 막힌 모양은
 * /design-check-store?s=paused-* 로 본다.
 */
export const SMARTSTORE_NOTICE = true as boolean

/** 가게의 담기·구매·결제를 회색으로 막고 스마트스토어로 보내나 — 화면마다 정하지 않고 여기 한 곳에서(규칙177). */
export function storeSalesPaused(): boolean {
  return SMARTSTORE_NOTICE && widgetClientKey() === null
}

/** 위젯 고객 키 — 회원 id 에서 만든 해시(토스 권고: 이메일·전화처럼 알아볼 수 있는 값 금지). 같은 회원이면 같은 값. */
export function widgetCustomerKey(userId: string): string {
  return `ft-${createHash('sha256').update(`${userId}:store-widget`).digest('hex').slice(0, 40)}`
}
