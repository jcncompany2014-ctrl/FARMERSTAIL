'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import {
  isLocked,
  withLockToggled,
  type LockableMethodKey,
} from '@/lib/personalization/method-lock'
import type { Json } from '@/lib/supabase/types'
import { iGa } from '@/lib/korean'
import { V3, V3Shadow } from '@/lib/design/tokens'
import { Spinner } from '@/components/ui/Spinner'

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
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 A14 — 이 컴포넌트는 /mypage/accuracy 에서만 쓴다):
 *   머스타드 바탕 + 먹선 2px + 도장 그림자 카드(화면의 핵심), 흰 머리 버튼 56, 항목 줄 68(아이콘 원 36 · 막대 8 ·
 *   잠금 칸 48). 막대: 70% 이상 먹색 · 그 아래(약한 항목) 흰색. 문구: '변수별' → '항목별',
 *   "+15%p 반영돼요. 언제든 해제할 수 있어요" → "반영돼요. 다시 누르면 해제돼요"(% 수치·'언제든' 빼기).
 *   저장(잠금·표명) 로직은 그대로.
 */

export type AccuracyVar = {
  key: 'weight' | 'activity' | 'feed'
  label: string
  score: number // 0~1
  /** 약한 변수일 때 사용자에게 보여줄 한 줄 개선 안내 */
  hint?: string
}

const ICON = {
  width: 19,
  height: 19,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: V3.ink,
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** 시안 A14 의 항목 아이콘 — 체중(저울) · 활동(발자국) · 급여(포크·나이프). */
function VarIcon({ k }: { k: AccuracyVar['key'] }) {
  if (k === 'weight')
    return (
      <svg {...ICON}>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M8.5 9.5a5 5 0 0 1 7 0" />
        <path d="M12 9.5l1.5-1.5" />
      </svg>
    )
  if (k === 'activity')
    return (
      <svg {...ICON}>
        <path d="M4 16v-2.4C4 11.5 3 10.5 3 8c0-2.7 1.5-6 4.5-6C9.4 2 10 3.8 10 5.5c0 3.1-2 5.7-2 8.7V16a2 2 0 1 1-4 0z" />
        <path d="M20 20v-2.4c0-2.1 1-3.1 1-5.6 0-2.7-1.5-6-4.5-6-1.9 0-2.5 1.8-2.5 3.5 0 3.1 2 5.7 2 8.7V20a2 2 0 1 0 4 0z" />
      </svg>
    )
  return (
    <svg {...ICON}>
      <path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1-3 3-3 6v3h3v9" />
    </svg>
  )
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
    <section
      aria-label="항목별 맞춤도"
      style={{
        margin: '22px 20px 0',
        border: `2px solid ${V3.ink}`,
        boxShadow: V3Shadow.stamp,
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        background: V3.mustard,
        color: V3.ink,
        lineHeight: 'normal',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="accuracy-breakdown-panel"
        className="ft-no-press"
        style={{
          height: 56,
          padding: '0 12px 0 16px',
          border: 0,
          borderBottom: open ? '1px solid rgba(20,20,20,0.2)' : 0,
          background: '#FFFFFF',
          color: V3.ink,
          fontSize: 17,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        항목별 맞춤도 자세히
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
        </svg>
      </button>

      {open && (
        <div id="accuracy-breakdown-panel" style={{ padding: '6px 12px 16px 16px', display: 'flex', flexDirection: 'column' }}>
          {variables.map((v, i) => (
            <Row
              key={v.key}
              variable={v}
              last={i === variables.length - 1}
              locked={isLocked(userMethodLock, v.key)}
              canLock={!!dogId}
              lockBusy={lockBusy === v.key}
              onToggleLock={() => toggleLock(v.key)}
            />
          ))}

          {showWeakHighlight && weakest.hint && (
            <div
              style={{
                marginTop: 12,
                padding: 14,
                borderRadius: 4,
                background: 'rgba(255,255,255,0.5)',
                display: 'grid',
                gridTemplateColumns: '20px 1fr',
                columnGap: 10,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={V3.mustard} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ marginTop: 1 }}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v6M12 16.5h.01" />
              </svg>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, wordBreak: 'keep-all' }}>
                {/* '급여가'처럼 받침 없는 이름도 조사가 맞게(예전엔 늘 '이'). */}
                <strong style={{ fontWeight: 800 }}>{weakest.label}</strong>
                {iGa(weakest.label).slice(weakest.label.length)} 가장 약해요. {weakest.hint}
              </p>
            </div>
          )}

          {/* P7 — 사용자 자기 표명 토글. User Sovereignty (A-20). 시스템이
              일방적으로 결정하지 않고 보호자가 직접 +0.15 boost. */}
          {dogId && (
            <div
              style={{
                marginTop: 8,
                padding: 14,
                borderRadius: 4,
                border: `1.5px solid ${boostOn ? V3.ink : '#D5D3D4'}`,
                background: boostOn ? 'rgba(255,255,255,0.5)' : 'transparent',
                display: 'grid',
                gridTemplateColumns: '20px 1fr auto',
                columnGap: 10,
                alignItems: 'start',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill={boostOn ? V3.ink : '#8A8A8A'} aria-hidden style={{ marginTop: 1 }}>
                <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
              </svg>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 800 }}>내 데이터는 정확해요</span>
                <span style={{ fontSize: 14, lineHeight: 1.55, wordBreak: 'keep-all' }}>
                  측정 도구가 정확하다고 알려 주시면 맞춤도에 반영돼요. 다시 누르면 해제돼요.
                </span>
              </span>
              <button
                type="button"
                onClick={toggleBoost}
                disabled={busy}
                aria-pressed={boostOn}
                style={{
                  height: 48,
                  padding: '0 14px',
                  border: `1.5px solid ${V3.ink}`,
                  borderRadius: 4,
                  background: boostOn ? V3.ink : '#FFFFFF',
                  color: boostOn ? '#FFFFFF' : V3.ink,
                  fontSize: 15,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: busy ? 'wait' : 'pointer',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy && <Spinner size={12} />}
                {boostOn ? '해제' : '표명'}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function Row({
  variable,
  last,
  locked,
  canLock,
  lockBusy,
  onToggleLock,
}: {
  variable: AccuracyVar
  last: boolean
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
  // 약한 항목(70% 미만)은 흰 막대 — 시안 A14(먹색 = 충분, 흰색 = 보강할 곳).
  const fill = variable.score < 0.7 ? '#FFFFFF' : V3.ink

  return (
    <div
      style={{
        minHeight: 68,
        display: 'grid',
        gridTemplateColumns: canLock ? '36px 1fr 48px' : '36px 1fr',
        columnGap: 12,
        alignItems: 'center',
        borderBottom: last ? 0 : '1px solid rgba(20,20,20,0.2)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          background: 'rgba(255,255,255,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <VarIcon k={variable.key} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 17, fontWeight: 800 }}>{variable.label}</span>
          <span style={{ whiteSpace: 'nowrap' }}>
            <span className="ft-num" style={{ fontSize: 20 }}>
              {pct}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>%</span>
          </span>
        </span>
        <span
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={`${variable.label} 맞춤도 ${pct}%`}
          style={{ height: 8, background: 'rgba(255,255,255,0.5)', display: 'flex' }}
        >
          <span style={{ width: `${pct}%`, background: fill }} />
        </span>
      </span>
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
          style={{
            width: 48,
            height: 48,
            border: `1.5px solid ${locked ? V3.ink : '#D5D3D4'}`,
            borderRadius: 4,
            background: locked ? V3.ink : '#FFFFFF',
            color: locked ? '#FFFFFF' : V3.ink,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: lockBusy ? 'wait' : 'pointer',
            opacity: lockBusy ? 0.6 : 1,
          }}
        >
          {lockBusy ? (
            <Spinner size={14} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d={locked ? 'M8 11V7a4 4 0 0 1 8 0v4' : 'M8 11V7a4 4 0 0 1 7.5-2'} />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}
