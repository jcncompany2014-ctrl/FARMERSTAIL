'use client'

/**
 * QuickPhotoSheet — 사진 빠른 추가.
 *
 * /diary 풀 작성 이동 대신, 그 자리에서 사진을 골라 바로 저장. DiaryClient 와
 * **동일한 업로드 파이프라인**: 1280px webp 리사이즈 → dog-diary-photos(private)
 * 버킷 업로드 → 1년 signed URL → dog_diary insert(note 없음). 다이어리 타임라인에
 * 그대로 보임. 메모까지 같이 쓰려면 "사진+메모"로 /diary.
 *
 * 2026-10-09 'A 포스터'(시안 T15): 머리줄(제목·안내 · '닫기') · 4칸 네모 사진(빼기 버튼은 사진
 * 안 오른쪽 위) + 점선 칸(+ · 'N / 4') · 먹색 꽉 찬 버튼 · 아래 밑줄 링크. 조각은 SheetParts.
 * 안내 문구는 실제 동작대로 — 예전 "고르면 바로 저장돼요"는 틀렸다(저장 버튼을 눌러야 저장).
 *
 * **앱(PWA) 전용.** 호출자가 dogId + open/onClose 제어.
 */

import { useRef, useState } from 'react'
import { X, Plus } from 'lucide-react'
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

interface QuickPhotoSheetProps {
  open: boolean
  onClose: () => void
  dogId: string
  dogName?: string
  onSaved?: () => void
}

const MAX = 4

/** DiaryClient 와 동일 — 1280px webp 0.85 리사이즈(모바일 5MB limit 회피). */
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const max = 1280
  const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * ratio)
  const h = Math.round(bitmap.height * ratio)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas ctx not available')
  ctx.drawImage(bitmap, 0, 0, w, h)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('blob failed'))),
      'image/webp',
      0.85,
    )
  })
}

export default function QuickPhotoSheet({
  open,
  onClose,
  dogId,
  dogName,
  onSaved,
}: QuickPhotoSheetProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const toast = useToast()

  function reset() {
    previews.forEach((u) => URL.revokeObjectURL(u))
    setFiles([])
    setPreviews([])
    setErr(null)
  }

  function handleClose() {
    if (busy) return
    reset()
    onClose()
  }

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!chosen.length) return
    const room = MAX - files.length
    const add = chosen.slice(0, room)
    setFiles((prev) => [...prev, ...add])
    setPreviews((prev) => [...prev, ...add.map((f) => URL.createObjectURL(f))])
  }

  function removeAt(i: number) {
    URL.revokeObjectURL(previews[i]!)
    setFiles((prev) => prev.filter((_, idx) => idx !== i))
    setPreviews((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function save() {
    if (busy || files.length === 0) return
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
      const today = new Date(Date.now() + 9 * 3600 * 1000)
        .toISOString()
        .slice(0, 10)
      const urls: string[] = []
      for (const file of files) {
        const blob = await resizeImage(file)
        const filename = `${user.id}/${dogId}/${today}-${crypto.randomUUID()}.webp`
        const { error: upErr } = await supabase.storage
          .from('dog-diary-photos')
          .upload(filename, blob, { contentType: 'image/webp', upsert: false })
        if (upErr) {
          // 무엇을 하면 되는지까지 (2026-08-07 문구 감사).
          setErr('사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요.')
          console.error('[quick-photo] 업로드 실패', upErr.message)
          return
        }
        const { data: signed } = await supabase.storage
          .from('dog-diary-photos')
          .createSignedUrl(filename, 60 * 60 * 24 * 365)
        if (signed?.signedUrl) urls.push(signed.signedUrl)
      }
      const { error } = await supabase.from('dog_diary').insert({
        dog_id: dogId,
        user_id: user.id,
        photo_urls: urls,
        note: null,
        mood: null,
      })
      if (error) {
        setErr('저장하지 못했어요')
        return
      }
      toast.success(`사진 ${urls.length}장을 올렸어요`)
      reset()
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
      onClose={handleClose}
      ariaLabel="사진 빠른 추가"
      dismissOnBackdrop={!busy}
    >
      <BottomSheet.Body>
        <SheetContent>
          <SheetHeader
            title={`${dogName ? `${petName(dogName)}의 ` : ''}오늘 한 컷`}
            sub={`최대 ${MAX}장 · 고른 뒤 저장을 눌러 주세요`}
            onClose={handleClose}
          />

          <div
            className="grid"
            style={{
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 8,
              marginTop: 18,
            }}
          >
            {previews.map((src, i) => (
              <div
                key={src}
                style={{
                  position: 'relative',
                  aspectRatio: '1 / 1',
                  borderRadius: V3Radius.sm,
                  // 회색 면은 사진이 그려지기 전 자리.
                  backgroundColor: V3.soft,
                  backgroundImage: `url(${src})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {/* 보이는 원은 26px(사진 안 오른쪽 위 4px — 시안), 누르는 자리는 34px. */}
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label="사진 빼기"
                  className="flex items-center justify-center ft-no-press"
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: 34,
                    height: 34,
                    padding: 0,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    aria-hidden
                    className="flex items-center justify-center"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: 'rgba(20,20,20,0.7)',
                    }}
                  >
                    <X size={14} color="#FFFFFF" strokeWidth={2.4} />
                  </span>
                </button>
              </div>
            ))}

            {files.length < MAX && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                aria-label="사진 고르기"
                className="flex flex-col items-center justify-center transition active:scale-95 ft-no-press"
                style={{
                  aspectRatio: '1 / 1',
                  gap: 4,
                  padding: 0,
                  borderRadius: V3Radius.sm,
                  background: '#FFFFFF',
                  border: `1.5px dashed ${V3.inkFaint}`,
                  color: V3.ink,
                  cursor: 'pointer',
                }}
              >
                <Plus size={24} color={V3.ink} strokeWidth={2.4} aria-hidden />
                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  {`${files.length} / ${MAX}`}
                </span>
              </button>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={pick}
            className="hidden"
          />

          <div style={{ marginTop: 20 }}>
            <SheetError msg={err} />
            <SheetPrimaryButton
              onClick={save}
              disabled={busy || files.length === 0}
              busy={busy}
            >
              {busy
                ? '저장 중...'
                : files.length === 0
                  ? '사진을 골라 주세요'
                  : `사진 ${files.length}장 저장`}
            </SheetPrimaryButton>
          </div>

          <SheetTextLink href={`/dogs/${dogId}/diary`} onClick={handleClose}>
            사진 + 메모 함께 기록 →
          </SheetTextLink>
        </SheetContent>
      </BottomSheet.Body>
    </BottomSheet>
  )
}
