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

const EMPTY_SUBSCRIBE = () => () => {}

export default function UtmCapture() {
  // mount 직후 client snapshot 호출 → captureUtmFromUrl 실행 후 true 반환.
  useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => {
      captureUtmFromUrl()
      return true
    },
    () => false,
  )
  return null
}
