/**
 * Capacitor 런타임 헬퍼.
 *
 * 같은 코드베이스가 3가지 컨텍스트에서 실행됨:
 *   1. 브라우저 (PWA / 일반 웹)
 *   2. iOS Capacitor WKWebView
 *   3. Android Capacitor WebView
 *
 * 각 컨텍스트에서 native 기능을 dynamic import 로 분기. 웹에서는 native
 * plugin import 자체가 안 되도록 함수 안에서 lazy 로드 — bundle 에 native
 * 만 위한 코드가 포함되지 않게 (사실 Capacitor plugin 들은 web fallback 도
 * 제공하지만 명시적으로 isNative() 가드해서 의도를 분명히).
 *
 * # 디자인 원칙
 *
 * - **PWA-first**: 모든 기능은 web 에서 동작해야 함. Capacitor 는 enhancement.
 * - **Lazy import**: 페이지 초기 번들에 native plugin 안 들어감.
 * - **에러 무시**: native 호출 실패 (권한 거부 등) 는 silent fail — web fallback
 *   이 자연스럽게 동작.
 */

declare global {
  interface Window {
    /** Capacitor 가 주입하는 글로벌. 웹에선 undefined. */
    Capacitor?: {
      isNativePlatform: () => boolean
      getPlatform: () => 'ios' | 'android' | 'web'
    }
  }
}

/** Capacitor 네이티브 (iOS/Android) WebView 안에서 실행 중인지. */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  return window.Capacitor?.isNativePlatform() === true
}

export type Platform = 'ios' | 'android' | 'web'

/** 현재 플랫폼. SSR 에선 항상 'web'. */
export function getPlatform(): Platform {
  if (typeof window === 'undefined') return 'web'
  return window.Capacitor?.getPlatform() ?? 'web'
}

/**
 * 네이티브 푸시 알림 권한 요청 + 토큰 등록.
 * 웹에서는 호출 X (별도 web push subscribe 플로우 사용).
 *
 * 호출처 예: /mypage/notifications 의 알림 토글이 ON 으로 바뀌면 한 번.
 *
 * 반환:
 *   - native: { ok: true, token: 'apns-or-fcm-token-string' }
 *   - 권한 거부: { ok: false, reason: 'denied' }
 *   - 실패: { ok: false, reason: error.message }
 *   - 웹: { ok: false, reason: 'not_native' }
 */
export async function registerNativePush(): Promise<
  | { ok: true; token: string }
  | { ok: false; reason: string }
> {
  if (!isNativeApp()) {
    return { ok: false, reason: 'not_native' }
  }
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const perm = await PushNotifications.requestPermissions()
    if (perm.receive !== 'granted') {
      return { ok: false, reason: 'denied' }
    }
    return new Promise((resolve) => {
      /**
       * ⏱ 시간 제한이 **반드시** 있어야 한다 (2026-08-26 추가).
       *
       * 이 Promise 는 registration / registrationError / register() 거절,
       * 셋 중 하나로만 끝난다. 그런데 셋 다 안 오는 상태가 실재한다 —
       * AppDelegate 가 APNs 토큰을 NotificationCenter 로 넘겨주지 않으면
       * `register()` 는 성공으로 끝나고 **이벤트는 영영 오지 않는다**
       * (실제로 iOS 플랫폼 생성 직후 그 상태였다). 그러면 알림 설정 토글이
       * 무한히 돌기만 하고 사용자도 우리도 원인을 모른다.
       * 시간 제한이 있으면 최소한 '실패'로 드러나 원인을 찾을 수 있다.
       */
      const timeout = setTimeout(() => {
        void success.then((s) => s.remove())
        void error.then((e) => e.remove())
        resolve({ ok: false, reason: 'apns_token_timeout' })
      }, 20_000)

      // registration 이벤트가 와야 토큰을 알 수 있음. 이벤트 핸들러는 한
      // 번만 unbind 해서 메모리 누수 방지.
      const success = PushNotifications.addListener('registration', (t) => {
        clearTimeout(timeout)
        void success.then((s) => s.remove())
        void error.then((e) => e.remove())
        resolve({ ok: true, token: t.value })
      })
      const error = PushNotifications.addListener(
        'registrationError',
        (err) => {
          clearTimeout(timeout)
          void success.then((s) => s.remove())
          void error.then((e) => e.remove())
          resolve({ ok: false, reason: err.error })
        },
      )
      PushNotifications.register().catch((err: Error) => {
        clearTimeout(timeout)
        void success.then((s) => s.remove())
        void error.then((e) => e.remove())
        resolve({ ok: false, reason: err.message })
      })
    })
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 디바이스 ID — 자체 관리 UUID (localStorage). Capacitor Device 플러그인을
 * 추가 설치하지 않아도 native_push_tokens 의 (user, device_id) UNIQUE 만족.
 * native 가 아니면 null. 재설치 시 새 UUID — 토큰은 새 row 로 register.
 */
const DEVICE_ID_KEY = 'ft_device_id'
export async function getDeviceId(): Promise<string | null> {
  if (!isNativeApp()) return null
  try {
    const { Preferences } = await import('@capacitor/preferences')
    const existing = await Preferences.get({ key: DEVICE_ID_KEY })
    if (existing.value) return existing.value
    // 없으면 새로 생성 + 저장
    const fresh =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`
    await Preferences.set({ key: DEVICE_ID_KEY, value: fresh })
    return fresh
  } catch {
    return null
  }
}

/**
 * 플랫폼 + 앱 버전. App plugin (@capacitor/app — 이미 설치됨) 사용.
 */
export async function getDeviceInfo(): Promise<{
  appVersion?: string
  platform?: 'ios' | 'android'
}> {
  if (!isNativeApp()) return {}
  try {
    type CapWindow = Window & {
      Capacitor?: { getPlatform?: () => string }
    }
    const platformRaw =
      typeof window !== 'undefined'
        ? (window as CapWindow).Capacitor?.getPlatform?.()
        : null
    const platform = platformRaw === 'ios' ? 'ios' : 'android'

    const { App } = await import('@capacitor/app')
    const appInfo = await App.getInfo().catch(() => null)
    return {
      appVersion: appInfo?.version,
      platform,
    }
  } catch {
    return {}
  }
}

/**
 * 네이티브 푸시 등록 + 서버에 토큰 전송. 한 번에 끝까지 가는 통합 헬퍼.
 *
 * 호출처: 사용자가 마이페이지 알림 토글을 ON 으로 켤 때, 또는 native 앱이
 * 첫 실행에서 사용자 동의 후. 권한 거부면 서버 호출 없이 false 반환.
 *
 * @returns true = 등록 성공, false = 권한 거부 / 네트워크 실패 / 웹 환경.
 */
export async function registerAndSyncNativePush(): Promise<boolean> {
  if (!isNativeApp()) return false

  const result = await registerNativePush()
  if (!result.ok) return false

  const [deviceId, info] = await Promise.all([getDeviceId(), getDeviceInfo()])
  if (!deviceId || !info.platform) return false

  try {
    const res = await fetch('/api/push/native-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: info.platform,
        token: result.token,
        deviceId,
        appVersion: info.appVersion,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * 로그아웃 직전 네이티브 푸시 토큰 정리 (2026-08-08 네이티브 감사).
 *
 * 안 지우면 토큰 row 가 (이전 user_id 로) 남아 **로그아웃한 기기로 계속
 * 푸시가 온다** — 가족 공유 폰이면 다음 사용자가 이전 계정의 배송·결제
 * 알림을 받는다. DELETE 는 본인 세션이 필요하므로 **signOut 전에** 불러야
 * 한다. 실패해도 조용히 넘어간다 — 로그아웃을 막는 쪽이 더 나쁘다.
 *
 * ⚠️ 직접 부르지 말 것 — `cleanupPushOnLogout()` 을 부른다(아래 이유).
 */
async function cleanupNativePushOnLogout(): Promise<void> {
  if (!isNativeApp()) return
  try {
    const deviceId = await getDeviceId()
    if (!deviceId) return
    await fetch(
      `/api/push/native-register?deviceId=${encodeURIComponent(deviceId)}`,
      { method: 'DELETE' },
    )
  } catch {
    /* 로그아웃은 계속 진행 */
  }
}

/**
 * 로그아웃 직전 **웹 푸시 구독** 정리 (2026-08-14 4라운드 감사).
 *
 * 위 네이티브 정리를 넣은 커밋(d4dc435)이 바로 이 이유 — "공유 폰이면 다음
 * 사용자가 이전 계정 알림을 받는다" — 를 적어 놓고 **웹 경로만 빠뜨렸다.**
 * 웹은 push_subscriptions row 가 이전 user_id 로 그대로 남아:
 *   ① 로그아웃한 사람의 배송·결제 알림이 그 브라우저로 계속 온다
 *   ② 같은 브라우저의 **다음 사용자는 알림을 켤 수조차 없다** — /api/push/
 *      subscribe 가 같은 endpoint 로 부딪히기 때문(엔드포인트는 브라우저당
 *      하나다).
 *
 * 순서가 중요하다: 서버 DELETE 는 본인 세션이 필요하므로 **signOut 전에**,
 * 그리고 서버를 먼저 지운 뒤 브라우저 구독을 해제한다. `sub.unsubscribe()` 를
 * 빼면 브라우저에는 구독이 남아 다음 사용자 화면의 알림 토글이 'ON' 으로
 * 보이는데 실제로는 아무 데도 연결돼 있지 않다.
 */
async function cleanupWebPushOnLogout(): Promise<void> {
  if (isNativeApp()) return
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    })
    await sub.unsubscribe()
  } catch {
    /* 로그아웃은 계속 진행 — 막는 쪽이 더 나쁘다 */
  }
}

/**
 * 로그아웃 직전 푸시 정리 — **네이티브·웹 양쪽.**
 *
 * # 왜 하나로 합쳤나
 * 두 정리를 따로 두면 호출처(로그아웃 버튼 2곳)가 **한쪽만 부르는 실수**를
 * 반복한다. 실제로 그랬다: 네이티브만 부르고 웹은 6개월간 빠져 있었다.
 * 각 함수가 자기 환경이 아니면 스스로 빠지므로(`isNativeApp` 분기), 호출처는
 * 이것 하나만 알면 된다.
 *
 * 호출처: components/account/LogoutButton, app/(main)/mypage/MypageClient.
 */
export async function cleanupPushOnLogout(): Promise<void> {
  await cleanupNativePushOnLogout()
  await cleanupWebPushOnLogout()
}

/**
 * 네이티브 share sheet — iOS / Android 시스템 공유. 웹에선 navigator.share,
 * 그것도 없으면 클립보드 복사로 폴백.
 */
export async function nativeShare(payload: {
  title?: string
  text?: string
  url?: string
}): Promise<{ ok: boolean }> {
  if (isNativeApp()) {
    try {
      const { Share } = await import('@capacitor/share')
      await Share.share(payload)
      return { ok: true }
    } catch {
      /* fall through to web */
    }
  }
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      const nav = navigator as Navigator & {
        share: (data: {
          title?: string
          text?: string
          url?: string
        }) => Promise<void>
      }
      await nav.share(payload)
      return { ok: true }
    } catch {
      /* user cancelled or unsupported */
    }
  }
  // 마지막 폴백 — 클립보드 복사.
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard?.writeText &&
    payload.url
  ) {
    try {
      await navigator.clipboard.writeText(payload.url)
      return { ok: true }
    } catch {
      /* noop */
    }
  }
  return { ok: false }
}

