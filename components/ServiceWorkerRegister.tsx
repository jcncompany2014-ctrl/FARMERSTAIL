'use client'

import { useEffect } from 'react'

/**
 * PWA 서비스 워커 등록.
 *
 * Dev 환경에서는 등록하지 않고, 이미 붙어 있던 SW 는 적극적으로 해제한다.
 *
 * Why:
 *   sw.js 의 정적 자원 핸들러(스크립트/스타일/이미지)가 stale-while-revalidate
 *   전략이라, 첫 요청은 항상 캐시를 먼저 돌려준다. Prod 에서는 Next.js 가
 *   chunk 파일명에 hash 를 박으니 "새 파일 = 새 URL" 이 되어 캐시 miss →
 *   fetch 로 자연스럽게 갱신되지만, dev 에서는 HMR/chunk 이름이 더 안정적
 *   이어서 옛 번들이 붙잡혀 UI 변경이 "반영 안 된 것처럼" 보이는 일이 잦다.
 *   개발 중에는 SW 를 끄고, 붙어 있던 기존 등록도 끊어 캐시 꼬임을 막는다.
 *
 *   Prod(production) 빌드에서만 등록 — Vercel 배포/실기기 PWA 설치 시에는
 *   그대로 동작한다.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      // Dev: 기존 등록 모두 해제해서 캐시 꼬임 방지.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister())
      })
      // 캐시도 비워서 다음 리로드부터 네트워크만 타게.
      if (typeof caches !== 'undefined') {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
      }
      return
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[SW] Registered:', reg.scope)
      })
      .catch((err) => {
        console.log('[SW] Registration failed:', err)
      })
  }, [])

  return null
}