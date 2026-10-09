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
 *
 * 2026-10-09 'A 포스터'(시안 T16): 머리줄(제목·안내 · '닫기') · 산책 시간 = 먹선 네모 [−] ·
 * 회색 면 큰 숫자(Anton) · [+] · 활동량 네모 선택지 · 먹색 꽉 찬 버튼. 조각은 SheetParts.
 */

import { useId, useRef, useState, type CSSProperties } from 'react'
import { Minus, Plus } from 'lucide-react'
import { V3, V3Radius } from '@/lib/design/tokens'
import BottomSheet from '@/components/ui/BottomSheet'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import {
  SheetChoiceRow,
  SheetContent,
  SheetError,
  SheetHeader,
  SheetPrimaryButton,
  SheetSectionLabel,
  type SheetOption,
} from '@/components/v3/sheet/SheetParts'

const ACTIVITY: SheetOption[] = [['high', '활발'], ['normal', '보통'], ['low', '적음']]

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

/** 산책 시간 [−]·[+] — 64px 흰 네모 + 먹선(시안). 끝에 닿으면 흐리게. */
function stepStyle(disabled: boolean): CSSProperties {
  return {
    width: 64,
    height: 64,
    padding: 0,
    borderRadius: V3Radius.sm,
    background: '#FFFFFF',
    border: `1.5px solid ${V3.ink}`,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.35 : 1,
  }
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
  // 동기 중복가드 — disabled={busy}(state)는 리렌더 후 적용돼 서브프레임 더블탭이
  // 빠져나가 중복 insert 된다(HealthLogClient savingRef 와 동일 패턴, 2026-07-17).
  const submittingRef = useRef(false)
  const toast = useToast()
  const durationLabelId = useId()

  async function save() {
    if (submittingRef.current) return
    submittingRef.current = true
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
      submittingRef.current = false
    }
  }

  const atMin = duration <= MIN
  const atMax = duration >= MAX

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      ariaLabel="산책 빠른 기록"
      dismissOnBackdrop={!busy}
    >
      <BottomSheet.Body>
        <SheetContent>
          <SheetHeader
            title={`${dogName ? `${dogName} ` : ''}오늘 산책은 어땠나요?`}
            sub="시간은 15분 단위 · 활동량은 고르지 않아도 돼요"
            onClose={onClose}
          />

          {/* 산책 시간 — 15분 단위 스텝퍼 */}
          <div style={{ marginTop: 18 }}>
            <SheetSectionLabel id={durationLabelId}>산책 시간</SheetSectionLabel>
            <div
              role="group"
              aria-labelledby={durationLabelId}
              style={{
                display: 'grid',
                gridTemplateColumns: '64px minmax(0, 1fr) 64px',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                onClick={() => setDuration((d) => Math.max(MIN, d - STEP))}
                disabled={atMin}
                aria-label="15분 줄이기"
                className="flex items-center justify-center transition active:scale-95 ft-no-press"
                style={stepStyle(atMin)}
              >
                <Minus size={24} color={V3.ink} strokeWidth={2.4} aria-hidden />
              </button>

              <div
                aria-live="polite"
                aria-atomic="true"
                className="flex items-center justify-center"
                style={{
                  height: 64,
                  background: V3.soft,
                  borderRadius: V3Radius.sm,
                  color: V3.ink,
                  whiteSpace: 'nowrap',
                }}
              >
                <span className="sr-only">{`산책 시간 ${fmtDuration(duration)}`}</span>
                {duration < 60 ? (
                  <span aria-hidden className="flex items-center">
                    {/* 숫자 글꼴은 .ft-num 이 준다 — fontFamily·fontWeight 를 여기서 주지 않는다. */}
                    <span className="ft-num" style={{ fontSize: 40, lineHeight: 1 }}>
                      {duration}
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 800, marginLeft: 5 }}>분</span>
                  </span>
                ) : (
                  <span aria-hidden style={{ fontSize: 22, fontWeight: 800 }}>
                    {fmtDuration(duration)}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setDuration((d) => Math.min(MAX, d + STEP))}
                disabled={atMax}
                aria-label="15분 늘리기"
                className="flex items-center justify-center transition active:scale-95 ft-no-press"
                style={stepStyle(atMax)}
              >
                <Plus size={24} color={V3.ink} strokeWidth={2.4} aria-hidden />
              </button>
            </div>
          </div>

          {/* 활동량 (고르지 않아도 됨) */}
          <div style={{ marginTop: 18 }}>
            <SheetChoiceRow
              label="활동량"
              options={ACTIVITY}
              value={activity}
              onPick={setActivity}
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <SheetError msg={err} />
            <SheetPrimaryButton onClick={save} disabled={busy} busy={busy}>
              {busy ? '저장 중...' : `${fmtDuration(duration)} 산책 기록`}
            </SheetPrimaryButton>
          </div>
        </SheetContent>
      </BottomSheet.Body>
    </BottomSheet>
  )
}
