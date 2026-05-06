'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

/**
 * PWA 서비스 워커 등록 + 새 버전 detect 시 사용자 toast.
 *
 * Dev 환경에서는 등록하지 않고, 이미 붙어 있던 SW 는 적극적으로 해제한다.
 *
 * # 새 버전 알림
 * sw.js 의 CACHE_NAME 이 bump 됐을 때 SW 가 install → waiting 상태로 들어
 * 가는데, 이때 사용자에게 toast 로 "새 버전이 준비됐어요. [새로고침]" 안내.
 * 누르면 skipWaiting + page reload → 즉시 새 빌드 적용.
 *
 * # SSR
 * useSyncExternalStore has-mounted — 서버 단계에선 toast 렌더 안 함, mount
 * 후에만 SW state 구독. setState-in-effect 룰 회피.
 */
const EMPTY_SUBSCRIBE = () => () => {}
function useHasMounted(): boolean {
  return useSyncExternalStore<boolean>(
    EMPTY_SUBSCRIBE,
    () => true,
    () => false,
  )
}

export default function ServiceWorkerRegister() {
  const hasMounted = useHasMounted()
  const [waitingReg, setWaitingReg] =
    useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      // Dev: 기존 등록 모두 해제해서 캐시 꼬임 방지.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister())
      })
      if (typeof caches !== 'undefined') {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
      }
      return
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // 이미 waiting 중인 SW 가 있으면 (새 버전 install 완료 후 활성화 대기)
        // 즉시 toast.
        if (reg.waiting && navigator.serviceWorker.controller) {
          setWaitingReg(reg)
        }
        // updatefound — 새 SW install 시작 → installed → activated 사이클 추적.
        reg.addEventListener('updatefound', () => {
          const next = reg.installing
          if (!next) return
          next.addEventListener('statechange', () => {
            if (
              next.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // controller 가 있으면 = 이미 옛 SW 가 페이지 통제 중 = "업데이트".
              // 첫 설치 (controller 없음) 인 경우는 toast 없이 자연 활성화.
              setWaitingReg(reg)
            }
          })
        })
      })
      .catch((err) => {
        console.log('[SW] Registration failed:', err)
      })

    // controllerchange 이벤트 — skipWaiting 후 새 SW 가 활성화되면 페이지 reload.
    const onControllerChange = () => {
      if (typeof window !== 'undefined') window.location.reload()
    }
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      onControllerChange,
    )
    return () => {
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange,
      )
    }
  }, [])

  if (!hasMounted || !waitingReg?.waiting) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 rounded-full shadow-xl"
      style={{
        bottom: 'max(20px, env(safe-area-inset-bottom))',
        background: 'var(--ink)',
        color: 'var(--bg)',
      }}
    >
      <span className="text-[12px] font-bold">새 버전이 준비됐어요</span>
      <button
        type="button"
        onClick={() => {
          waitingReg.waiting?.postMessage({ type: 'SKIP_WAITING' })
          // controllerchange 가 reload 트리거. fallback: 5초 후 강제.
          setTimeout(() => window.location.reload(), 5000)
        }}
        className="text-[11px] font-bold px-3 py-1.5 rounded-full"
        style={{
          background: 'var(--terracotta)',
          color: 'var(--bg)',
        }}
      >
        새로고침
      </button>
    </div>
  )
}