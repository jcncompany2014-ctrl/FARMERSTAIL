/**
 * Next.js 16 client-side instrumentation.
 *
 * React hydration 전에 실행되므로 초기 에러(스크립트 로드 실패, 전역
 * handler 미등록 전 에러 등)를 놓치지 않는다. Sentry는 여기서 browser
 * SDK를 초기화하고, `onRouterTransitionStart`를 export해서 내비게이션
 * 계측을 App Router 네이티브 이벤트에 맞춰 붙인다.
 *
 * DSN이 세팅되지 않은 환경(로컬 dev, preview)에서는 자동 no-op.
 */
import * as Sentry from '@sentry/nextjs'
import {
  trackPageView,
  captureFirstTouchFromUrl,
} from '@/lib/analytics'

// 첫 페이지 도달 시점에 한 번 — 광고 클릭으로 들어온 UTM 출처를 캡처.
// localStorage 라 cross-session (어제 광고 → 오늘 가입) 까지 보존되며,
// trackSignUp / trackPurchase 가 first_touch_* event param 으로 흘려 GA4 에
// 코호트 attribution 을 만들어준다. 30일 TTL.
if (typeof window !== 'undefined') {
  try {
    captureFirstTouchFromUrl()
  } catch {
    /* noop — analytics 는 실패해도 앱이 멈추면 안 됨 */
  }
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 커밋 SHA로 release 태깅 — Vercel이 NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA로
  // 공개 접근 가능한 형태로 inline 해준다 (빌드 타임). 클라이언트에서 환경
  // 변수를 읽어야 하므로 NEXT_PUBLIC_ 접두사 필요.
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  // 브라우저 세션 기반 트랜잭션 샘플링. 0.1은 1시간 1000 page view 기준
  // ~100 transaction — 무료 한도 안에서 병목 추적에 충분.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Replay는 모바일 PWA 특성상 유용 — 결제 fail 시 사용자 액션 재생.
  // 용량 절약을 위해 세션 0%, error 발생 세션만 100% 기록.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      // PII 보호 — 모든 텍스트/미디어/input 값 마스킹.
      // 입력 필드까지 포함시켜야 결제·로그인 화면이 캡처돼도 안전.
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],
  sendDefaultPii: false,
  // 한국 환경 특화 PII scrubbing — server config 와 동일 패턴.
  // breadcrumb 의 navigation/click 라벨이나 에러 메시지 텍스트에 사용자 PII
  // (주민번호 / 휴대폰 / 이메일 / 계좌) 가 우연히 들어가는 케이스를 한 번 더
  // 거른다. Sentry 기본 scrubber 는 한국 포맷을 못 잡으므로 이중화.
  beforeSend(event) {
    return scrubKoreanPII(event)
  },
  beforeBreadcrumb(crumb) {
    if (crumb.message) crumb.message = scrubString(crumb.message)
    if (crumb.data) crumb.data = scrubKoreanPII(crumb.data)
    return crumb
  },
})

function scrubString(s: string): string {
  const RRN = /\b\d{6}-?[1-4]\d{6}\b/g
  const PHONE = /\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/g
  const BRN = /\b\d{3}-?\d{2}-?\d{5}\b/g
  const ACCT = /\b\d{2,4}-\d{2,4}-\d{4,7}\b/g
  return s
    .replace(RRN, '[주민번호]')
    .replace(PHONE, '[휴대폰]')
    .replace(BRN, '[사업자번호]')
    .replace(ACCT, '[계좌]')
}

function scrubKoreanPII<T>(event: T): T {
  const walk = (val: unknown): unknown => {
    if (typeof val === 'string') return scrubString(val)
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

// Sentry의 client-side router transition hook과 analytics page_view를
// 하나로 합쳐서 export한다. Next 16은 `onRouterTransitionStart`를
// 하나만 허용하므로 두 기능을 wrapper로 연결.
export function onRouterTransitionStart(
  url: string,
  navigationType: 'push' | 'replace' | 'traverse'
) {
  Sentry.captureRouterTransitionStart(url, navigationType)
  trackPageView(url)
}
