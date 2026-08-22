/**
 * 네이티브 셸이 넘겨주는 "이 화면으로 가라" 요청을 **앱 내부 경로로 정규화** —
 * 정본 한 곳.
 *
 * # 어디서 들어오나 (셋 다 이 함수를 통과해야 한다)
 *  1. 푸시 알림 탭 — `pushNotificationActionPerformed` 의 `notification.data.url`
 *     서버가 넣는 값은 `/mypage/subscriptions` 같은 **상대 경로**다
 *     (lib/push/native.ts: FCM 은 `message.data.url`, APNs 는 payload 루트 `url`).
 *  2. App Links / Universal Links — `appUrlOpen` 의 `event.url`
 *     이쪽은 **항상 절대 URL** (`https://www.farmerstail.kr/...`).
 *  3. 콜드 스타트 — `App.getLaunchUrl()` (2번과 같은 형태)
 *
 * # 왜 검증하나 — 이게 이 파일의 존재 이유다
 * `appUrlOpen` 은 **기기의 아무 앱이나** 인텐트로 쏠 수 있다. 받은 문자열을
 * 그대로 `location.href` 에 넣으면, 우리 세션 쿠키를 들고 있는 WebView 를
 * 공격자 페이지로 끌고 갈 수 있다. 푸시 `data.url` 은 우리 서버가 만들지만
 * 같은 문을 두 개 뚫어 둘 이유가 없어 함께 통과시킨다(다중 방어).
 *
 * 경로 단계 검사(`//evil.com` · `/\evil.com` · `/api/*`)는 **직접 짜지 않고**
 * `safeNextPath` 를 재사용한다 — 같은 검사를 두 벌 두면 갈라진다(그 헬퍼가
 * 생긴 이유가 정확히 그것이다: 3곳에 흩어져 있다가 한 곳만 백슬래시 변형을
 * 놓쳤다).
 */
import { safeNextPath } from './auth/safe-next.ts'

/**
 * WebView 안에서 우리 앱으로 인정하는 호스트.
 * android/app/src/main/AndroidManifest.xml 의 App Links intent-filter 및
 * app/.well-known/* 라우트와 **같은 목록이어야 한다.**
 */
const ALLOWED_HOSTS = new Set(['farmerstail.kr', 'www.farmerstail.kr'])

/** `scheme:` 로 시작하는지 (RFC 3986 scheme 문법). 상대 경로와 가르는 용도. */
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/

/**
 * 네이티브에서 받은 목적지를 앱 내부 경로(`/...`)로 바꾼다.
 * 조금이라도 미심쩍으면 `null` — 호출처는 null 이면 **아무 데도 안 간다**
 * (홈으로 보내지 않는다. 엉뚱한 화면을 여는 것보다 그대로 두는 게 낫다).
 */
export function nativeTargetPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // 절대 URL — https + 우리 호스트만. `javascript:` · `file:` · `intent:` 는
  // 여기서 프로토콜 검사에 걸려 죽는다.
  if (HAS_SCHEME.test(trimmed)) {
    let parsed: URL
    try {
      parsed = new URL(trimmed)
    } catch {
      return null
    }
    if (parsed.protocol !== 'https:') return null
    // `https://www.farmerstail.kr@evil.com/` 은 hostname 이 evil.com 이라
    // 여기서 걸린다. `...farmerstail.kr.evil.com` 도 마찬가지(정확 일치).
    if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) return null
    return safeNextPath(`${parsed.pathname}${parsed.search}${parsed.hash}`)
  }

  // 스킴이 없으면 경로로 본다. `//evil.com`(프로토콜 상대) 과
  // `/\evil.com`(백슬래시 변형) 은 safeNextPath 가 막는다.
  return safeNextPath(trimmed)
}
