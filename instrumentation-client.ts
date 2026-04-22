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
import { trackPageView } from '@/lib/analytics'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 브라우저 세션 기반 트랜잭션 샘플링. 0.1은 1시간 1000 page view 기준
  // ~100 transaction — 무료 한도 안에서 병목 추적에 충분.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Replay는 모바일 PWA 특성상 유용 — 결제 fail 시 사용자 액션 재생.
  // 용량 절약을 위해 세션 0%, error 발생 세션만 100% 기록.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      // PII 보호 — 모든 텍스트/미디어를 마스킹 기본값으로.
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  sendDefaultPii: false,
})

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
