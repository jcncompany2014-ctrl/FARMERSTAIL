/**
 * Sentry — Node.js 런타임 (API routes, Server Actions, Server Components).
 *
 * DSN이 비어있으면 SDK가 자동 no-op이 되므로 로컬 개발 중에는 별도
 * 설정 없이도 부팅된다. production 환경에서만 실제 이벤트를 보낸다.
 *
 * tracesSampleRate는 0.1로 시작 — 초기 트래픽 기준 월 무료 한도
 * (100K 트랜잭션)에 충분히 여유를 두면서도 성능 회귀를 조기에 발견할
 * 수 있는 수준. 트래픽이 늘면 dynamic sampling으로 조정.
 */
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: !!(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // 전체 콘솔 로그를 이벤트로 포워딩하지 않음 — noisy + PII 위험.
  // 프리 필터는 beforeSend에서 수행.
  debug: false,
  // 이메일/휴대폰/사업자번호 등 개인정보는 기본적으로 Sentry로 보내지
  // 않는다. Server Action에서 throw된 에러 안에 포함될 가능성이 있어
  // PII scrubbing을 공격적으로 on.
  sendDefaultPii: false,
})
