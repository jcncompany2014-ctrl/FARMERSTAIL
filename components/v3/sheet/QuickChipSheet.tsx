'use client'

/**
 * QuickChipSheet — 단일 항목 1탭 빠른 기록 (식사=식욕 · 산책=활동).
 *
 * QuickHealthSheet(식욕+배변+활동 한 번에)의 축약판 — 진입을 "딱 하나만 빠르게".
 * health_logs 의 한 컬럼(appetite | activity_level)만 채워 insert(나머지 null)
 * → 기존 폼·QuickHealthSheet 와 같은 테이블이라 기록 호환.
 *
 * **앱(PWA) 전용.** 호출자가 dogId + open/onClose 제어.
 */

import { useId, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import BottomSheet from '@/components/ui/BottomSheet'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

export type ChipOpt = readonly [value: string, label: string]

interface QuickChipSheetProps {
  open: boolean
  onClose: () => void
  dogId: string
  /** health_logs 에 채울 컬럼. */
  column: 'appetite' | 'activity_level'
  /** 큰 제목 — "오늘 밥 어땠나요?". */
  title: string
  /** 보조 안내. */
  hint?: string
  options: readonly ChipOpt[]
  onSaved?: () => void
}

export default function QuickChipSheet({
  open,
  onClose,
  dogId,
  column,
  title,
  hint,
  options,
  onSaved,
}: QuickChipSheetProps) {
  const [value, setValue] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // 동기 중복가드 — 더블탭 중복 insert 방지(HealthLogClient savingRef 패턴, 2026-07-17).
  const submittingRef = useRef(false)
  const toast = useToast()
  // 칩 그룹을 질문(h2)과 묶어 스크린리더가 맥락과 함께 읽도록.
  const titleId = useId()

  async function save() {
    if (submittingRef.current || !value) return
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
      // KST 오늘 (YYYY-MM-DD).
      const todayIso = new Date(Date.now() + 9 * 3600 * 1000)
        .toISOString()
        .slice(0, 10)
      const row = {
        dog_id: dogId,
        user_id: user.id,
        logged_at: todayIso,
        appetite: null as string | null,
        poop_quality: null,
        poop_count: null,
        activity_level: null as string | null,
        mood: null,
        note: null,
      }
      if (column === 'appetite') row.appetite = value
      else row.activity_level = value

      const { error } = await supabase.from('health_logs').insert(row)
      if (error) {
        setErr('저장하지 못했어요')
        return
      }
      setValue(null)
      toast.success('기록했어요')
      onSaved?.()
      onClose()
    } catch {
      setErr('저장하지 못했어요')
    } finally {
      setBusy(false)
      submittingRef.current = false
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      ariaLabel={title}
      dismissOnBackdrop={!busy}
    >
      <BottomSheet.Body>
        <h2
          id={titleId}
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
          {title}
        </h2>
        {hint && (
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: V3.inkMute }}>
            {hint}
          </p>
        )}

        <div
          className="flex"
          role="group"
          aria-labelledby={titleId}
          style={{ gap: 8, marginTop: 18 }}
        >
          {options.map(([v, label]) => {
            const active = value === v
            return (
              <button
                key={v}
                type="button"
                onClick={() => setValue(active ? null : v)}
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
      </BottomSheet.Body>

      <BottomSheet.Footer>
        {err && (
          <p role="alert" style={{ margin: '0 0 10px', fontSize: 12, color: V3.sale }}>
            {err}
          </p>
        )}
        <button
          onClick={save}
          disabled={busy || !value}
          className="flex items-center justify-center transition active:scale-[0.98]"
          style={{
            width: '100%',
            height: 52,
            borderRadius: 4,
            background: busy || !value ? V3.inkMute : V3.ink,
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
          {busy ? '저장 중...' : !value ? '하나 선택해주세요' : '기록 완료'}
        </button>
      </BottomSheet.Footer>
    </BottomSheet>
  )
}
