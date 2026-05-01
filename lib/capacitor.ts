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
      // registration 이벤트가 와야 토큰을 알 수 있음. 이벤트 핸들러는 한
      // 번만 unbind 해서 메모리 누수 방지.
      const success = PushNotifications.addListener('registration', (t) => {
        success.then((s) => s.remove())
        error.then((e) => e.remove())
        resolve({ ok: true, token: t.value })
      })
      const error = PushNotifications.addListener(
        'registrationError',
        (err) => {
          success.then((s) => s.remove())
          error.then((e) => e.remove())
          resolve({ ok: false, reason: err.error })
        },
      )
      PushNotifications.register().catch((err: Error) => {
        success.then((s) => s.remove())
        error.then((e) => e.remove())
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
 * 외부 URL 을 in-app browser 로 열기. iOS Safari 의 SFSafariViewController,
 * Android 의 Custom Tabs 사용 — system 브라우저로 빠져나가지 않으면서도
 * 보안/세션 분리 (예: Toss 결제 redirect) 가 자연스럽게 처리됨.
 *
 * 웹에선 그냥 window.open(_blank) 폴백.
 */
export async function openExternal(url: string): Promise<void> {
  if (isNativeApp()) {
    try {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url, presentationStyle: 'popover' })
      return
    } catch {
      /* fallback to web */
    }
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
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

/**
 * 앱이 background 에서 foreground 로 진입할 때 콜백.
 * 토큰 refresh, cart 재동기화 등에 유용.
 *
 * 웹에서는 Page Visibility API 로 폴백.
 */
export async function onAppResume(cb: () => void): Promise<() => void> {
  if (isNativeApp()) {
    try {
      const { App } = await import('@capacitor/app')
      const handle = await App.addListener('appStateChange', (state) => {
        if (state.isActive) cb()
      })
      return () => {
        handle.remove()
      }
    } catch {
      /* fall through to web */
    }
  }
  if (typeof document !== 'undefined') {
    const handler = () => {
      if (document.visibilityState === 'visible') cb()
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }
  return () => {}
}

