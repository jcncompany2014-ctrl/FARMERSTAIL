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

/** 위젯 고객 키 — 회원 id 에서 만든 해시(토스 권고: 이메일·전화처럼 알아볼 수 있는 값 금지). 같은 회원이면 같은 값. */
export function widgetCustomerKey(userId: string): string {
  return `ft-${createHash('sha256').update(`${userId}:store-widget`).digest('hex').slice(0, 40)}`
}
