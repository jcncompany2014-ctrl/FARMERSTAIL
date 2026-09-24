/**
 * 웹 푸시 구독 주소(endpoint) 허용 목록 — 순수 함수 (테스트: push-endpoint.test.ts).
 *
 * # 왜 (2026-09-24 보안 점검)
 * 구독 등록은 `z.string().url()` 만 봤고, push_subscriptions 는 고객이 DB API 로 직접 넣을
 * 수도 있다(INSERT 정책은 user_id 만 본다). 그 주소로 우리 서버가 서명된 POST 를 보내고,
 * /api/push/test 응답의 성공/실패 개수로 대상 호스트가 살아 있는지 알 수 있었다(내부망 탐색용
 * SSRF). 브라우저가 실제로 주는 주소는 몇 개 푸시 서비스뿐이라, 그 호스트만 받는다.
 * 등록 API(스키마)와 **발송 직전** 두 곳에서 같은 함수를 쓴다 — DB 직접 삽입을 막으려면
 * 발송 쪽 검사가 진짜 방어다.
 */

/** 정확히 일치해야 하는 호스트. */
const EXACT_HOSTS = new Set([
  'fcm.googleapis.com', // Chrome · Samsung Internet · Android WebView
  'android.googleapis.com', // 옛 GCM 형식
  'updates.push.services.mozilla.com', // Firefox
  'web.push.apple.com', // Safari (macOS 13+ · iOS 16.4+ 홈 화면 앱)
])

/** 이 접미사로 끝나는 호스트 (Edge: wns2-xxx.notify.windows.com 등). */
const SUFFIX_HOSTS = ['.notify.windows.com', '.push.services.mozilla.com']

export function isAllowedPushEndpoint(raw: unknown): boolean {
  if (typeof raw !== 'string') return false
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  if (url.port && url.port !== '443') return false
  if (url.username || url.password) return false
  const host = url.hostname.toLowerCase()
  if (EXACT_HOSTS.has(host)) return true
  return SUFFIX_HOSTS.some((s) => host.endsWith(s))
}
