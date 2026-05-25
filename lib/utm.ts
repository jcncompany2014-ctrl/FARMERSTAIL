/**
 * UTM attribution capture — R39c (#29).
 *
 * 사용자가 utm_source/utm_medium/utm_campaign 가 붙은 URL 로 첫 진입 시
 * sessionStorage 에 저장. conversion event (purchase / subscribe) 시 함께
 * 보내 광고 attribution.
 *
 * # 정책
 * - sessionStorage — 같은 세션 안에서만 유효. 닫고 다시 열면 reset (cookie 보다
 *   privacy-friendly).
 * - last-touch attribution — 동일 세션 중 다른 utm URL 진입 시 덮어씀.
 *   (first-touch 가 필요하면 별도 ledger 로 별도 storage)
 * - GDPR 면제 — 본인 사이트 내 attribution 만 (외부 cookie/tracker 없음).
 */

const KEY = 'ft:utm'

export interface UtmPayload {
  source?: string
  medium?: string
  campaign?: string
  term?: string
  content?: string
  /** capture 시점 (ISO). */
  capturedAt: string
}

/** URL searchParams 에서 utm_* 추출. */
function extractUtm(searchParams: URLSearchParams): Omit<UtmPayload, 'capturedAt'> {
  const out: Omit<UtmPayload, 'capturedAt'> = {}
  const source = searchParams.get('utm_source')
  if (source) out.source = source
  const medium = searchParams.get('utm_medium')
  if (medium) out.medium = medium
  const campaign = searchParams.get('utm_campaign')
  if (campaign) out.campaign = campaign
  const term = searchParams.get('utm_term')
  if (term) out.term = term
  const content = searchParams.get('utm_content')
  if (content) out.content = content
  return out
}

/**
 * Mount 시 호출 — URL 의 utm_* params 검사. 있으면 sessionStorage 에 저장.
 * 없으면 기존 stored UTM 유지 (재진입 시 attribution 보존).
 *
 * client only.
 */
export function captureUtmFromUrl(): void {
  if (typeof window === 'undefined') return
  try {
    const params = new URLSearchParams(window.location.search)
    const extracted = extractUtm(params)
    // utm_* 가 하나라도 있으면 last-touch override.
    if (Object.keys(extracted).length === 0) return
    const payload: UtmPayload = {
      ...extracted,
      capturedAt: new Date().toISOString(),
    }
    sessionStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // sessionStorage 비활성/quota exceeded — silent fail (UTM 은 nice-to-have).
  }
}

/**
 * 저장된 UTM 조회. conversion event (purchase / subscribe) 시 함께 보냄.
 * 만료/누락 시 null.
 */
export function getStoredUtm(): UtmPayload | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as UtmPayload
    if (!parsed.capturedAt) return null
    return parsed
  } catch {
    return null
  }
}

/** UTM 명시 제거 — 디버깅 / 사용자 요청 시. */
export function clearStoredUtm(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
