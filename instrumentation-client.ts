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
  // audit #88: 결제·핵심 funnel 페이지는 100% 샘플, 나머지는 0.1. 이전 균일 0.1
  // 은 결제 web vitals 90% 누락 → CR funnel 분석에 구멍.
  tracesSampler: (samplingContext) => {
    if (process.env.NODE_ENV !== 'production') return 1.0
    const name = samplingContext.name ?? ''
    // pageload / navigation transaction 의 transaction name 은 보통 pathname.
    if (
      name.startsWith('/checkout') ||
      name.startsWith('/cart') ||
      name.startsWith('/onboarding') ||
      name.startsWith('/survey')
    ) {
      return 1.0
    }
    return 0.1
  },
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
  // ★여기 걸리는 건 **우리 에러가 아니다** — 남의 인앱 브라우저가 우리 페이지에
  //   얹은 스크립트가 터진 것이다.
  //
  //   2026-09-11 사장님 제보: iOS 18.7 WKWebView 에서
  //   `ReferenceError: Can't find variable: sendWebMessage` 가 올라왔다.
  //   카카오톡·인스타 같은 인앱 브라우저는 열어준 페이지에 자기 스크립트를
  //   주입한다(상단 바·공유·집계). 그런데 **iOS 는 그 주입 스크립트를 페이지와
  //   같은 컨텍스트에서 돌린다** — 그래서 남의 코드가 터져도 우리 window.onerror
  //   가 주워 담아 Sentry 로 보낸다. 사용자에게는 아무 일도 안 일어난다.
  //   표식: 스택이 `at global code (app:///:1:15)` 한 줄뿐이고 우리 번들
  //   파일명이 없다. `sendWebMessage` 는 소스·Capacitor 브릿지·안드로이드
  //   빌드 산출물 어디에도 없음을 확인했다(3곳 전부 0건).
  //
  //   ⚠️ **심볼 이름으로만 좁게 막는다.** `/is not defined/` 같은 넓은 패턴으로
  //   막으면 우리 진짜 ReferenceError 까지 조용히 삼킨다 — 알림이 시끄러운 것보다
  //   에러가 안 보이는 쪽이 훨씬 위험하다. 같은 유형이 또 오면 **그 심볼 이름만**
  //   이 배열에 한 줄 추가한다.
  //   (문자열은 Sentry 가 부분 일치로 본다 — 브라우저마다 문구가 달라도
  //    "Can't find variable: X" / "X is not defined" 둘 다 걸린다.)
  ignoreErrors: ['sendWebMessage'],
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
