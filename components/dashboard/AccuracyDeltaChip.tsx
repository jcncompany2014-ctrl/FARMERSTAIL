'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

/**
 * AccuracyDeltaChip — "지난 방문 대비 +5%p ↑" 같은 변화 chip (A-9).
 *
 * voice-guidelines §1 + audit-110.md A-9: "절대 점수보다 변화율 강조".
 * sensitivity snapshot top_variable chip 은 별도. 이건 종합 정확도 본인 추이.
 *
 * # 동작
 *  - localStorage('ft.accuracy.lastSeen.score') 를 useSyncExternalStore 로 구독
 *  - 현재 score 와 비교 → delta 계산
 *  - |delta| < 0.005 (0.5%p) 이면 chip hide
 *  - 표시 후 효과로 현재 score 를 localStorage 에 update (다음 방문 base)
 *
 * # SSR
 *  getServerSnapshot 이 null → hydration mismatch 없음. 첫 방문 시 chip 미표시.
 *
 * # 디바이스별 차이 허용
 *  localStorage 라 디바이스마다 baseline 다를 수 있음 — 본인 추이 visual
 *  feedback 이라 의미 있음. 정밀 비교 X.
 */
const KEY = 'ft.accuracy.lastSeen.score'

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  // 다른 탭에서 update 되면 storage event 발화 — 동일 탭은 setItem 직후
  // 자체 re-render 가 다른 source 로 일어남 (useEffect 의 score deps).
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

function getSnapshot(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function getServerSnapshot(): string | null {
  return null
}

export default function AccuracyDeltaChip({ score }: { score: number }) {
  const prevRaw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // score 변경 시 baseline 갱신 — 다음 방문 비교를 위해.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(KEY, score.toFixed(4))
    } catch {
      // private mode / disabled storage — 다음 방문 chip 미표시. 정상.
    }
  }, [score])

  if (prevRaw === null) return null
  const prev = parseFloat(prevRaw)
  if (!Number.isFinite(prev)) return null
  const delta = score - prev
  if (Math.abs(delta) < 0.005) return null

  const pctPoints = Math.round(delta * 100)
  if (pctPoints === 0) return null

  const up = delta > 0
  const accent = up ? 'var(--moss)' : 'var(--sale, #c4623e)'
  const label = up
    ? `지난 방문 대비 +${pctPoints}%p`
    : `지난 방문 대비 ${pctPoints}%p`

  return (
    <div className="px-5 mt-1.5 flex justify-end">
      <span
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums"
        style={{
          background: `color-mix(in srgb, ${accent} 12%, white)`,
          color: accent,
          border: `1px solid color-mix(in srgb, ${accent} 35%, transparent)`,
        }}
        aria-label={`맞춤도 ${label}`}
      >
        {up ? (
          <TrendingUp className="w-3 h-3" strokeWidth={2.4} aria-hidden />
        ) : (
          <TrendingDown className="w-3 h-3" strokeWidth={2.4} aria-hidden />
        )}
        {label}
      </span>
    </div>
  )
}
