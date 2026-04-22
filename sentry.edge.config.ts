/**
 * Sentry — Edge 런타임 (middleware, 그 밖의 edge route handler).
 *
 * Node 빌드와 분리 — Edge는 fetch/URL/Response만 쓰는 제한된 런타임.
 * Sentry SDK도 edge-safe 빌드만 로드된다.
 */
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: !!(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: false,
  sendDefaultPii: false,
})
