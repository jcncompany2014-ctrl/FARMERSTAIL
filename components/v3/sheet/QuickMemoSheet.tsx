'use client'

/**
 * QuickMemoSheet — 일기(메모) 한 줄 빠른 기록.
 *
 * 무거운 /diary 페이지 이동 대신, 그 자리에서 한 줄 적고 저장. dog_diary 에
 * note 만 insert(사진 없음) → 기존 다이어리와 같은 테이블이라 타임라인에 그대로.
 * 사진까지 넣고 싶으면 /diary 풀 작성으로.
 *
 * 2026-10-09 'A 포스터'(시안 T14): 머리줄(제목·안내 · '닫기') · 먹선(1.5px) 네모 입력칸 ·
 * 먹색 꽉 찬 버튼 · 아래 밑줄 링크. 조각은 SheetParts.
 *
 * **앱(PWA) 전용.** 호출자가 dogId + open/onClose 제어.
 */

import { useState } from 'react'
import { V3, V3Radius } from '@/lib/design/tokens'
import BottomSheet from '@/components/ui/BottomSheet'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { petName } from '@/lib/korean'
import {
  SheetContent,
  SheetError,
  SheetHeader,
  SheetPrimaryButton,
  SheetTextLink,
} from '@/components/v3/sheet/SheetParts'

interface QuickMemoSheetProps {
  open: boolean
  onClose: () => void
  dogId: string
  dogName?: string
  onSaved?: () => void
}

export default function QuickMemoSheet({
  open,
  onClose,
  dogId,
  dogName,
  onSaved,
}: QuickMemoSheetProps) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const toast = useToast()

  const empty = note.trim().length === 0

  async function save() {
    if (busy || empty) return
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
      const { error } = await supabase.from('dog_diary').insert({
        dog_id: dogId,
        user_id: user.id,
        note: note.trim(),
        photo_urls: [],
      })
      if (error) {
        setErr('저장하지 못했어요')
        return
      }
      setNote('')
      toast.success('일기를 저장했어요')
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
      ariaLabel="일기 빠른 기록"
      dismissOnBackdrop={!busy}
    >
      <BottomSheet.Body>
        <SheetContent>
          <SheetHeader
            title={`${dogName ? `${petName(dogName)}의 ` : ''}오늘 한 줄`}
            sub="짧아도 좋아요 · 나중에 추억이 돼요"
            onClose={onClose}
          />

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="오늘 일기 한 줄"
            placeholder="오늘 어떤 하루였나요?"
            rows={3}
            autoFocus
            style={{
              display: 'block',
              width: '100%',
              minHeight: 132,
              marginTop: 18,
              padding: '14px 16px',
              fontSize: 18,
              lineHeight: 1.6,
              color: V3.ink,
              background: '#FFFFFF',
              border: `1.5px solid ${V3.ink}`,
              borderRadius: V3Radius.sm,
              resize: 'none',
              outline: 'none',
            }}
          />

          <div style={{ marginTop: 20 }}>
            <SheetError msg={err} />
            <SheetPrimaryButton onClick={save} disabled={busy || empty} busy={busy}>
              {busy ? '저장 중...' : empty ? '한 줄 적어 주세요' : '기록 완료'}
            </SheetPrimaryButton>
          </div>

          <SheetTextLink href={`/dogs/${dogId}/diary`} onClick={onClose}>
            사진까지 함께 기록 →
          </SheetTextLink>
        </SheetContent>
      </BottomSheet.Body>
    </BottomSheet>
  )
}
