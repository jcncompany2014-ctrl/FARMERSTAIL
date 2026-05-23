'use client'

/**
 * Cropper — v3 간단한 정사각형 이미지 크롭 primitive.
 *
 * **앱 컨텍스트 전용.** 강아지 프로필 / 리뷰 이미지 업로드 시 정사각 비율로
 * 자르기. 외부 라이브러리 없이 native canvas + pointer events 로 구현.
 *
 * # 동작
 *
 *  - 사용자가 사진을 업로드하면 정사각 viewport (기본 280×280) 안에 표시.
 *  - 드래그로 pan, pinch / wheel 로 zoom.
 *  - "사용" 버튼 클릭 시 cropped canvas blob (image/jpeg, 0.9) 을 onCrop 콜백
 *    으로 전달.
 *
 * # API
 *
 *   <Cropper
 *     src={URL.createObjectURL(file)}
 *     aspect={1}
 *     outputSize={512}
 *     onCrop={(blob) => upload(blob)}
 *     onCancel={() => setOpen(false)}
 *   />
 *
 * # 제약
 *
 *  - 정사각 비율 (1:1) 전용. 다른 비율은 aspect prop 으로 widthRatio / heightRatio
 *    분리 — 향후 확장.
 *  - 회전 없음. 회전 필요 시 별도 primitive.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from 'react'
import { V3, V3FontWeight, V3Radius } from '@/lib/design/tokens'

interface CropperProps {
  src: string
  /** viewport px. 기본 280. */
  viewportSize?: number
  /** 결과 이미지 px. 기본 512. 뷰포트보다 크게 — 업로드 후 다운스케일 자유. */
  outputSize?: number
  /** crop 결과 콜백. blob = image/jpeg, 0.9 quality. */
  onCrop: (blob: Blob) => void
  /** 취소 콜백. */
  onCancel?: () => void
  /** 사용 버튼 라벨. */
  confirmLabel?: string
  /** 취소 버튼 라벨. */
  cancelLabel?: string
}

export default function Cropper({
  src,
  viewportSize = 280,
  outputSize = 512,
  onCrop,
  onCancel,
  confirmLabel = '사용',
  cancelLabel = '취소',
}: CropperProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null,
  )
  const [loaded, setLoaded] = useState(false)
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 })
  const [processing, setProcessing] = useState(false)

  // 이미지 로드 시 viewport 에 fit 하도록 초기 scale.
  useEffect(() => {
    const el = imgRef.current
    if (!el) return
    function onLoad() {
      if (!el) return
      const naturalW = el.naturalWidth
      const naturalH = el.naturalHeight
      const fit = Math.max(viewportSize / naturalW, viewportSize / naturalH)
      setScale(fit)
      setTx(0)
      setTy(0)
      setImgSize({ w: naturalW, h: naturalH })
      setLoaded(true)
    }
    if (el.complete) onLoad()
    else el.addEventListener('load', onLoad)
    return () => el.removeEventListener('load', onLoad)
  }, [src, viewportSize])

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      startRef.current = { x: e.clientX, y: e.clientY, tx, ty }
      setDragging(true)
    },
    [tx, ty],
  )

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!dragging || !startRef.current) return
      const dx = e.clientX - startRef.current.x
      const dy = e.clientY - startRef.current.y
      setTx(startRef.current.tx + dx)
      setTy(startRef.current.ty + dy)
    },
    [dragging],
  )

  const handlePointerUp = useCallback(() => {
    setDragging(false)
    startRef.current = null
  }, [])

  const handleWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      e.preventDefault()
      const next = Math.max(0.2, Math.min(5, scale - e.deltaY * 0.002))
      setScale(next)
    },
    [scale],
  )

  async function handleConfirm() {
    if (!loaded || processing) return
    setProcessing(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = outputSize
      canvas.height = outputSize
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas-2d-unavailable')

      const img = imgRef.current
      if (!img) throw new Error('img-unavailable')

      // viewport 좌표계: 이미지 중심 = (viewport/2 + tx, viewport/2 + ty)
      // 이미지 크기 = naturalW * scale.
      // viewport (0,0)-(viewport,viewport) 가 결과 canvas (0,0)-(output,output) 에
      // 매핑되어야 함. 즉 sx (이미지 픽셀 기준 viewport 좌상단) 계산:
      const halfV = viewportSize / 2
      const renderedW = imgSize.w * scale
      const renderedH = imgSize.h * scale
      // 이미지 좌상단 px (viewport 좌표계)
      const imgLeft = halfV + tx - renderedW / 2
      const imgTop = halfV + ty - renderedH / 2
      // viewport 좌상단을 이미지 px 로 환산
      const sx = (-imgLeft / renderedW) * imgSize.w
      const sy = (-imgTop / renderedH) * imgSize.h
      const sSize = (viewportSize / renderedW) * imgSize.w

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, outputSize, outputSize)
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, outputSize, outputSize)

      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob((b) => res(b), 'image/jpeg', 0.9),
      )
      if (blob) onCrop(blob)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex flex-col items-center" style={{ gap: 12 }}>
      <div
        className="relative overflow-hidden touch-none"
        style={{
          width: viewportSize,
          height: viewportSize,
          background: V3.paperDeep,
          border: `1px solid ${V3.rule}`,
          borderRadius: V3Radius.sm,
          cursor: dragging ? 'grabbing' : 'grab',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${scale})`,
            transformOrigin: 'center',
            userSelect: 'none',
            pointerEvents: 'none',
            maxWidth: 'none',
            maxHeight: 'none',
          }}
        />
        {/* grid overlay */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(${V3.paperHi}33 1px, transparent 1px), linear-gradient(90deg, ${V3.paperHi}33 1px, transparent 1px)`,
            backgroundSize: `${viewportSize / 3}px ${viewportSize / 3}px`,
          }}
        />
      </div>
      <div className="w-full flex items-center gap-3" style={{ width: viewportSize }}>
        <span
          aria-hidden
          style={{ fontSize: 11, color: V3.inkMute, minWidth: 24 }}
        >
          축소
        </span>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.05}
          value={scale}
          onChange={(e) => setScale(Number(e.target.value))}
          aria-label="확대 / 축소"
          className="flex-1"
        />
        <span
          aria-hidden
          style={{ fontSize: 11, color: V3.inkMute, minWidth: 24, textAlign: 'right' }}
        >
          확대
        </span>
      </div>
      <div className="flex items-center gap-2 w-full" style={{ maxWidth: viewportSize }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 transition active:scale-[0.99]"
            style={{
              padding: '10px 14px',
              borderRadius: V3Radius.sm,
              background: V3.paperHi,
              border: `1px solid ${V3.rule}`,
              color: V3.ink,
              fontFamily: 'var(--font-sans)',
              fontWeight: V3FontWeight.semibold,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!loaded || processing}
          className="flex-1 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            padding: '10px 14px',
            borderRadius: V3Radius.sm,
            background: V3.ink,
            border: 'none',
            color: V3.paperHi,
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.bold,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {processing ? '처리 중…' : confirmLabel}
        </button>
      </div>
    </div>
  )
}
