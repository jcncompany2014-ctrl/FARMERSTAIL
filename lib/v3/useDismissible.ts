'use client'

/**
 * useDismissible — localStorage 기반 ink hero 카드 dismiss hook (item 89).
 *
 * 사용자가 "안내 숨기기" 버튼 클릭 시 N일 동안 카드 비표시.
 *
 * @example
 *   const { dismissed, dismiss, restore } = useDismissible('todayCard:weight', 7)
 *   if (dismissed) return null
 *   return <TodayCard ... onDismiss={() => dismiss(7)} />
 */

import { useEffect, useState, useCallback, useSyncExternalStore } from 'react'

const EMPTY_SUBSCRIBE = () => () => {}

const KEY_PREFIX = 'ftv3:dismiss:'

interface UseDismissibleResult {
  /** 현재 dismiss 상태. SSR 단계에서는 false (안 가려진 상태) 반환 — hydration 안전. */
  dismissed: boolean
  /** N일 동안 숨김 처리. */
  dismiss: (days?: number) => void
  /** 즉시 복원. */
  restore: () => void
  /** 다시 노출되기까지 남은 일수 (dismissed=false 면 null). */
  daysLeft: number | null
}

export function useDismissible(
  key: string,
  defaultDays = 7,
): UseDismissibleResult {
  // hasMounted — server false / client true. useSyncExternalStore 패턴.
  const hasMounted = useSyncExternalStore<boolean>(
    EMPTY_SUBSCRIBE,
    () => true,
    () => false,
  )
  const [until, setUntil] = useState<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(KEY_PREFIX + key)
      if (raw) {
        const ts = parseInt(raw, 10)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!isNaN(ts)) setUntil(ts)
      }
    } catch {
      /* localStorage 접근 차단 (Safari private 등) — 그냥 무시 */
    }
  }, [key])

  const dismiss = useCallback(
    (days: number = defaultDays) => {
      const ts = Date.now() + days * 86_400_000
      setUntil(ts)
      try {
        window.localStorage.setItem(KEY_PREFIX + key, String(ts))
      } catch {
        /* noop */
      }
    },
    [key, defaultDays],
  )

  const restore = useCallback(() => {
    setUntil(null)
    try {
      window.localStorage.removeItem(KEY_PREFIX + key)
    } catch {
      /* noop */
    }
  }, [key])

  // Date.now() impure 회피 — useSyncExternalStore 의 server snapshot 분기로
  // SSR 단계 0 / client 단계 Date.now() 안전하게 read.
  // subscribe 는 빈 함수 — 매분/매초 갱신할 필요 없음 (render 시점 1회).
  const now = useSyncExternalStore<number>(
    EMPTY_SUBSCRIBE,
    () => Date.now(),
    () => 0,
  )

  const dismissed = hasMounted && until !== null && until > now
  const daysLeft =
    dismissed && until !== null ? Math.ceil((until - now) / 86_400_000) : null

  return { dismissed, dismiss, restore, daysLeft }
}
