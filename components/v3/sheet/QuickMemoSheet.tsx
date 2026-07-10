'use client'

/**
 * QuickMemoSheet — 일기(메모) 한 줄 빠른 기록.
 *
 * 무거운 /diary 페이지 이동 대신, 그 자리에서 한 줄 적고 저장. dog_diary 에
 * note 만 insert(사진 없음) → 기존 다이어리와 같은 테이블이라 타임라인에 그대로.
 * 사진까지 넣고 싶으면 /diary 풀 작성으로.
 *
 * **앱(PWA) 전용.** 호출자가 dogId + open/onClose 제어.
 */

import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import BottomSheet from '@/components/ui/BottomSheet'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { petName } from '@/lib/korean'

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
          {dogName ? `${petName(dogName)}의 ` : ''}오늘 한 줄
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: V3.inkMute }}>
          짧아도 좋아요 · 나중에 추억이 돼요
        </p>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label="오늘 일기 한 줄"
          placeholder="오늘 어떤 하루였나요?"
          rows={4}
          autoFocus
          style={{
            width: '100%',
            marginTop: 16,
            background: V3.paperHi,
            border: `1px solid ${V3.rule}`,
            borderRadius: 4,
            padding: 12,
            fontFamily: 'var(--font-sans)',
            fontSize: 13.5,
            color: V3.ink,
            resize: 'none',
            outline: 'none',
            lineHeight: 1.55,
          }}
        />

        <Link
          href={`/dogs/${dogId}/diary`}
          onClick={onClose}
          style={{
            display: 'inline-block',
            marginTop: 14,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.06em',
            color: V3.accentDeep,
            fontWeight: 600,
          }}
        >
          사진까지 함께 기록 →
        </Link>
      </BottomSheet.Body>

      <BottomSheet.Footer>
        {err && (
          <p role="alert" style={{ margin: '0 0 10px', fontSize: 12, color: V3.sale }}>
            {err}
          </p>
        )}
        <button
          onClick={save}
          disabled={busy || empty}
          className="flex items-center justify-center transition active:scale-[0.98]"
          style={{
            width: '100%',
            height: 52,
            borderRadius: 4,
            background: busy || empty ? V3.inkMute : V3.ink,
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
          {busy ? '저장 중...' : empty ? '한 줄 적어주세요' : '기록 완료'}
        </button>
      </BottomSheet.Footer>
    </BottomSheet>
  )
}
