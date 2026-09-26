/**
 * Sentry — Edge 런타임 (middleware, 그 밖의 edge route handler).
 *
 * Node 빌드와 분리 — Edge는 fetch/URL/Response만 쓰는 제한된 런타임.
 * Sentry SDK도 edge-safe 빌드만 로드된다.
 *
 * server config 와 동일한 한국 PII scrubber 사용 — middleware 에서 admin 검증
 * 실패 등의 에러가 사용자 신상으로 채워지지 않도록 일관 적용.
 */
import * as Sentry from '@sentry/nextjs'
import { scrubSentryEvent } from '@/lib/sentry-scrub'

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 미리보기(preview) 배포도 NODE_ENV=production 이라 운영 오류와 섞였다 — Vercel 환경명을 쓴다(2026-09-24).
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  enabled: !!(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // 커밋 SHA로 release 태깅 (symbolication / 에러-커밋 링크용).
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  debug: false,
  sendDefaultPii: false,
  beforeSend(event) {
    return scrubSentryEvent(event)
  },
})
