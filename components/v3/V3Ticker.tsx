'use client'

/**
 * V3Ticker — 상단 헤더의 매거진 ticker line.
 *
 * 핸드오프 패턴: `Thu 21 May · 19:01` 좌측 + `· Live` 우측 (accent).
 * 시간은 1분마다 자동 갱신. 날짜는 `lib/dateStamp` 의 캐시된 snapshot 재활용.
 *
 * SSR 단계에선 placeholder (NBSP) 만 그려 hydration mismatch 방지.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { getStampSnapshot, EMPTY_SUBSCRIBE } from '@/lib/dateStamp'
import Mono from './Mono'

export default function V3Ticker() {
  // hasMounted via useSyncExternalStore — SSR 에서 false, client 에서 true.
  // mount 후 stamp + time 한 번에 swap → hydration mismatch 없음.
  const hasMounted = useSyncExternalStore<boolean>(
    EMPTY_SUBSCRIBE,
    useCallback(() => true, []),
    useCallback(() => false, []),
  )

  const [hhmm, setHhmm] = useState<string>('')

  useEffect(() => {
    function tick() {
      const now = new Date()
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      setHhmm(`${hh}:${mm}`)
    }
    tick()
    // 다음 분 경계까지 대기 후 60초 간격으로 갱신 — 매분 정시에 흔들리지 않게.
    const now = new Date()
    const msToNextMin = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()
    const timeout = setTimeout(() => {
      tick()
      const interval = setInterval(tick, 60_000)
      // cleanup 위해 interval id 를 timeout closure 에 저장.
      ;(timeout as unknown as { _interval?: ReturnType<typeof setInterval> })._interval = interval
    }, msToNextMin)
    return () => {
      clearTimeout(timeout)
      const i = (timeout as unknown as { _interval?: ReturnType<typeof setInterval> })._interval
      if (i) clearInterval(i)
    }
  }, [])

  const stamp = hasMounted ? getStampSnapshot() : null
  // 예: "Thu 21 May · 19:01"
  const left = stamp
    ? `${capFirst(stamp.weekday)} ${stamp.day} ${capFirst(stamp.month)} · ${hhmm || '--:--'}`
    : '          '

  return (
    <div className="flex items-center justify-between" aria-hidden>
      <Mono color="ink" size="xxs" weight={500} letterSpacing="0.16em">
        {left}
      </Mono>
      <Mono color="accent" size="xxs" weight={600} letterSpacing="0.16em">
        · Live
      </Mono>
    </div>
  )
}

/** "THU" → "Thu" — Mono 컴포넌트가 uppercase 자동 처리하므로 입력은 소문자로. */
function capFirst(s: string): string {
  if (!s) return s
  return s.charAt(0) + s.slice(1).toLowerCase()
}
