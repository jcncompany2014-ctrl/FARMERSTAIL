/**
 * Client-side cookie/tracker consent state.
 *
 * 왜 이 파일이 존재하는가
 * ─────────────────────
 * PIPA §15 와 GDPR 둘 다 "선택적" 쿠키(분석·광고) 는 사용자의 사전 명시 동의가
 * 필요하다. Google Consent Mode v2 와 Meta Pixel consent API 를 써서 스크립트
 * 자체는 로드하되 동의 전에는 저장/전송을 막는 방식을 택한다.
 *
 * 저장
 * ────
 * localStorage['ft_cookie_consent'] = JSON.stringify({
 *   necessary: true,            // 항상 true — 로그인/카트 등 기능성.
 *   analytics: boolean,         // GA4, Vercel Analytics
 *   marketing: boolean,         // Meta Pixel, Google Ads
 *   version: 'v1',              // 쿠키 정책 버전 — bump 시 재동의
 *   decidedAt: ISO string,
 * })
 *
 * 배너는 이 값이 없거나 version 이 다르면 다시 표시.
 */

export const COOKIE_POLICY_VERSION = 'v1'
// export 이유: CookieConsent.tsx 의 useSyncExternalStore getSnapshot 이
// raw 문자열 비교로 스냅샷을 메모이즈하는데 key 가 어긋나면 조용히 무한루프.
// 하드코딩하는 것보다 SSOT 를 공유하는 게 안전.
export const COOKIE_STORAGE_KEY = 'ft_cookie_consent'
const STORAGE_KEY = COOKIE_STORAGE_KEY

export type CookieConsent = {
  necessary: true
  analytics: boolean
  marketing: boolean
  version: string
  decidedAt: string
}

export function readConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CookieConsent>
    if (parsed.version !== COOKIE_POLICY_VERSION) return null
    return {
      necessary: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      version: COOKIE_POLICY_VERSION,
      decidedAt: parsed.decidedAt ?? new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function writeConsent(
  choices: Omit<CookieConsent, 'necessary' | 'version' | 'decidedAt'>,
): CookieConsent {
  const next: CookieConsent = {
    necessary: true,
    analytics: choices.analytics,
    marketing: choices.marketing,
    version: COOKIE_POLICY_VERSION,
    decidedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* Safari Private 모드 등에서 실패 무시 */
  }
  applyConsentToTrackers(next)
  // 다른 탭/컴포넌트도 반영할 수 있도록 이벤트 방출.
  try {
    window.dispatchEvent(new CustomEvent('ft-consent-change', { detail: next }))
  } catch {
    /* noop */
  }
  return next
}

/**
 * 동의 상태를 GA4 (Consent Mode v2) · Meta Pixel · window.dataLayer 에 반영.
 * 스크립트가 아직 로드 전이면 gtag/fbq 가 undefined 이므로 큐에 쌓이지 않고
 * 무시되는데, AnalyticsScripts 가 먼저 default=denied 를 밀어 둬서 괜찮다.
 */
export function applyConsentToTrackers(c: CookieConsent) {
  if (typeof window === 'undefined') return
  const w = window as typeof window & {
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
  try {
    w.gtag?.('consent', 'update', {
      ad_storage: c.marketing ? 'granted' : 'denied',
      ad_user_data: c.marketing ? 'granted' : 'denied',
      ad_personalization: c.marketing ? 'granted' : 'denied',
      analytics_storage: c.analytics ? 'granted' : 'denied',
    })
  } catch {
    /* noop */
  }
  try {
    w.fbq?.('consent', c.marketing ? 'grant' : 'revoke')
  } catch {
    /* noop */
  }
}

/**
 * 배너를 다시 띄우고 싶을 때 (푸터 · 개인정보처리방침 페이지 등에서). 동의 기록을
 * 삭제해 다음 마운트에서 재표시되게 한다.
 */
export function resetConsent() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop */
  }
  try {
    window.dispatchEvent(new Event('ft-consent-reset'))
  } catch {
    /* noop */
  }
}
