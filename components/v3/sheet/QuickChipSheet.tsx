'use client'

/**
 * QuickChipSheet — 단일 항목 1탭 빠른 기록 (식사=식욕 · 산책=활동).
 *
 * QuickHealthSheet(식욕+배변+활동 한 번에)의 축약판 — 진입을 "딱 하나만 빠르게".
 * health_logs 의 한 컬럼(appetite | activity_level)만 채워 insert(나머지 null)
 * → 기존 폼·QuickHealthSheet 와 같은 테이블이라 기록 호환.
 *
 * 2026-10-09 'A 포스터'(시안 T17): 머리줄(제목·안내 · '닫기') · (label 을 받으면) 작은 묶음 이름
 * · 네모 선택지 · 먹색 꽉 찬 버튼. 조각은 SheetParts.
 *
 * **앱(PWA) 전용.** 호출자가 dogId + open/onClose 제어.
 */

import { useId, useRef, useState } from 'react'
import BottomSheet from '@/components/ui/BottomSheet'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import {
  SheetChoiceRow,
  SheetContent,
  SheetError,
  SheetHeader,
  SheetPrimaryButton,
} from '@/components/v3/sheet/SheetParts'

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
  /** 선택지 위 작은 묶음 이름 — "식욕"(시안 T17). 없으면 그리지 않고 제목이 묶음 이름이 된다. */
  label?: string
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
  label,
  onSaved,
}: QuickChipSheetProps) {
  const [value, setValue] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // 동기 중복가드 — 더블탭 중복 insert 방지(HealthLogClient savingRef 패턴, 2026-07-17).
  const submittingRef = useRef(false)
  const toast = useToast()
  // 칩 그룹을 질문(h2)과 묶어 스크린리더가 맥락과 함께 읽도록(label 이 없을 때).
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
        <SheetContent>
          <SheetHeader title={title} sub={hint} onClose={onClose} titleId={titleId} />

          <div style={{ marginTop: 18 }}>
            <SheetChoiceRow
              label={label}
              labelledBy={titleId}
              options={options}
              value={value}
              onPick={setValue}
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <SheetError msg={err} />
            <SheetPrimaryButton onClick={save} disabled={busy || !value} busy={busy}>
              {busy ? '저장 중...' : !value ? '하나 골라 주세요' : '기록 완료'}
            </SheetPrimaryButton>
          </div>
        </SheetContent>
      </BottomSheet.Body>
    </BottomSheet>
  )
}
