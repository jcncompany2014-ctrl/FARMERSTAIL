'use client'

// B-66 / P20 — 시계열 진행 사진 갤러리 + 업로드 (client interactive).
//
// 업로드 흐름:
//   1) input[type=file] 또는 카메라로 사진 선택 → preview
//   2) photoId UUID 생성 → makeProgressPhotoPath
//   3) supabase.storage.upload (client-side, RLS 가 self folder 만 허용)
//   4) POST /api/dogs/[id]/progress-photos { photoUrl: path, takenAt, view, note }
//   5) GET /api/dogs/[id]/progress-photos 재호출로 갤러리 refresh
//
// 권장 사용:
//   - 측면/정면/위 3 view 를 28일 cycle 마다 1장씩 추적 → 체형 변화 가시화.
//   - "보호자 자율" — 강제 X. 입력 부담 ↓.
import { useState } from 'react'
import Image from 'next/image'
import { Camera, ImageIcon, Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  PROGRESS_PHOTOS_BUCKET,
  makeProgressPhotoPath,
} from '@/lib/storage/progress-photos'
import type { ProgressPhotoRow } from './page'

type View = 'side' | 'front' | 'top'

const VIEW_LABEL: Record<View, string> = {
  side: '측면',
  front: '정면',
  top: '위에서',
}

function generatePhotoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // 환경상 fallback — RFC 4122 v4 가 아니어도 unique 만 보장하면 OK.
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export default function PhotosClient({
  dogId,
  dogName,
  userId,
  initialPhotos,
}: {
  dogId: string
  dogName: string | null
  userId: string
  initialPhotos: ProgressPhotoRow[]
}) {
  const supabase = createClient()
  const [photos, setPhotos] = useState<ProgressPhotoRow[]>(initialPhotos)
  const [view, setView] = useState<View>('side')
  const [takenAt, setTakenAt] = useState(() => {
    // KST today YYYY-MM-DD. UTC offset 보정.
    const now = new Date()
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    return kst.toISOString().slice(0, 10)
  })
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justUploaded, setJustUploaded] = useState(false)

  async function refresh() {
    const res = await fetch(`/api/dogs/${dogId}/progress-photos`, {
      cache: 'no-store',
    })
    if (!res.ok) return
    const json = (await res.json()) as {
      ok: boolean
      photos?: ProgressPhotoRow[]
    }
    if (json.ok && json.photos) setPhotos(json.photos)
  }

  async function handleFile(file: File) {
    setError(null)
    setJustUploaded(false)

    // mime 가드 — RLS 정책 + bucket allowed_mime_types 와 동일.
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('JPEG, PNG, WebP 만 업로드 가능해요')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('5MB 이하 파일만 업로드 가능해요')
      return
    }

    setUploading(true)
    try {
      const photoId = generatePhotoId()
      const path = makeProgressPhotoPath(userId, dogId, photoId, file.type)

      // 1) Storage 업로드 — client SDK 가 자체적으로 user JWT 동봉,
      //    RLS 가 self folder 만 허용 (마이그레이션 20260516000001).
      const { error: upErr } = await supabase.storage
        .from(PROGRESS_PHOTOS_BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })
      if (upErr) {
        setError('사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요')
        return
      }

      // 2) 메타 등록.
      const res = await fetch(`/api/dogs/${dogId}/progress-photos`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          photoUrl: path,
          takenAt,
          view,
          note: note.trim() || null,
        }),
      })
      if (!res.ok) {
        setError('사진 정보를 저장하지 못했어요')
        return
      }

      // 3) 폼 리셋 + 갤러리 새로고침.
      setNote('')
      setJustUploaded(true)
      await refresh()
      setTimeout(() => setJustUploaded(false), 2500)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="px-5 py-6 pb-32">
      <div className="max-w-md mx-auto">
        <h1
          className="font-sans"
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          진행 사진
        </h1>
        <p className="mt-1 text-[12px] text-muted leading-relaxed">
          {dogName ?? '강아지'}의 시계열 사진을 자율로 기록해요. 같은
          각도로 찍으면 변화가 더 잘 보여요.
        </p>

        {/* 업로드 영역 */}
        <section
          className="mt-5 rounded border bg-bg-3 p-4"
          style={{ borderColor: 'var(--rule)' }}
        >
          {/* view picker */}
          <div className="flex gap-1.5 mb-3" role="group" aria-label="촬영 각도">
            {(['side', 'front', 'top'] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`flex-1 py-1.5 rounded-full text-[12px] font-bold transition ${
                  view === v
                    ? 'bg-ink text-white'
                    : 'bg-bg text-muted border'
                }`}
                style={
                  view !== v ? { borderColor: 'var(--rule)' } : undefined
                }
              >
                {VIEW_LABEL[v]}
              </button>
            ))}
          </div>

          {/* 날짜 + 메모 */}
          <label className="block text-[10.5px] font-bold text-muted mb-1">
            촬영일
          </label>
          <input
            type="date"
            value={takenAt}
            onChange={(e) => setTakenAt(e.target.value)}
            className="w-full rounded border px-3 py-2 text-[13.5px]"
            style={{ borderColor: 'var(--rule)' }}
          />
          <label className="block text-[10.5px] font-bold text-muted mt-3 mb-1">
            메모 (선택)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: 산책 후 / 체중 6.2kg / 털 자른 후"
            maxLength={500}
            className="w-full rounded border px-3 py-2 text-[13.5px]"
            style={{ borderColor: 'var(--rule)' }}
          />

          {/* 업로드 버튼 (input file 트리거) */}
          <label
            className={`mt-4 flex items-center justify-center gap-2 w-full rounded py-3 text-[13.5px] font-bold cursor-pointer transition ${
              uploading
                ? 'bg-bg text-muted'
                : 'bg-terracotta text-white active:scale-[0.99]'
            }`}
            style={
              !uploading ? { background: 'var(--terracotta)' } : undefined
            }
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                업로드 중…
              </>
            ) : justUploaded ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                저장됨
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                사진 선택
              </>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  void handleFile(file)
                }
                e.target.value = ''
              }}
            />
          </label>

          {error && (
            <p
              className="mt-2 text-[12px]"
              style={{ color: 'var(--sale, #c4623e)' }}
            >
              {error}
            </p>
          )}
        </section>

        {/* 갤러리 */}
        <section className="mt-6">
          {photos.length === 0 ? (
            <div
              className="rounded border bg-bg-3 px-4 py-10 text-center"
              style={{ borderColor: 'var(--rule)' }}
            >
              <ImageIcon
                className="w-7 h-7 mx-auto"
                strokeWidth={1.6}
                style={{ color: 'var(--muted)' }}
                aria-hidden
              />
              <p className="mt-2 text-[13.5px] text-muted">
                아직 사진이 없어요. 첫 사진을 올려보세요.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-3 gap-1.5">
              {photos.map((p) => (
                <li
                  key={p.id}
                  className="aspect-square overflow-hidden rounded-lg bg-bg border"
                  style={{ borderColor: 'var(--rule)' }}
                >
                  {p.signed_url ? (
                    <Image
                      src={p.signed_url}
                      alt={`${VIEW_LABEL[p.view ?? 'side']} ${p.taken_at ?? ''}`}
                      width={200}
                      height={200}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted">
                      <ImageIcon className="w-5 h-5" strokeWidth={1.6} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {photos.length > 0 && (
            <p
              className="mt-2 text-[10.5px] tabular-nums"
              style={{ color: 'var(--muted)' }}
            >
              총 {photos.length}장
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
