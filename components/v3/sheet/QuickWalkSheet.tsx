'use client'

/**
 * QuickWalkSheet — 산책 빠른 기록 (활동량 칩 + 산책 시간 15분 단위).
 *
 * 두 곳에 나눠 저장(각각 제 위치):
 *   - 활동량(활발/보통/적음) → health_logs.activity_level (대시보드·건강 추이 호환)
 *   - 산책 시간(분, 15분 단위) → activity_logs (activity_type:'walk', duration_min)
 *     ↑ 산책 시간 전용 컬럼은 activity_logs 에만 있음(health_logs 엔 없음).
 *
 * 시간은 항상 기록(기본 30분), 활동량은 선택. **앱(PWA) 전용.**
 */

import { useState } from 'react'
import { Check, Minus, Plus } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import BottomSheet from '@/components/ui/BottomSheet'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

type Opt = readonly [value: string, label: string]
const ACTIVITY: Opt[] = [['high', '활발'], ['normal', '보통'], ['low', '적음']]

// 산책 시간은 15분 단위(사장님 2026-07-16). 30분 단위는 너무 성겨서 실제 산책과 안 맞음.
const STEP = 15
const MIN = 15
const MAX = 300

interface QuickWalkSheetProps {
  open: boolean
  onClose: () => void
  dogId: string
  dogName?: string
  onSaved?: () => void
}

function fmtDuration(min: number): string {
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

export default function QuickWalkSheet({
  open,
  onClose,
  dogId,
  dogName,
  onSaved,
}: QuickWalkSheetProps) {
  const [activity, setActivity] = useState<string | null>(null)
  const [duration, setDuration] = useState(30)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const toast = useToast()

  async function save() {
    if (busy) return
    setBusy(true)
    setErr(null)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setErr('로그인이 필요해요')
        return
      }

      // 1) 산책 시간 → activity_logs (walk).
      const { error: walkErr } = await supabase.from('activity_logs').insert({
        dog_id: dogId,
        user_id: user.id,
        activity_type: 'walk',
        duration_min: duration,
      })
      if (walkErr) {
        setErr('저장하지 못했어요')
        return
      }

      // 2) 활동량(선택) → health_logs.activity_level.
      // 산책 시간(activity_logs)은 이미 저장됨 — 활동량은 부가라 실패해도 산책
      // 기록 자체는 유효. 성공 처리하되 운영 가시성 위해 로깅만.
      if (activity) {
        const todayIso = new Date(Date.now() + 9 * 3600 * 1000)
          .toISOString()
          .slice(0, 10)
        const { error: actErr } = await supabase.from('health_logs').insert({
          dog_id: dogId,
          user_id: user.id,
          logged_at: todayIso,
          appetite: null,
          poop_quality: null,
          poop_count: null,
          activity_level: activity,
          mood: null,
          note: null,
        })
        if (actErr) {
          console.error('[QuickWalkSheet] activity_level insert failed', actErr)
        }
      }

      setActivity(null)
      setDuration(30)
      toast.success('산책을 기록했어요')
      onSaved?.()
      onClose()
    } catch {
      setErr('저장하지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      ariaLabel="산책 빠른 기록"
      dismissOnBackdrop={!busy}
    >
      <BottomSheet.Body>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 24,
            color: V3.ink,
            letterSpacing: '-0.02em',
            wordBreak: 'keep-all',
          }}
        >
          {dogName ? `${dogName} ` : ''}오늘 산책은 어땠나요?
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: V3.inkMute }}>
          시간은 30분 단위 · 활동량은 선택
        </p>

        {/* 산책 시간 — 30분 단위 스텝퍼 */}
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: V3FontWeight.bold,
              color: V3.inkSoft,
              marginBottom: 8,
            }}
          >
            산책 시간
          </div>
          <div
            className="flex items-center"
            style={{
              gap: 10,
              background: V3.paperHi,
              border: `1.5px solid ${V3.ink}`,
              borderRadius: 4,
              padding: '10px 12px',
            }}
          >
            <button
              type="button"
              onClick={() => setDuration((d) => Math.max(MIN, d - STEP))}
              disabled={duration <= MIN}
              aria-label="30분 줄이기"
              className="flex items-center justify-center transition active:scale-90"
              style={{
                width: 40,
                height: 40,
                borderRadius: 4,
                background: V3.paper,
                border: `1px solid ${V3.rule}`,
                cursor: duration <= MIN ? 'default' : 'pointer',
                opacity: duration <= MIN ? 0.4 : 1,
              }}
            >
              <Minus size={18} color={V3.ink} strokeWidth={2.2} />
            </button>
            <div
              aria-live="polite"
              aria-label={`산책 시간 ${fmtDuration(duration)}`}
              className="tabular-nums flex-1 text-center"
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: V3FontWeight.black,
                fontSize: 26,
                color: V3.ink,
                letterSpacing: '-0.02em',
              }}
            >
              {fmtDuration(duration)}
            </div>
            <button
              type="button"
              onClick={() => setDuration((d) => Math.min(MAX, d + STEP))}
              disabled={duration >= MAX}
              aria-label="30분 늘리기"
              className="flex items-center justify-center transition active:scale-90"
              style={{
                width: 40,
                height: 40,
                borderRadius: 4,
                background: V3.paper,
                border: `1px solid ${V3.rule}`,
                cursor: duration >= MAX ? 'default' : 'pointer',
                opacity: duration >= MAX ? 0.4 : 1,
              }}
            >
              <Plus size={18} color={V3.ink} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* 활동량 칩 (선택) */}
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: V3FontWeight.bold,
              color: V3.inkSoft,
              marginBottom: 8,
            }}
          >
            활동량
          </div>
          <div className="flex" role="group" aria-label="활동량" style={{ gap: 8 }}>
            {ACTIVITY.map(([v, label]) => {
              const active = activity === v
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setActivity(active ? null : v)}
                  aria-pressed={active}
                  className="transition active:scale-95 ft-no-press"
                  style={{
                    flex: 1,
                    padding: '14px 4px',
                    borderRadius: 999,
                    background: active ? V3.ink : V3.paperHi,
                    color: active ? V3.paper : V3.ink,
                    border: `1px solid ${active ? V3.ink : V3.rule}`,
                    fontFamily: 'var(--font-sans)',
                    fontWeight: V3FontWeight.bold,
                    fontSize: 13.5,
                    letterSpacing: '-0.01em',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </BottomSheet.Body>

      <BottomSheet.Footer>
        {err && (
          <p role="alert" style={{ margin: '0 0 10px', fontSize: 12, color: V3.sale }}>
            {err}
          </p>
        )}
        <button
          onClick={save}
          disabled={busy}
          className="flex items-center justify-center transition active:scale-[0.98]"
          style={{
            width: '100%',
            height: 52,
            borderRadius: 4,
            background: busy ? V3.inkMute : V3.ink,
            color: V3.paper,
            border: 'none',
            cursor: busy ? 'wait' : 'pointer',
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.bold,
            fontSize: 16,
            gap: 8,
          }}
        >
          <Check size={18} color={V3.paper} strokeWidth={2.2} />
          {busy ? '저장 중...' : `${fmtDuration(duration)} 산책 기록`}
        </button>
      </BottomSheet.Footer>
    </BottomSheet>
  )
}
