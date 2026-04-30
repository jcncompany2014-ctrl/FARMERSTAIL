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

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: !!(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // 커밋 SHA로 release 태깅 (symbolication / 에러-커밋 링크용).
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  debug: false,
  sendDefaultPii: false,
  beforeSend(event) {
    return scrubKoreanPII(event)
  },
})

function scrubKoreanPII<T>(event: T): T {
  const RRN = /\b\d{6}-?[1-4]\d{6}\b/g
  const PHONE = /\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/g
  const BRN = /\b\d{3}-?\d{2}-?\d{5}\b/g
  const ACCT = /\b\d{2,4}-\d{2,4}-\d{4,7}\b/g

  const scrub = (s: string) =>
    s
      .replace(RRN, '[주민번호]')
      .replace(PHONE, '[휴대폰]')
      .replace(BRN, '[사업자번호]')
      .replace(ACCT, '[계좌]')

  const walk = (val: unknown): unknown => {
    if (typeof val === 'string') return scrub(val)
    if (Array.isArray(val)) return val.map(walk)
    if (val && typeof val === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(val)) out[k] = walk(v)
      return out
    }
    return val
  }

  return walk(event) as T
}
