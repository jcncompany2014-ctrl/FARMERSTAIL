'use client'

import { useRef, useState, useTransition } from 'react'
import { Upload, X, ImageIcon, Loader2, Star, Link as LinkIcon } from 'lucide-react'

type Props = {
  slug: string
  hero: string | null
  gallery: string[]
  onChange: (next: { hero: string | null; gallery: string[] }) => void
}

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; filename: string }
  | { status: 'error'; message: string }

/**
 * Admin product image management. Uploads to the Supabase `products` bucket
 * through `/api/admin/products/upload`, which gates on role === 'admin'.
 *
 * The form model keeps hero (= products.image_url) and gallery (=
 * products.gallery_urls text[]) separate — "set as main" promotes a gallery
 * image to hero and demotes the previous hero into the gallery head. This way
 * a single-image product still populates image_url, and OG cards stay intact.
 */
export default function ImageUploader({
  slug,
  hero,
  gallery,
  onChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const [, startTransition] = useTransition()
  const [manualUrl, setManualUrl] = useState('')

  async function uploadOne(file: File): Promise<string | null> {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('slug', slug || 'unknown')

    const res = await fetch('/api/admin/products/upload', {
      method: 'POST',
      body: fd,
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as {
        message?: string
      } | null
      setState({
        status: 'error',
        message: err?.message ?? '업로드에 실패했어요',
      })
      return null
    }
    const data = (await res.json()) as { url: string }
    return data.url
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const arr = Array.from(files)

    let nextHero = hero
    const nextGallery = [...gallery]

    for (const f of arr) {
      setState({ status: 'uploading', filename: f.name })
      const url = await uploadOne(f)
      if (!url) return
      if (!nextHero) {
        nextHero = url
      } else {
        nextGallery.push(url)
      }
    }

    startTransition(() => {
      onChange({ hero: nextHero, gallery: nextGallery })
      setState({ status: 'idle' })
    })
  }

  function removeImage(url: string) {
    if (url === hero) {
      // Promote first gallery item to hero; hero becomes null if gallery empty.
      const [promoted, ...rest] = gallery
      onChange({ hero: promoted ?? null, gallery: rest })
    } else {
      onChange({
        hero,
        gallery: gallery.filter((u) => u !== url),
      })
    }
    // Storage 고아 정리 — fire-and-forget. 우리 버킷이 아닌 외부 URL 은 서버에서
    // marker miss 로 skipped 처리되므로 안전. 폼 cancel 시에도 파일은 이미
    // 삭제되지만, admin UX 에서 cancel 은 드물고 manual URL 로 복구 가능하므로
    // Storage 비용 누적이 더 큰 위험.
    fetch('/api/admin/products/upload', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    }).catch(() => {})
  }

  function promoteToHero(url: string) {
    if (url === hero) return
    // Demote current hero to head of gallery; promote target.
    const nextGallery = gallery.filter((u) => u !== url)
    if (hero) nextGallery.unshift(hero)
    onChange({ hero: url, gallery: nextGallery })
  }

  function addManual() {
    const trimmed = manualUrl.trim()
    if (!trimmed) return
    if (!/^https?:\/\//i.test(trimmed)) {
      setState({ status: 'error', message: 'http(s) URL만 가능해요' })
      return
    }
    if (!hero) {
      onChange({ hero: trimmed, gallery })
    } else {
      onChange({ hero, gallery: [...gallery, trimmed] })
    }
    setManualUrl('')
    setState({ status: 'idle' })
  }

  const allImages: Array<{ url: string; isHero: boolean }> = [
    ...(hero ? [{ url: hero, isHero: true }] : []),
    ...gallery.map((url) => ({ url, isHero: false })),
  ]

  return (
    <div className="space-y-3">
      {/* Grid of current images */}
      {allImages.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {allImages.map(({ url, isHero }) => (
            <div
              key={url}
              className="relative group aspect-square rounded-lg bg-bg overflow-hidden border border-rule"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {isHero && (
                <div className="absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 bg-terracotta text-white text-[9px] font-black px-1.5 py-0.5 rounded">
                  <Star className="w-2.5 h-2.5 fill-white" strokeWidth={2.5} />
                  메인
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-end justify-between p-1.5 gap-1 opacity-0 group-hover:opacity-100">
                {!isHero && (
                  <button
                    type="button"
                    onClick={() => promoteToHero(url)}
                    className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-white/95 text-text px-1.5 py-0.5 rounded hover:bg-white transition"
                  >
                    <Star className="w-2.5 h-2.5" strokeWidth={2} />
                    메인으로
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  className="inline-flex items-center justify-center w-5 h-5 bg-sale text-white rounded hover:bg-[#8A2A1E] transition ml-auto"
                  aria-label="이미지 제거"
                >
                  <X className="w-3 h-3" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="aspect-square max-w-[180px] rounded-lg bg-bg border border-dashed border-rule-2 flex flex-col items-center justify-center text-muted">
          <ImageIcon className="w-8 h-8 mb-1.5" strokeWidth={1.2} />
          <p className="text-[10px]">이미지가 없어요</p>
        </div>
      )}

      {/* Upload / manual URL */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={state.status === 'uploading'}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-text text-white text-xs font-bold hover:bg-[#5C4130] transition disabled:opacity-50"
        >
          {state.status === 'uploading' ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} />
              업로드 중...
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5" strokeWidth={2.5} />
              파일 업로드
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {/* Manual URL fallback */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-bg">
          <LinkIcon className="w-3.5 h-3.5 text-muted shrink-0" strokeWidth={2} />
          <input
            type="url"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="이미지 URL 직접 입력"
            className="flex-1 bg-transparent text-xs text-ink placeholder:text-muted focus:outline-none font-mono"
          />
        </div>
        <button
          type="button"
          onClick={addManual}
          disabled={!manualUrl.trim()}
          className="px-3 rounded-lg bg-white border border-rule text-xs font-bold text-text hover:border-terracotta hover:text-terracotta transition disabled:opacity-40"
        >
          추가
        </button>
      </div>

      {state.status === 'error' && (
        <p className="text-[11px] text-sale font-bold">{state.message}</p>
      )}
      {state.status === 'uploading' && (
        <p className="text-[11px] text-muted">
          업로드 중: <span className="font-mono">{state.filename}</span>
        </p>
      )}
      <p className="text-[10px] text-muted leading-relaxed">
        첫 이미지가 메인(OG 카드·썸네일)으로 쓰여요. 여러 장은 상세 페이지의
        갤러리에 순서대로 노출돼요.
      </p>
    </div>
  )
}
