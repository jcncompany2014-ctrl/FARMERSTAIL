'use client'

/**
 * UtmCapture — root layout mount 시 utm_* params 캡쳐. R39c (#29).
 *
 * 한 번 mount 후 sessionStorage 에 저장. 별도 시각 표시 X.
 * useSyncExternalStore 의 client snapshot 만 활용 — Suspense / hydration
 * mismatch 없음.
 */
import { useSyncExternalStore } from 'react'
import { captureUtmFromUrl } from '@/lib/utm'
import { captureFirstTouchFromUrl } from '@/lib/analytics'

const EMPTY_SUBSCRIBE = () => () => {}

export default function UtmCapture() {
  // mount 직후 client snapshot 호출 → 캡처 실행 후 true 반환.
  // last-touch(세션, purchase 에 실림) + first-touch(30일 localStorage,
  // sign_up 에 실림) 둘 다 — 후자는 2026-07-19 이전까지 호출처 0이라
  // first-touch 저장이 영원히 비어 있었다(잔재 스윕에서 배선).
  useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => {
      captureUtmFromUrl()
      captureFirstTouchFromUrl()
      return true
    },
    () => false,
  )
  return null
}
