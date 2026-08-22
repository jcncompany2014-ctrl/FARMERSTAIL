'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isNativeApp } from '@/lib/capacitor'
import { nativeTargetPath } from '@/lib/native-nav'
import { NATIVE_BACK_EVENT } from '@/lib/native-back'

/**
 * 네이티브 셸 ↔ 웹 앱 연결다리 (2026-08-20 — Play Store 출시 준비).
 *
 * 렌더링하는 것이 없다(`null`). 웹/PWA 에서는 `isNativeApp()` 에서 즉시 빠지므로
 * 루트 레이아웃에 두어도 웹 시각에 영향이 0 이다(AGENTS.md 의 "행위만 제공하는
 * root-level provider" 허용 항목).
 *
 * # 없어서 무슨 일이 났나 (R100-C — 셋 다 핸들러가 아예 없었다)
 *
 * 1. **푸시를 눌러도 홈만 뜬다.** 서버는 `/mypage/subscriptions` 같은 목적지를
 *    실어 보내고 있었는데(lib/push/native.ts) 받는 쪽이 없어 전부 버려졌다.
 *    "결제 실패" 알림을 눌러도 결제 화면으로 가지 않는다.
 * 2. **App Links 가 죽어 있다.** assetlinks.json 라우트까지 만들어 두고도
 *    `appUrlOpen` 을 안 들어서, 메일·카톡의 링크로 앱이 열려도 첫 화면에 선다.
 * 3. **뒤로가기가 먹통.** Capacitor 기본 동작은 리스너가 없으면
 *    `if (canGoBack) goBack()` **뿐**이다(AppPlugin.java 실측). 뒤로 갈 곳이
 *    없으면 아무 일도 안 일어나 사용자가 앱에 갇힌다 — 안드로이드에서 이건
 *    "앱이 멈췄다"로 읽힌다.
 *
 * # 왜 목적지를 검증하나
 * `appUrlOpen` 은 **기기의 아무 앱이나** 인텐트로 쏠 수 있고, Next 문서도
 * "검증하지 않은 URL 을 router.push 에 넘기면 `javascript:` 가 우리 페이지
 * 컨텍스트에서 실행된다"고 못 박는다. 그래서 모든 목적지는 예외 없이
 * `nativeTargetPath()` 를 통과해야 한다(정본 · 테스트 lib/native-nav.test.ts).
 *
 * # 외부 도메인(결제창)에서 뒤로가기가 막히지 않는 이유
 * Capacitor 는 `onPageStarted` 마다 `bridge.reset()` → `removeAllListeners()`
 * 를 한다(BridgeWebViewClient.java 실측). 토스 결제창처럼 다른 도메인으로
 * 넘어가면 우리 리스너가 자동으로 사라져 **기본 동작(goBack)이 되살아난다.**
 * 우리 페이지로 돌아오면 이 컴포넌트가 다시 등록한다.
 */

export default function NativeShellBridge() {
  const router = useRouter()

  useEffect(() => {
    if (!isNativeApp()) return

    let cancelled = false
    const removers: Array<() => void> = []

    // 등록이 await 뒤에 끝나므로, 그 사이 unmount 됐으면 즉시 떼어낸다.
    const track = (handle: { remove: () => Promise<void> }) => {
      if (cancelled) {
        void handle.remove()
        return
      }
      removers.push(() => void handle.remove())
    }

    const go = (raw: unknown) => {
      const path = nativeTargetPath(raw)
      // 미심쩍으면 아무 데도 안 간다 — 홈으로 튕기지 않는다. 엉뚱한 화면을
      // 여는 것보다 보던 화면에 그대로 두는 쪽이 낫다.
      if (path) router.push(path)
    }

    void (async () => {
      try {
        const { App } = await import('@capacitor/app')

        // 콜드 스타트 — 앱이 꺼진 상태에서 링크를 누르면 `appUrlOpen` 은 이미
        // 지나간 뒤라 오지 않는다. 시작 URL 을 따로 읽어야 한다.
        const launch = await App.getLaunchUrl().catch(() => undefined)
        if (!cancelled && launch?.url) go(launch.url)

        track(await App.addListener('appUrlOpen', (event) => go(event.url)))

        track(
          await App.addListener('backButton', ({ canGoBack }) => {
            // dispatchEvent 는 preventDefault 가 불렸으면 false 를 준다.
            const notIntercepted = window.dispatchEvent(
              new CustomEvent(NATIVE_BACK_EVENT, { cancelable: true }),
            )
            if (!notIntercepted) return
            // ★2026-08-22 — 일반 방어: 열려 있는 <dialog>(바텀시트·모달)가
            // 있으면 화면 이동 대신 그것만 닫는다. 개별 컴포넌트가
            // useNativeBackClose 를 깜빡해도 여기서 잡힌다 — 실제로 주소
            // 입력 시트가 떠 있는데 뒤로가기가 화면을 통째로 넘겨버렸다
            // (사장님 재현). close() 는 dialog 의 'close' 이벤트를 발화하므로
            // 각 시트의 onClose 상태 동기화가 그대로 따라온다.
            const openDialog = document.querySelector('dialog[open]')
            if (openDialog instanceof HTMLDialogElement) {
              openDialog.close()
              return
            }
            if (canGoBack) {
              router.back()
              return
            }
            // 더 갈 곳이 없으면 앱을 닫는다 — 안드로이드 관습.
            void App.exitApp()
          }),
        )
      } catch {
        /* @capacitor/app 없음 — 웹 폴백. 아무 일도 하지 않는다. */
      }

      try {
        const { PushNotifications } = await import(
          '@capacitor/push-notifications'
        )
        track(
          await PushNotifications.addListener(
            'pushNotificationActionPerformed',
            // FCM 은 message.data.url, APNs 는 payload 루트의 url — Capacitor
            // 가 양쪽 다 notification.data 로 넘겨준다(lib/push/native.ts).
            (action) => go(action.notification.data?.url),
          ),
        )
      } catch {
        /* 푸시 플러그인 없음 */
      }
    })()

    return () => {
      cancelled = true
      for (const remove of removers) remove()
      removers.length = 0
    }
  }, [router])

  return null
}
