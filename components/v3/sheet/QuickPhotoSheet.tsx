'use client'

/**
 * QuickPhotoSheet — 사진 빠른 추가.
 *
 * /diary 풀 작성 이동 대신, 그 자리에서 사진을 골라 바로 저장. DiaryClient 와
 * **동일한 업로드 파이프라인**: 1280px webp 리사이즈 → dog-diary-photos(private)
 * 버킷 업로드 → 1년 signed URL → dog_diary insert(note 없음). 다이어리 타임라인에
 * 그대로 보임. 메모까지 같이 쓰려면 "사진+메모"로 /diary.
 *
 * **앱(PWA) 전용.** 호출자가 dogId + open/onClose 제어.
 */

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Camera, X, Check, Plus } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import BottomSheet from '@/components/ui/BottomSheet'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { petName } from '@/lib/korean'

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
          setErr('사진 업로드에 실패했어요')
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
          {dogName ? `${petName(dogName)}의 ` : ''}오늘 한 컷
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: V3.inkMute }}>
          최대 {MAX}장 · 고르면 바로 저장돼요
        </p>

        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
            marginTop: 16,
          }}
        >
          {previews.map((src, i) => (
            <div
              key={src}
              style={{
                position: 'relative',
                aspectRatio: '1 / 1',
                borderRadius: 4,
                backgroundImage: `url(${src})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: `1px solid ${V3.rule}`,
              }}
            >
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="사진 빼기"
                className="flex items-center justify-center"
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: V3.ink,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <X size={13} color={V3.paper} strokeWidth={2.4} />
              </button>
            </div>
          ))}

          {files.length < MAX && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label="사진 고르기"
              className="flex flex-col items-center justify-center transition active:scale-95"
              style={{
                aspectRatio: '1 / 1',
                borderRadius: 4,
                background: V3.paperHi,
                border: `1.5px dashed ${V3.rule}`,
                cursor: 'pointer',
                gap: 4,
              }}
            >
              {previews.length === 0 ? (
                <Camera size={20} color={V3.inkMute} strokeWidth={1.8} />
              ) : (
                <Plus size={20} color={V3.inkMute} strokeWidth={1.8} />
              )}
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

        <Link
          href={`/dogs/${dogId}/diary`}
          onClick={handleClose}
          style={{
            display: 'inline-block',
            marginTop: 16,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.06em',
            color: V3.accentDeep,
            fontWeight: 600,
          }}
        >
          사진 + 메모 함께 기록 →
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
          disabled={busy || files.length === 0}
          className="flex items-center justify-center transition active:scale-[0.98]"
          style={{
            width: '100%',
            height: 52,
            borderRadius: 4,
            background: busy || files.length === 0 ? V3.inkMute : V3.ink,
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
          {busy
            ? '저장 중...'
            : files.length === 0
              ? '사진을 골라주세요'
              : `사진 ${files.length}장 저장`}
        </button>
      </BottomSheet.Footer>
    </BottomSheet>
  )
}
