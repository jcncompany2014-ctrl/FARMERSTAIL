'use client'

/**
 * AppChrome 헤더 좌측 — 로고 옆에 붙는 에디토리얼 데이트 스탬프.
 *
 * 매거진 마스트헤드 시그니처를 헤더로 끌어내려 브랜드 정체성을 매 페이지에서
 * 유지한다. Dashboard 마스트헤드의 같은 stamp 를 공유하지만 이 위치는 고정
 * chrome 이라 모든 (main) 라우트에서 보인다.
 *
 * # 시각 디테일
 *
 * - 폰트 mono · 9px · letter-spacing 0.2em — Dashboard 마스트헤드와 동일 톤.
 * - 색상 var(--muted) — 로고 (ink) 보다 한 단계 가라앉혀 시각 위계 유지.
 * - 좌측 1px terracotta 세로 hairline — 로고와의 시각 구획 (ID 카드 스탬프 느낌).
 * - 한 줄: `MON · 24 APR` (요일·일·월).
 *
 * # SSR
 *
 * `lib/dateStamp.ts` 의 client-only 스냅샷을 사용하므로 SSR 단계에선 placeholder
 * (`&nbsp;`) 가 그려지고 hydration 후 실제 stamp 가 채워진다. 폭은 mono 폰트 +
 * 고정 글자수라서 layout shift 가 거의 없다.
 */

import { useCallback, useSyncExternalStore } from 'react'
import {
  EMPTY_SUBSCRIBE,
  getStampSnapshot,
  getServerStampSnapshot,
  type EditorialStamp,
} from '@/lib/dateStamp'

export default function ChromeStamp() {
  const getClient = useCallback(() => getStampSnapshot(), [])
  const getServer = useCallback(() => getServerStampSnapshot(), [])
  const stamp = useSyncExternalStore<EditorialStamp | null>(
    EMPTY_SUBSCRIBE,
    getClient,
    getServer,
  )

  return (
    <div
      className="flex items-center pl-2.5 ml-1 border-l"
      style={{
        borderColor: 'var(--terracotta)',
        borderLeftWidth: 1,
        height: 18,
        marginTop: 1,
      }}
      aria-hidden="true"
    >
      <span
        className="font-mono leading-none"
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.2em',
          color: 'var(--muted)',
        }}
      >
        {stamp ? `${stamp.weekday} · ${stamp.day} ${stamp.month}` : ' '}
      </span>
    </div>
  )
}
