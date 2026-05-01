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
  // 라우트별 차등 sampling — 결제 / Anthropic 같은 비즈니스 핵심은 100%,
  // tracking / health 같은 잡음 라우트는 1% 로 비용 절감.
  // 0.1 fallback (그 외 일반 라우트).
  tracesSampler: ({ name, attributes }) => {
    const path = (attributes?.['http.target'] ?? name) as string | undefined
    if (typeof path !== 'string') return 0.1
    // 결제 / 웹훅 / 자동결제 cron — 실패 추적이 매출에 직결.
    if (
      path.startsWith('/api/payments/') ||
      path.startsWith('/api/cron/subscription-charge') ||
      path.startsWith('/checkout/success') ||
      path.startsWith('/api/orders/') ||
      path.startsWith('/api/account/delete')
    ) {
      return 1.0
    }
    // 비용 큰 외부 API — 비용 폭주 / 응답 지연 추적.
    if (path.startsWith('/api/analysis/')) return 1.0
    // 가입/로그인 콜백 — 가입 깔때기 추적.
    if (path === '/auth/callback' || path.startsWith('/api/auth/')) return 0.5
    // 헬스체크 / 트래킹 / web vitals — 빈도 높고 가치 낮음.
    if (
      path.startsWith('/api/health') ||
      path.startsWith('/api/tracking') ||
      path.startsWith('/api/metrics/web-vitals')
    ) {
      return 0.01
    }
    // production: 0.1, dev: 1.0
    return process.env.NODE_ENV === 'production' ? 0.1 : 1.0
  },
  // Release 태깅 — Vercel 빌드가 주입하는 커밋 SHA를 쓴다. 같은 SHA로
  // source map을 업로드해야 symbolication이 동작하므로 next.config.ts의
  // release 설정과 일치시킨다. Vercel 외부(로컬)에서는 undefined → SDK가
  // 기본 전략(package.json 버전 등)으로 폴백.
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  debug: false,
  sendDefaultPii: false,
  // 비즈니스 도메인 태그 — Sentry 대시보드에서 quick filter / cohort 분석용.
  initialScope: {
    tags: {
      'app.region': 'kr',
      'app.platform': 'web',
    },
  },
  beforeSend(event) {
    // PII 한국 특화 패턴 scrubbing — 주민등록번호, 휴대폰, 이메일.
    // Sentry의 기본 scrubber도 돌지만 한국 포맷은 놓치는 경우 있어 이중화.
    return scrubKoreanPII(event)
  },
})

/**
 * 한국 환경 특화 PII 스크러버.
 *
 * Sentry 기본 scrubber는 이메일/신용카드 같은 글로벌 패턴은 잡지만:
 *   - 주민등록번호 (XXXXXX-XXXXXXX)
 *   - 한국 휴대폰 (010-XXXX-XXXX, +82 ...)
 *   - 사업자등록번호 (XXX-XX-XXXXX)
 *   - 계좌번호-계좌주 조합
 * 은 못 잡는다. 에러 스택/메시지/breadcrumb data에 이게 찍힐 가능성이
 * 있어 한 번 더 치운다. 오탐 허용 (계좌번호와 유사한 일반 숫자도 가릴 수
 * 있음) — 로그 가독성보다 PII 유출 방지가 우선.
 */
function scrubKoreanPII<T>(event: T): T {
  const RRN = /\b\d{6}-?[1-4]\d{6}\b/g // 주민번호
  const PHONE = /\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/g // 한국 휴대폰
  const BRN = /\b\d{3}-?\d{2}-?\d{5}\b/g // 사업자등록번호
  const ACCT = /\b\d{2,4}-\d{2,4}-\d{4,7}\b/g // 계좌번호 대략

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
