'use client'

import { useEffect, useState } from 'react'
import { Moon, Loader2 } from 'lucide-react'

/**
 * 푸시 카테고리 토글 + quiet hours 설정 UI.
 *
 * 마운트 시 /api/push/preferences 에서 GET, 각 토글/셀렉트는 즉시 PATCH 로 반영.
 * 낙관적 UI: 로컬 state 를 먼저 올리고, 실패 시 원복.
 */

type Prefs = {
  notify_order: boolean
  notify_restock: boolean
  notify_cart: boolean
  notify_marketing: boolean
  quiet_hours_start: number | null
  quiet_hours_end: number | null
}

const CATEGORIES: { key: keyof Prefs; label: string; hint: string }[] = [
  { key: 'notify_order', label: '주문 · 배송', hint: '결제/배송 단계 변화를 받을게요' },
  { key: 'notify_restock', label: '재입고 알림', hint: '기다리던 상품이 돌아오면 알려드려요' },
  { key: 'notify_cart', label: '장바구니 리마인더', hint: '담은 상품을 잊지 않게 살짝 알려드릴게요' },
  { key: 'notify_marketing', label: '프로모션 · 쿠폰', hint: '할인·신상품 소식 (선택)' },
]

export default function PreferencesPanel() {
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [saving, setSaving] = useState<keyof Prefs | 'quiet' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/push/preferences')
        const data = await res.json()
        if (!mounted) return
        if (data?.prefs) setPrefs(data.prefs as Prefs)
      } catch {
        if (mounted) setError('설정을 불러오지 못했어요')
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  async function patch(partial: Partial<Prefs>, key: keyof Prefs | 'quiet') {
    if (!prefs) return
    setError(null)
    setSaving(key)
    const prev = prefs
    const optimistic = { ...prefs, ...partial }
    setPrefs(optimistic)
    try {
      const res = await fetch('/api/push/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.message ?? '저장 실패')
        setPrefs(prev)
      }
    } catch {
      setError('네트워크 오류')
      setPrefs(prev)
    } finally {
      setSaving(null)
    }
  }

  if (!prefs) {
    return (
      <div className="bg-white rounded-2xl border border-rule p-6 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted" strokeWidth={2} />
      </div>
    )
  }

  const quietOn = prefs.quiet_hours_start !== null && prefs.quiet_hours_end !== null

  return (
    <div className="bg-white rounded-2xl border border-rule p-5 space-y-4">
      <div>
        <span className="kicker kicker-muted">Categories · 카테고리</span>
        <ul className="mt-3 space-y-3">
          {CATEGORIES.map((c) => {
            const on = Boolean(prefs[c.key])
            const busy = saving === c.key
            return (
              <li key={c.key} className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => patch({ [c.key]: !on } as Partial<Prefs>, c.key)}
                  disabled={busy}
                  role="switch"
                  aria-checked={on}
                  aria-label={c.label}
                  className={`relative w-10 h-6 rounded-full transition shrink-0 mt-0.5 ${
                    on ? 'bg-moss' : 'bg-rule'
                  } disabled:opacity-50`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                      on ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </button>
                <div className="flex-1">
                  <p className="text-[12px] font-bold text-text">{c.label}</p>
                  <p className="text-[10px] text-muted mt-0.5 leading-relaxed">
                    {c.hint}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="border-t border-rule pt-4">
        <div className="flex items-center gap-2">
          <Moon className="w-3.5 h-3.5 text-muted" strokeWidth={2} />
          <span className="kicker kicker-muted">Quiet hours · 조용한 시간</span>
        </div>
        <p className="text-[10px] text-muted mt-1.5 leading-relaxed">
          이 시간대에는 푸시가 울리지 않아요. 한국 시간 기준이에요.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={quietOn}
              onChange={(e) =>
                patch(
                  e.target.checked
                    ? { quiet_hours_start: 22, quiet_hours_end: 8 }
                    : { quiet_hours_start: null, quiet_hours_end: null },
                  'quiet',
                )
              }
              className="accent-moss"
            />
            <span className="text-[11px] font-bold text-text">사용</span>
          </label>
          {quietOn && (
            <>
              <select
                aria-label="시작 시각"
                value={prefs.quiet_hours_start ?? 22}
                onChange={(e) => patch({ quiet_hours_start: Number(e.target.value) }, 'quiet')}
                className="px-2 py-1 rounded-lg bg-bg border border-rule text-[11px] font-bold text-text"
              >
                {Array.from({ length: 24 }).map((_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, '0')}시
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-muted">부터</span>
              <select
                aria-label="종료 시각"
                value={prefs.quiet_hours_end ?? 8}
                onChange={(e) => patch({ quiet_hours_end: Number(e.target.value) }, 'quiet')}
                className="px-2 py-1 rounded-lg bg-bg border border-rule text-[11px] font-bold text-text"
              >
                {Array.from({ length: 24 }).map((_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, '0')}시
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-muted">까지</span>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="text-[11px] font-bold text-sale">{error}</p>
      )}
    </div>
  )
}
