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

function safeGtag(...args: Parameters<GtagFn>): void {
  if (typeof window === 'undefined') return
  try {
    window.gtag?.(...args)
  } catch {
    /* 광고 차단 또는 스크립트 로드 실패 — 무시 */
  }
}

function safeFbq(...args: Parameters<FbqFn>): void {
  if (typeof window === 'undefined') return
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

export function trackSignUp(method: 'email' | 'kakao') {
  safeGtag('event', 'sign_up', { method })
  safeFbq('track', 'CompleteRegistration', { method })
}
