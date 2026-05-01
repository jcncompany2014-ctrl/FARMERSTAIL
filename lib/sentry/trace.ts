/**
 * Sentry 비즈니스 트레이싱 헬퍼.
 *
 * 라우트 자동 트레이싱은 Sentry SDK 가 처리. 이 헬퍼는 **비즈니스 도메인 단위**
 * 의 명시적 span 을 추가해 운영 대시보드에서 의미 있는 이름으로 그룹화하기
 * 위한 것.
 *
 * # 사용
 *   import { traceBusiness } from '@/lib/sentry/trace'
 *   const result = await traceBusiness('order.confirm', { orderId }, async () => {
 *     // ... 결제 confirm 로직
 *   })
 *
 * span 이름 prefix 컨벤션:
 *   - order.* — 주문 / 결제 / 환불
 *   - subscription.* — 정기배송 / 빌링
 *   - cart.* — 장바구니 atomic 작업
 *   - analysis.* — Anthropic 호출
 *   - email.* — Resend 발송
 *   - push.* — Web Push 발송
 *
 * # PII 주의
 * attributes 에 user.email / phone / address 같은 PII 를 절대 박지 말 것.
 * user.id 는 OK (UUID, Sentry 가 default 로 표시 안 함).
 */
import * as Sentry from '@sentry/nextjs'

export type TraceAttributes = Record<
  string,
  string | number | boolean | null | undefined
>

/**
 * 비즈니스 span 으로 wrap. 동기 / async 둘 다 허용.
 *
 * Sentry.startSpan 은 production 에서 sampling 에 따라 noop 일 수 있고, 그래도
 * 콜백은 항상 실행되므로 호출처는 결과를 그대로 받음.
 */
export function traceBusiness<T>(
  name: string,
  attributes: TraceAttributes,
  fn: () => Promise<T>,
): Promise<T>
export function traceBusiness<T>(
  name: string,
  attributes: TraceAttributes,
  fn: () => T,
): T
export function traceBusiness<T>(
  name: string,
  attributes: TraceAttributes,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return Sentry.startSpan(
    {
      name,
      op: 'business',
      attributes: {
        ...attributes,
        // Sentry tag 와 attribute 의 차이: tag 는 검색 색인, attribute 는
        // span 상세에만. 비즈니스 카테고리는 attribute 로만.
        'business.domain': name.split('.')[0] ?? 'unknown',
      },
    },
    fn,
  )
}

/**
 * 결제 / 환불 같은 매출 영향 이벤트를 Sentry 에 메시지로 기록.
 * `fingerprint` 로 dedupe — 같은 (event, key) 는 같은 issue 로 묶임.
 *
 * Sentry 의 일반 captureException 보다 가시성이 좋다 — 별도 issue 채널로
 * 운영 알림 라우팅 가능.
 */
export function captureBusinessEvent(
  level: 'info' | 'warning' | 'error',
  message: string,
  context: TraceAttributes,
): void {
  Sentry.captureMessage(message, {
    level,
    tags: {
      'business.event': '1',
    },
    extra: context as Record<string, unknown>,
  })
}

/**
 * 사용자 컨텍스트 안전 setter — id 만 박고 email / username 은 비움.
 * Sentry 의 sendDefaultPii=false 와 일치시키는 명시적 가드.
 */
export function setUserContext(userId: string | null): void {
  Sentry.setUser(userId ? { id: userId } : null)
}
