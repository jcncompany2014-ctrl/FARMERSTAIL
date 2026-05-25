'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  ChevronUp,
  Scale,
  Footprints,
  UtensilsCrossed,
  AlertCircle,
  Sparkles,
  Loader2,
  Lock,
  LockOpen,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import {
  isLocked,
  withLockToggled,
  type LockableMethodKey,
} from '@/lib/personalization/method-lock'
import type { Json } from '@/lib/supabase/types'

/**
 * AccuracyBreakdown — 변수별 신뢰도 progress bar.
 *
 * AccuracyCard 가 종합 점수 1개만 표시한다면, 이 컴포넌트는 펼쳐서
 * 각 변수의 정밀도와 가장 약한 변수를 짚어준다.
 *
 * # voice-guidelines §1 / §4
 *  - "신뢰도" 단어 X — "정밀도" / "맞춤도"
 *  - 가장 약한 변수만 highlight (한 번에 부정 정보 한 가지)
 *  - "측정 도구 점검하면 + N% 올라요" 같은 긍정 톤
 *
 * # voice-guidelines §10
 * 접힘 상태 default — 사용자가 자발적으로 열어야 봐 진다. 압박 X.
 */

export type AccuracyVar = {
  key: 'weight' | 'activity' | 'feed'
  label: string
  score: number // 0~1
  /** 약한 변수일 때 사용자에게 보여줄 한 줄 개선 안내 */
  hint?: string
}

export default function AccuracyBreakdown({
  variables,
  dogId,
  userBoost,
  userMethodLock,
  defaultOpen = false,
}: {
  variables: AccuracyVar[]
  /** P7 — boost 토글 대상 dog. null 이면 토글 숨김 */
  dogId?: string | null
  /** 현재 dogs.accuracy_user_boost. 0 이면 토글 OFF, 0.15 면 ON. */
  userBoost?: number
  /** R32 #20 — 현재 dogs.user_method_lock JSONB. 변수별 lock 토글에 사용. */
  userMethodLock?: Json | null
  /** P14 — data_lover 페르소나용 자동 펼침 */
  defaultOpen?: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const supabase = createClient()
  const [open, setOpen] = useState(defaultOpen)
  const [busy, setBusy] = useState(false)
  // R32 #20 — 각 변수의 lock 상태 업데이트 중인지 추적 (변수 키 단위)
  const [lockBusy, setLockBusy] = useState<LockableMethodKey | null>(null)
  const boostOn = (userBoost ?? 0) > 0

  // R32 #20 — 변수별 lock 토글. voice-guidelines §9 User Sovereignty.
  // 잠그면 시스템이 더 이상 해당 변수의 측정 도구 권유를 안 보냄.
  async function toggleLock(key: LockableMethodKey) {
    if (!dogId || lockBusy) return
    setLockBusy(key)
    const currentlyLocked = isLocked(userMethodLock, key)
    const next = withLockToggled(userMethodLock, key, !currentlyLocked)
    const { error } = await supabase
      .from('dogs')
      .update({ user_method_lock: next as Json })
      .eq('id', dogId)
    setLockBusy(null)
    if (error) {
      toast.error('저장하지 못했어요')
      return
    }
    toast.success(
      currentlyLocked
        ? '권유를 다시 받을게요'
        : '이 측정 그대로 쓸게요. 권유 안 보낼게요',
    )
    router.refresh()
  }

  async function toggleBoost() {
    if (!dogId || busy) return
    setBusy(true)
    const next = boostOn ? 0 : 0.15
    const { error } = await supabase
      .from('dogs')
      .update({ accuracy_user_boost: next })
      .eq('id', dogId)
    setBusy(false)
    if (error) {
      toast.error('저장하지 못했어요')
      return
    }
    toast.success(
      next > 0 ? '맞춤도에 자기 표명을 반영했어요' : '자기 표명을 해제했어요',
    )
    router.refresh()
  }

  if (variables.length === 0) return null

  // 가장 약한 변수 1개 찾기 (점수 < 0.7 일 때만)
  const weakest = [...variables].sort((a, b) => a.score - b.score)[0]!
  const showWeakHighlight = weakest.score < 0.7

  return (
    <section className="px-5 mt-3">
      <div
        className="rounded border bg-bg-3"
        style={{ borderColor: 'var(--rule)' }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-5 py-3 text-left"
          aria-expanded={open}
          aria-controls="accuracy-breakdown-panel"
        >
          <span className="text-[12px] font-bold" style={{ color: 'var(--ink)' }}>
            변수별 맞춤도 자세히
          </span>
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted" strokeWidth={2.2} />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted" strokeWidth={2.2} />
          )}
        </button>

        {open && (
          <div
            id="accuracy-breakdown-panel"
            className="px-5 pb-4 space-y-3"
          >
            {variables.map((v) => (
              <Row
                key={v.key}
                variable={v}
                locked={isLocked(userMethodLock, v.key)}
                canLock={!!dogId}
                lockBusy={lockBusy === v.key}
                onToggleLock={() => toggleLock(v.key)}
              />
            ))}

            {showWeakHighlight && weakest.hint && (
              <div
                className="mt-3 rounded px-3 py-2.5 flex items-start gap-2"
                style={{
                  background: 'color-mix(in srgb, var(--gold) 10%, white)',
                  border:
                    '1px solid color-mix(in srgb, var(--gold) 28%, transparent)',
                }}
              >
                <AlertCircle
                  className="w-4 h-4 shrink-0 mt-0.5"
                  strokeWidth={2}
                  style={{ color: 'var(--gold)' }}
                />
                <p
                  className="text-[12px] leading-relaxed"
                  style={{ color: 'var(--ink)' }}
                >
                  <strong>{weakest.label}</strong>이 가장 약해요.{' '}
                  {weakest.hint}
                </p>
              </div>
            )}

            {/* P7 — 사용자 자기 표명 토글. User Sovereignty (A-20). 시스템이
                일방적으로 결정하지 않고 보호자가 직접 +0.15 boost. */}
            {dogId && (
              <div
                className="mt-3 rounded px-3 py-2.5 flex items-start gap-2"
                style={{
                  background: boostOn
                    ? 'color-mix(in srgb, var(--terracotta) 8%, white)'
                    : 'var(--bg)',
                  border: '1px solid var(--rule)',
                }}
              >
                <Sparkles
                  className="w-4 h-4 shrink-0 mt-0.5"
                  strokeWidth={2}
                  style={{
                    color: boostOn ? 'var(--terracotta)' : 'var(--muted)',
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[12px] leading-relaxed font-bold"
                    style={{ color: 'var(--ink)' }}
                  >
                    내 데이터는 정확해요
                  </p>
                  <p
                    className="text-[10.5px] leading-relaxed mt-0.5"
                    style={{ color: 'var(--muted)' }}
                  >
                    측정 도구가 정확하다고 표명하면 맞춤도에 +15%p 반영돼요.
                    언제든 해제할 수 있어요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleBoost}
                  disabled={busy}
                  aria-pressed={boostOn}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold transition disabled:opacity-60"
                  style={{
                    background: boostOn ? 'var(--terracotta)' : 'white',
                    color: boostOn ? 'white' : 'var(--ink)',
                    border: `1px solid ${boostOn ? 'var(--terracotta)' : 'var(--rule)'}`,
                  }}
                >
                  {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                  {boostOn ? '해제' : '표명'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function Row({
  variable,
  locked,
  canLock,
  lockBusy,
  onToggleLock,
}: {
  variable: AccuracyVar
  /** R32 #20 — 현재 잠금 상태 */
  locked: boolean
  /** dogId 있을 때만 토글 가능 */
  canLock: boolean
  /** 토글 진행 중 */
  lockBusy: boolean
  /** 클릭 시 부모가 supabase update */
  onToggleLock: () => void
}) {
  const pct = Math.round(variable.score * 100)
  const accent =
    variable.score >= 0.85
      ? 'var(--moss)'
      : variable.score >= 0.7
        ? 'var(--terracotta)'
        : variable.score >= 0.5
          ? 'var(--gold)'
          : 'var(--sale)'
  const Icon =
    variable.key === 'weight'
      ? Scale
      : variable.key === 'activity'
        ? Footprints
        : UtensilsCrossed

  return (
    <div className="flex items-center gap-3">
      <span
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{
          background: `color-mix(in srgb, ${accent} 12%, white)`,
          color: accent,
        }}
        aria-hidden
      >
        <Icon className="w-3.5 h-3.5" strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[11.5px] font-bold"
            style={{ color: 'var(--ink)' }}
          >
            {variable.label}
          </span>
          <span
            className="text-[10.5px] font-bold tabular-nums"
            style={{ color: 'var(--muted)' }}
          >
            {pct}%
          </span>
        </div>
        <div
          className="mt-1 h-1.5 rounded-full overflow-hidden"
          style={{ background: 'color-mix(in srgb var(--rule) 60%, white)' }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={`${variable.label} 맞춤도 ${pct}%`}
        >
          <div
            className="h-full rounded-full transition-[width]"
            style={{ width: `${pct}%`, background: accent }}
          />
        </div>
      </div>
      {/* R32 #20 — 변수별 lock 토글. voice-guidelines §9. */}
      {canLock && (
        <button
          type="button"
          onClick={onToggleLock}
          disabled={lockBusy}
          aria-pressed={locked}
          aria-label={
            locked
              ? `${variable.label} 권유 해제`
              : `${variable.label} 이 측정 그대로 쓰기`
          }
          title={
            locked
              ? '권유를 다시 받을게요'
              : '이 측정 그대로 — 권유 안 받을게요'
          }
          className="shrink-0 w-7 h-7 rounded-full inline-flex items-center justify-center transition disabled:opacity-50"
          style={{
            background: locked
              ? 'color-mix(in srgb, var(--ink) 8%, white)'
              : 'transparent',
            border: `1px solid ${locked ? 'var(--ink)' : 'var(--rule)'}`,
            color: locked ? 'var(--ink)' : 'var(--muted)',
          }}
        >
          {lockBusy ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : locked ? (
            <Lock className="w-3 h-3" strokeWidth={2.2} />
          ) : (
            <LockOpen className="w-3 h-3" strokeWidth={2.2} />
          )}
        </button>
      )}
    </div>
  )
}
