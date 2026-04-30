'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useModalA11y } from '@/lib/ui/useModalA11y'

/**
 * ProductImageLightbox — PDP 이미지 클릭 시 풀스크린 zoom modal.
 *
 * - 이미지 click → fullscreen overlay 열림
 * - 좌/우 화살표 또는 keyboard ←/→ 로 이동
 * - ESC / 배경 click / X 버튼 닫기
 * - body scroll lock
 *
 * 트리거 패턴:
 *   const [open, setOpen] = useState<number | null>(null)
 *   <button onClick={() => setOpen(0)}>
 *   <ProductImageLightbox images={...} startIndex={open} onClose={() => setOpen(null)} />
 */

export default function ProductImageLightbox({
  images,
  startIndex,
  onClose,
  productName,
}: {
  images: string[]
  startIndex: number | null
  onClose: () => void
  productName: string
}) {
  const open = startIndex !== null
  const [idx, setIdx] = useState(startIndex ?? 0)
  const dialogRef = useRef<HTMLDivElement>(null)

  // startIndex prop 변경 시 idx 초기화 (open 시점에 정확한 위치로).
  useEffect(() => {
    if (startIndex !== null) setIdx(startIndex)
  }, [startIndex])

  // useModalA11y 가 Esc + body scroll lock + focus trap + restore 처리.
  useModalA11y({ open, onClose, containerRef: dialogRef })

  // 좌/우 화살표 keyboard navigation 은 lightbox-고유 동작이라 별도 effect.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function prev() {
    setIdx((i) => (i - 1 + images.length) % images.length)
  }
  function next() {
    setIdx((i) => (i + 1) % images.length)
  }

  if (!open) return null
  const current = images[idx]
  if (!current) return null

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="제품 이미지 확대"
      tabIndex={-1}
      className="fixed inset-0 z-[60] flex items-center justify-center outline-none"
      style={{ background: 'rgba(15,12,10,0.95)' }}
      onClick={onClose}
    >
      {/* close */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="닫기"
        className="absolute top-4 right-4 md:top-6 md:right-6 z-10 w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center transition active:scale-90"
        style={{
          background: 'rgba(245,240,230,0.12)',
          color: 'var(--bg)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <X className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2} />
      </button>

      {/* prev / next */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              prev()
            }}
            aria-label="이전 이미지"
            className="hidden md:flex absolute left-6 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full items-center justify-center transition active:scale-90"
            style={{
              background: 'rgba(245,240,230,0.12)',
              color: 'var(--bg)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <ChevronLeft className="w-6 h-6" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              next()
            }}
            aria-label="다음 이미지"
            className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full items-center justify-center transition active:scale-90"
            style={{
              background: 'rgba(245,240,230,0.12)',
              color: 'var(--bg)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <ChevronRight className="w-6 h-6" strokeWidth={2} />
          </button>
        </>
      )}

      {/* main image */}
      <div
        className="relative w-full h-full md:max-w-[80vw] md:max-h-[85vh] flex items-center justify-center px-5 md:px-12"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          key={current}
          src={current}
          alt={`${productName} 이미지 ${idx + 1}`}
          width={1600}
          height={1600}
          sizes="(max-width: 768px) 100vw, 80vw"
          className="object-contain max-w-full max-h-full w-auto h-auto rounded-md"
          unoptimized
        />
      </div>

      {/* mobile bottom nav */}
      {images.length > 1 && (
        <div
          className="md:hidden absolute bottom-6 left-0 right-0 flex items-center justify-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={prev}
            aria-label="이전 이미지"
            className="w-11 h-11 rounded-full flex items-center justify-center transition active:scale-90"
            style={{
              background: 'rgba(245,240,230,0.12)',
              color: 'var(--bg)',
            }}
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={2} />
          </button>
          <span
            className="font-mono text-[12px] px-3 py-1 rounded-full tabular-nums"
            style={{
              background: 'rgba(245,240,230,0.12)',
              color: 'var(--bg)',
            }}
          >
            {idx + 1} / {images.length}
          </span>
          <button
            type="button"
            onClick={next}
            aria-label="다음 이미지"
            className="w-11 h-11 rounded-full flex items-center justify-center transition active:scale-90"
            style={{
              background: 'rgba(245,240,230,0.12)',
              color: 'var(--bg)',
            }}
          >
            <ChevronRight className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  )
}
