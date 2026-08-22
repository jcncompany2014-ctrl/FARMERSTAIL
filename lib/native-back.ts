'use client'

import { useEffect } from 'react'

/**
 * 하드웨어 뒤로가기(안드로이드) 브리지 — 이벤트 이름 정본 + 구독 훅.
 *
 * `components/NativeShellBridge` 가 Capacitor 의 `backButton` 을 받아 이
 * 이벤트를 **취소 가능(cancelable)** 하게 발행한다. 열려 있는 오버레이가
 * `preventDefault()` 하면 화면 이동 대신 "닫기"로 끝난다.
 *
 * # 왜 필요한가
 * 안드로이드에서 바텀시트가 떠 있을 때 뒤로가기를 누르면 사용자는 **시트가
 * 닫히기를** 기대한다. 그대로 `router.back()` 을 하면 시트를 띄운 채 이전
 * 화면으로 넘어가 버려 "앱이 이상하다"가 된다. 웹 관용구가 아니라 네이티브
 * 관용구를 따라야 하는 지점.
 *
 * 웹/PWA 에서는 이 이벤트가 애초에 발행되지 않으므로 아무 영향이 없다
 * (ESC 키 처리는 `<dialog>` 가 이미 하고 있고 그대로 둔다).
 */
export const NATIVE_BACK_EVENT = 'ft:nativeback'

/**
 * `open` 인 동안 하드웨어 뒤로가기를 가로채 `onClose()` 로 돌린다.
 *
 * @param open    오버레이가 떠 있는지. false 면 구독하지 않는다 — 닫힌
 *                시트가 뒤로가기를 먹으면 사용자가 화면을 못 벗어난다.
 * @param onClose 닫기 처리.
 */
export function useNativeBackClose(open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return
    const handler = (event: Event) => {
      // preventDefault → NativeShellBridge 가 router.back()/exitApp() 을 건너뛴다.
      event.preventDefault()
      onClose()
    }
    window.addEventListener(NATIVE_BACK_EVENT, handler)
    return () => window.removeEventListener(NATIVE_BACK_EVENT, handler)
  }, [open, onClose])
}
