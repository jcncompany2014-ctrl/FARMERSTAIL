'use client'

import { useRef, useState } from 'react'
import {
  Dog as DogIcon,
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Heart,
} from 'lucide-react'

type Initial =
  | {
      ok: true
      dogName: string | null
      ownerName: string | null
      expiresAt: string
    }
  | { ok: false; error: string; message: string }

const ACCEPT = 'image/jpeg,image/png,image/webp'
const MAX_BYTES = 3 * 1024 * 1024

/**
 * 친구가 사진 부탁 받아 업로드하는 익명 페이지의 client part.
 * 톤: 따뜻하게, 짧게. "○○이를 위한 사진을 보내주실래요?"
 */
export default function PhotoUploadClient({
  token,
  initial,
}: {
  token: string
  initial: Initial
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'uploading' }
    | { kind: 'success' }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' })

  if (!initial.ok) {
    return (
      <main className="min-h-[80vh] flex items-center justify-center px-5 py-10" style={{ background: 'var(--bg)' }}>
        <div className="max-w-sm w-full text-center rounded-2xl border bg-white px-6 py-7" style={{ borderColor: 'var(--rule)' }}>
          <AlertCircle className="w-9 h-9 mx-auto text-sale" strokeWidth={1.8} />
          <h1
            className="font-serif mt-3"
            style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}
          >
            링크 사용 불가
          </h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-text/70">
            {initial.message}
          </p>
        </div>
      </main>
    )
  }

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (file.size > MAX_BYTES) {
      setStatus({ kind: 'error', message: '3MB 이하 이미지만 올릴 수 있어요' })
      return
    }
    if (!ACCEPT.split(',').includes(file.type)) {
      setStatus({ kind: 'error', message: 'JPG/PNG/WebP 만 지원해요' })
      return
    }

    setStatus({ kind: 'uploading' })

    try {
      const dataUrl = await fileToDataUrl(file)
      const res = await fetch(
        `/api/photo-upload/${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ imageDataUrl: dataUrl }),
        },
      )
      const data = (await res.json()) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) {
        setStatus({ kind: 'error', message: data.message ?? '업로드 실패' })
        return
      }
      setStatus({ kind: 'success' })
    } catch {
      setStatus({ kind: 'error', message: '네트워크 오류' })
    }
  }

  const dogName = initial.dogName ?? '강아지'
  const ownerName = initial.ownerName ?? '보호자'

  return (
    <main className="min-h-[80vh] flex items-center justify-center px-5 py-10" style={{ background: 'var(--bg)' }}>
      <div className="max-w-sm w-full rounded-2xl border bg-white px-6 py-7 shadow-sm" style={{ borderColor: 'var(--rule)' }}>
        <div className="flex justify-center mb-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: 'color-mix(in srgb, var(--terracotta) 10%, white)',
              color: 'var(--terracotta)',
            }}
            aria-hidden
          >
            <DogIcon className="w-7 h-7" strokeWidth={1.8} />
          </div>
        </div>

        {status.kind === 'success' ? (
          <div className="text-center">
            <CheckCircle2 className="w-8 h-8 mx-auto" style={{ color: 'var(--moss)' }} />
            <h1
              className="font-serif mt-3"
              style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}
            >
              사진을 보냈어요
            </h1>
            <p className="mt-2 text-[12.5px] leading-relaxed text-text/70">
              {ownerName}님께 전달됐어요. 고마워요!
            </p>
          </div>
        ) : (
          <>
            <span className="kicker block text-center" style={{ color: 'var(--terracotta)' }}>
              Photo Request · 사진 요청
            </span>
            <h1
              className="font-serif text-center mt-1.5 leading-tight"
              style={{
                fontSize: 19,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              {dogName}의 사진 한 장 부탁드려요
            </h1>
            <p className="text-center mt-2 text-[12.5px] leading-relaxed text-text/80">
              <strong>{ownerName}</strong>님이 {dogName}의 측면 사진을 부탁
              하셨어요. 강아지 전체가 잘 보이게 한 장 찍어주세요.
            </p>

            <ul className="mt-5 space-y-2 text-[12px] leading-relaxed text-text/85">
              <li className="flex items-start gap-2">
                <Heart
                  className="w-3.5 h-3.5 shrink-0 mt-0.5"
                  strokeWidth={2}
                  style={{ color: 'var(--terracotta)' }}
                />
                <span>측면 (옆 모습) 이 가장 좋아요</span>
              </li>
              <li className="flex items-start gap-2">
                <Heart
                  className="w-3.5 h-3.5 shrink-0 mt-0.5"
                  strokeWidth={2}
                  style={{ color: 'var(--terracotta)' }}
                />
                <span>밝은 곳, 정수리부터 발끝까지 다 보이게</span>
              </li>
            </ul>

            <div className="mt-6 flex flex-col gap-2">
              {status.kind === 'uploading' ? (
                <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-bg/40 text-[12px] font-bold text-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  업로드 중...
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-[13px] font-bold text-white transition active:scale-[0.99]"
                  style={{ background: 'var(--terracotta)' }}
                >
                  <Camera className="w-4 h-4" strokeWidth={2.2} />
                  사진 선택
                </button>
              )}
              {status.kind === 'error' && (
                <p className="text-center text-[11.5px] text-sale font-semibold">
                  {status.message}
                </p>
              )}
              <p className="text-center text-[10.5px] text-muted mt-1">
                {fmtExpire(initial.expiresAt)} 까지 유효해요
              </p>
            </div>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handlePick}
          className="hidden"
        />
      </div>
    </main>
  )
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read failed'))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  })
}

function fmtExpire(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
