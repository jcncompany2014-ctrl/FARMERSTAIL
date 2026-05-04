/**
 * 타이핑된 GA4 + Meta Pixel 래퍼.
 *
 * 왜 이런 얇은 wrapper를 두는가:
 *   • window.gtag / window.fbq 는 스크립트 로드 전에는 undefined.
 *     각 호출마다 if 체크를 반복하지 않기 위해.
 *   • DSN/ID가 세팅되지 않은 환경(로컬, preview)에서는 완전 no-op.
 *   • 이벤트 이름/파라미터를 한 곳에서 관리 → 추적 스키마가 흩어지지
 *     않는다 (GA 대시보드에서 여러 이름으로 쪼개지는 문제 방지).
 *
 * 호출 규약:
 *   • 모든 함수는 SSR 환경에서 호출되면 조용히 반환.
 *   • 광고 차단기(uBlock, Brave 등)로 스크립트 로드가 실패해도
 *     TypeError를 던지지 않음.
 */

type GtagCommand = 'config' | 'event' | 'js' | 'set' | 'consent'
type GtagFn = (command: GtagCommand, ...args: unknown[]) => void
type FbqFn = (
  method: 'init' | 'track' | 'trackCustom' | 'consent',
  ...args: unknown[]
) => void

declare global {
  interface Window {
    gtag?: GtagFn
    // 광고 차단기에서 흔히 fbq를 noop으로 덮어쓰므로 optional.
    fbq?: FbqFn
    dataLayer?: unknown[]
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_ID
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

export const isAnalyticsEnabled = () => Boolean(GA_ID || PIXEL_ID)

/**
 * iOS App Tracking Transparency (ATT) 게이트.
 *
 * Apple Guideline 5.1.2 — 사용자가 ATT 권한을 거부했거나 아직 묻지 않은 상태
 * 면 IDFA / 광고 식별자를 사용하는 트래킹 (Meta Pixel, GA4 demographic, fbq
 * AdvancedMatching) 을 호출하지 말 것. iOS 14.5+ 에서 강제. 거부 시 추적
 * SDK 호출 자체를 막아야 거부 사유 회피.
 *
 * 동작:
 * - native (Capacitor iOS) 컨텍스트에서만 의미 있음. 웹/Android 는 항상 true.
 * - `@capacitor-community/app-tracking-transparency` 가 status='authorized' 일
 *   때만 GA/Pixel 활성. 거부면 모든 track* 함수가 noop.
 * - 첫 진입 시 native bridge 가 status 'notDetermined' 면 prompt 띄울지는 UI
 *   레이어 결정. (ex. 첫 로그인/체크아웃 직전에 한 번 명시 안내 후 요청.)
 *
 * 구현 노트:
 * - native bridge 가 plugin 로딩 실패하면 fail-closed (false) — 추적 안 함.
 * - 모듈 스코프 cache 로 한 세션 동안 한 번만 평가.
 */
type AttStatus = 'authorized' | 'denied' | 'restricted' | 'notDetermined'
let attCache: AttStatus | null = null

function isCapacitorIos(): boolean {
  if (typeof window === 'undefined') return false
  // Capacitor 가 inject 한 native bridge 식별자
  type CapWindow = Window & { Capacitor?: { getPlatform?: () => string } }
  return (window as CapWindow).Capacitor?.getPlatform?.() === 'ios'
}

/**
 * 동기 체크. 캐시된 status 만 본다 — async ATT.requestPermission 은 별도
 * trigger 함수에서 호출하고 결과를 setAttStatus 로 캐시 갱신.
 */
function isTrackingAllowed(): boolean {
  if (!isCapacitorIos()) return true // 웹/Android 는 ATT 적용 X
  return attCache === 'authorized'
}

/** native ATT plugin 결과를 module cache 에 저장. AppRoot 초기화 시 1회 호출. */
export function setAttStatus(status: AttStatus): void {
  attCache = status
}

function safeGtag(...args: Parameters<GtagFn>): void {
  if (typeof window === 'undefined') return
  if (!isTrackingAllowed()) return
  try {
    window.gtag?.(...args)
  } catch {
    /* 광고 차단 또는 스크립트 로드 실패 — 무시 */
  }
}

function safeFbq(...args: Parameters<FbqFn>): void {
  if (typeof window === 'undefined') return
  if (!isTrackingAllowed()) return
  try {
    window.fbq?.(...args)
  } catch {
    /* same */
  }
}

/* ──────────────────────────────────────────────────────────────
 * Page view — Next App Router는 클라이언트 navigation을 SDK가
 * 자동 감지하지 않으므로 instrumentation-client.ts에서 수동 호출.
 * ──────────────────────────────────────────────────────────── */
export function trackPageView(url: string) {
  if (GA_ID) {
    safeGtag('config', GA_ID, { page_path: url })
  }
  if (PIXEL_ID) {
    safeFbq('track', 'PageView')
  }
}

/* ──────────────────────────────────────────────────────────────
 * E-commerce 전환 이벤트. Enhanced E-commerce 스키마 준수
 * (GA4 권장 이벤트 이름: view_item, add_to_cart, begin_checkout,
 * purchase, sign_up).
 * ──────────────────────────────────────────────────────────── */

export type AnalyticsItem = {
  item_id: string
  item_name: string
  price: number
  quantity: number
  item_category?: string
}

export function trackViewItem(item: AnalyticsItem) {
  safeGtag('event', 'view_item', {
    currency: 'KRW',
    value: item.price,
    items: [item],
  })
  safeFbq('track', 'ViewContent', {
    content_ids: [item.item_id],
    content_name: item.item_name,
    content_type: 'product',
    value: item.price,
    currency: 'KRW',
  })
}

export function trackAddToCart(item: AnalyticsItem) {
  safeGtag('event', 'add_to_cart', {
    currency: 'KRW',
    value: item.price * item.quantity,
    items: [item],
  })
  safeFbq('track', 'AddToCart', {
    content_ids: [item.item_id],
    content_name: item.item_name,
    content_type: 'product',
    value: item.price * item.quantity,
    currency: 'KRW',
  })
}

export function trackBeginCheckout({
  value,
  items,
}: {
  value: number
  items: AnalyticsItem[]
}) {
  safeGtag('event', 'begin_checkout', {
    currency: 'KRW',
    value,
    items,
  })
  safeFbq('track', 'InitiateCheckout', {
    content_ids: items.map((i) => i.item_id),
    contents: items.map((i) => ({ id: i.item_id, quantity: i.quantity })),
    num_items: items.reduce((sum, i) => sum + i.quantity, 0),
    value,
    currency: 'KRW',
  })
}

export function trackPurchase({
  transactionId,
  value,
  items,
  shipping,
  coupon,
}: {
  transactionId: string
  value: number
  items: AnalyticsItem[]
  shipping?: number
  coupon?: string | null
}) {
  safeGtag('event', 'purchase', {
    transaction_id: transactionId,
    currency: 'KRW',
    value,
    shipping: shipping ?? 0,
    coupon: coupon ?? undefined,
    items,
  })
  safeFbq('track', 'Purchase', {
    content_ids: items.map((i) => i.item_id),
    contents: items.map((i) => ({ id: i.item_id, quantity: i.quantity })),
    num_items: items.reduce((sum, i) => sum + i.quantity, 0),
    value,
    currency: 'KRW',
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Personalization funnel — 보호자가 강아지 처방을 받기까지의 단계별 이벤트.
// GA4 dashboard 에서 funnel 분석 + drop-off 측정.
// ─────────────────────────────────────────────────────────────────────────────

/** 설문 시작 — 첫 step (body) 진입. */
export function trackSurveyStarted(dogId: string) {
  safeGtag('event', 'survey_started', { dog_id: dogId })
}

/** 설문 완료 — analysis insert 직후. */
export function trackSurveyCompleted(dogId: string) {
  safeGtag('event', 'survey_completed', { dog_id: dogId })
}

/** 분석 페이지 진입. */
export function trackAnalysisViewed(dogId: string) {
  safeGtag('event', 'analysis_viewed', { dog_id: dogId })
}

/** 추천 박스 (compute) 결과 표시 — careGoal 별 분포 측정. */
export function trackBoxRecommended(opts: {
  dogId: string
  cycleNumber: number
  careGoal: string | null
  algorithmVersion: string
}) {
  safeGtag('event', 'box_recommended', {
    dog_id: opts.dogId,
    cycle_number: opts.cycleNumber,
    care_goal: opts.careGoal ?? 'unknown',
    algorithm_version: opts.algorithmVersion,
  })
}

/** 체크인 응답 — week_2 / week_4 별 응답률 측정. */
export function trackCheckinSubmitted(opts: {
  dogId: string
  cycleNumber: number
  checkpoint: 'week_2' | 'week_4'
  hasPhoto: boolean
}) {
  safeGtag('event', 'checkin_submitted', {
    dog_id: opts.dogId,
    cycle_number: opts.cycleNumber,
    checkpoint: opts.checkpoint,
    has_photo: opts.hasPhoto,
  })
}

/** 처방 변경 동의 — approve / decline 선택. */
export function trackBoxDecision(opts: {
  dogId: string
  cycleNumber: number
  decision: 'approve' | 'decline'
}) {
  safeGtag('event', 'box_decision', {
    dog_id: opts.dogId,
    cycle_number: opts.cycleNumber,
    decision: opts.decision,
  })
}

/** 사용자가 추천 비율 직접 조정 — 알고리즘 정확도 KPI (적을수록 좋음). */
export function trackBoxAdjusted(opts: {
  dogId: string
  cycleNumber: number
}) {
  safeGtag('event', 'box_adjusted', {
    dog_id: opts.dogId,
    cycle_number: opts.cycleNumber,
  })
}

export function trackSignUp(method: 'email' | 'kakao') {
  // First-touch attribution — 가입 시점에 가장 처음 도달했던 UTM 출처를
  // 함께 보낸다. GA4 는 세션 단위로 UTM 을 자동 캡처하지만, "사용자가 어제
  // 광고 보고 → 오늘 직접 방문 → 가입" 같은 cross-session 코호트는 우리가
  // 따로 잡아야 한다. localStorage 기반 first-touch 가 그 갭을 채움.
  const ft = getFirstTouch()
  const gtagParams: Record<string, string | null> = { method }
  if (ft?.source) {
    gtagParams.first_touch_source = ft.source
    gtagParams.first_touch_medium = ft.medium ?? null
    gtagParams.first_touch_campaign = ft.campaign ?? null
  }
  safeGtag('event', 'sign_up', gtagParams)
  safeFbq('track', 'CompleteRegistration', { method })
}

// ─────────────────────────────────────────────────────────────────────────────
// First-touch attribution
// ─────────────────────────────────────────────────────────────────────────────

const FIRST_TOUCH_KEY = 'ft_first_touch'
const FIRST_TOUCH_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30일 — 광고 클릭 후 가입까지 윈도우.

export type FirstTouch = {
  source: string
  medium: string | null
  campaign: string | null
  /** ISO timestamp 첫 캡처 시각. TTL 판정용. */
  ts: string
}

/**
 * 현재 페이지 URL 의 utm_* 파라미터를 읽어 first-touch 로 기록.
 * **이미 기록된 first-touch 가 있으면 덮어쓰지 않음** — 첫 도달 시점의 출처가
 * 우선. 30일 지난 기록은 만료로 보고 새로 캡처. UTM 이 없는 방문은 무시 (빈
 * 레코드 저장 X).
 *
 * `instrumentation-client.ts` 가 모든 client 라우트 마운트 직후 호출 권장.
 */
export function captureFirstTouchFromUrl(): void {
  if (typeof window === 'undefined') return
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(FIRST_TOUCH_KEY)
  } catch {
    return
  }
  // 이미 유효한 기록 있으면 그대로 둠.
  if (raw) {
    try {
      const existing = JSON.parse(raw) as FirstTouch
      if (Date.now() - new Date(existing.ts).getTime() < FIRST_TOUCH_TTL_MS) {
        return
      }
    } catch {
      /* 파싱 실패하면 새로 캡처 시도 */
    }
  }

  const params = new URLSearchParams(window.location.search)
  const source = params.get('utm_source')?.trim()
  if (!source) return // UTM 없으면 저장 안 함 — direct/organic 은 빈 레코드 만들지 않는다.

  const data: FirstTouch = {
    source: source.slice(0, 64),
    medium: params.get('utm_medium')?.trim().slice(0, 64) ?? null,
    campaign: params.get('utm_campaign')?.trim().slice(0, 96) ?? null,
    ts: new Date().toISOString(),
  }
  try {
    window.localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(data))
  } catch {
    /* Safari Private 모드 등 — 무시 */
  }
}

/** 현재 first-touch 레코드 (만료 X). 없거나 만료됐으면 null. */
export function getFirstTouch(): FirstTouch | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(FIRST_TOUCH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FirstTouch
    if (Date.now() - new Date(parsed.ts).getTime() > FIRST_TOUCH_TTL_MS) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}
