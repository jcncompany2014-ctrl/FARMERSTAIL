/**
 * 인앱 브라우저 감지 — 인스타·페북 등 앱 속 미니 브라우저는 저장소가 분리돼
 * 로그인이 풀려 보이고, 구글 로그인은 아예 막히며, 결제 중 앱 전환이 불안하다.
 * (2026-09-24 — 서포터즈 DM 링크가 정확히 인스타 인앱으로 열리므로 /start 보호)
 *
 * 순수 함수만 — UA 문자열을 받아 판정한다. 테스트: lib/inapp-browser.test.ts
 */

export type InAppKind = 'instagram' | 'facebook' | 'kakaotalk' | 'naver' | 'line'

/** 알려진 인앱 브라우저의 UA 표식. 모르면 null(일반 브라우저 취급 — 오탐이 더 나쁘다). */
export function detectInAppBrowser(ua: string | null | undefined): InAppKind | null {
  if (!ua) return null
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook'
  if (/KAKAOTALK/i.test(ua)) return 'kakaotalk'
  if (/NAVER\(inapp/i.test(ua)) return 'naver'
  if (/\bLine\//i.test(ua)) return 'line'
  return null
}

export function isAndroidUa(ua: string | null | undefined): boolean {
  return Boolean(ua && /Android/i.test(ua))
}

/** 배너 문구용 앱 이름 — 카톡·네이버에서 "인스타그램 안 브라우저"라고 떴다(5차 점검). */
export function inAppBrowserLabel(kind: InAppKind): string {
  switch (kind) {
    case 'instagram':
      return '인스타그램'
    case 'facebook':
      return '페이스북'
    case 'kakaotalk':
      return '카카오톡'
    case 'naver':
      return '네이버'
    case 'line':
      return '라인'
  }
}

/**
 * 크롬으로 옮길 때 이벤트 코드를 잃지 않게 `?p=` 를 되붙인다.
 * /start?p=code 는 코드를 초안(localStorage)에 싣는데, 크롬은 저장소가 따로라
 * 초안이 없다 — URL 에 다시 실어 보내야 StartClient 가 재저장한다.
 * 이미 p 가 있으면 그대로(사용자가 들어온 링크가 우선). 코드 없으면 원문.
 */
export function withPromoParam(href: string, promo: string | null | undefined): string {
  if (!promo) return href
  let u: URL
  try {
    u = new URL(href)
  } catch {
    return href
  }
  if (u.searchParams.has('p')) return href
  u.searchParams.set('p', promo)
  return u.toString()
}

/**
 * 안드로이드에서 크롬으로 강제 이동하는 intent URL.
 * https URL 만 받는다 — 그 외(javascript: 등)는 null 로 거절.
 */
export function chromeIntentUrl(href: string): string | null {
  let u: URL
  try {
    u = new URL(href)
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;end`
}
