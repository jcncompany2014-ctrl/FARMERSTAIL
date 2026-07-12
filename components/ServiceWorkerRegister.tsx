'use client'

import { useEffect } from 'react'

/**
 * PWA 서비스 워커 등록 — 푸시 알림 + 오프라인 fallback 용.
 *
 * Dev 환경에서는 등록하지 않고, 이미 붙어 있던 SW 는 적극 해제(캐시 꼬임 방지).
 *
 * # 업데이트 UX (2026-07-12 사장님 — "새 버전이 준비됐어요 · 새로고침" 토스트 제거)
 * 예전엔 새 SW install 시 하단에 토스트를 띄워 [새로고침] 을 유도했는데, 거슬려서
 * 제거. 이제 새 버전은 조용히 install → waiting 후, 사용자가 앱을 완전히 껐다
 * 켜는 다음 실행에서 자연 활성화된다 (강제 리로드 없음 → 결제·설문 입력이 안 끊김).
 * 앱 페이지 HTML 은 network-first + JS 청크는 해시별 브라우저 캐시라, SW 활성화
 * 전에도 콘텐츠는 최신으로 유지된다. (sw.js 의 SKIP_WAITING 핸들러는 잔존하지만
 * 이제 아무도 호출하지 않음 — 무해.)
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      // Dev: 기존 등록 + 캐시 모두 해제. fire-and-forget.
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => void r.unregister())
      })
      if (typeof caches !== 'undefined') {
        void caches
          .keys()
          .then((keys) => keys.forEach((k) => void caches.delete(k)))
      }
      return
    }

    // Prod: 등록만. 새 버전은 다음 앱 실행에서 조용히 활성화(위 주석 참조).
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      // 등록 실패는 user-impact 없음(푸시/오프라인만 disabled). Sentry 로 승격.
      console.error('[SW] Registration failed:', err)
    })
  }, [])

  return null
}
