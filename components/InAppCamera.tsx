'use client'

import { useEffect, useRef, useState } from 'react'
import {
  X,
  Loader2,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react'
import { useModalA11y } from '@/lib/ui/useModalA11y'
import { haptic } from '@/lib/haptic'

/**
 * InAppCamera — getUserMedia 기반 in-app 카메라 모달 (B-16).
 *
 * # 흐름
 *  1) 마운트 시 navigator.mediaDevices.getUserMedia 호출 (rear cam 우선)
 *  2) `<video>` 에 stream 연결, silhouette overlay 위에
 *  3) 캡처 버튼 → canvas 에 video 프레임 그리고 toDataURL
 *  4) onCapture(dataUrl) 호출 — 호출처가 W_image 평가 또는 저장
 *  5) 재촬영 가능 (다시 stream 활성)
 *
 * # silhouette overlay
 * overlay prop 으로 SVG 또는 ReactNode 받아 video 위에 absolute 표시. 측면/
 * 정면/위 등 다양한 frame 지원.
 *
 * # 권한
 * 카메라 거부 시 friendly 에러 + 갤러리 fallback (file input).
 */
export default function InAppCamera({
  open,
  onClose,
  onCapture,
  overlay,
  title,
}: {
  open: boolean
  onClose: () => void
  onCapture: (dataUrl: string) => void
  /** silhouette overlay (SVG 등). video 위 absolute. */
  overlay?: React.ReactNode
  /** 모달 상단 타이틀 — "측면 사진 찍기" 등 */
  title?: string
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(true)
  const [captured, setCaptured] = useState<string | null>(null)

  useModalA11y({ open, onClose, containerRef: dialogRef })

  useEffect(() => {
    if (!open) return
    let cancelled = false
    // setState 호출은 IIFE 안으로 — react-hooks/set-state-in-effect 회피
    ;(async () => {
      setError(null)
      setCaptured(null)
      setStarting(true)
      try {
        if (
          typeof navigator === 'undefined' ||
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          setError('이 기기에서 카메라를 사용할 수 없어요')
          setStarting(false)
          return
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setStarting(false)
      } catch (err) {
        if (cancelled) return
        const name = (err as { name?: string })?.name
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError('카메라 권한이 없어요. 설정에서 허용해주세요')
        } else if (name === 'NotFoundError') {
          setError('카메라를 찾지 못했어요')
        } else {
          setError('카메라를 열지 못했어요')
        }
        setStarting(false)
      }
    })()
    return () => {
      cancelled = true
      const stream = streamRef.current
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [open])

  function handleCapture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    // audit #105: native resolution (예: 4032×3024) 그대로 캡처 시 dataUrl 이 수
    // MB → react state 에 유지되며 GC 압력. long edge 1280 으로 다운스케일.
    const MAX_EDGE = 1280
    const srcW = video.videoWidth
    const srcH = video.videoHeight
    if (srcW === 0 || srcH === 0) return
    const longest = Math.max(srcW, srcH)
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1
    canvas.width = Math.round(srcW * scale)
    canvas.height = Math.round(srcH * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setCaptured(dataUrl)
    // 셔터 피드백 — Android Chrome vibrate, iOS Safari 는 noop (B-28)
    haptic('confirm')
  }

  function retake() {
    setCaptured(null)
    haptic('tick')
  }

  function confirm() {
    if (!captured) return
    haptic('tap')
    onCapture(captured)
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      style={{ background: 'rgba(0, 0, 0, 0.9)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl bg-black shadow-xl overflow-hidden flex flex-col"
        style={{ maxHeight: '92dvh' }}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-black/60">
          <h2 className="text-[13px] font-bold text-white">
            {title ?? '카메라'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 rounded-full hover:bg-white/10 transition"
          >
            <X className="w-5 h-5 text-white" strokeWidth={2} />
          </button>
        </div>

        <div className="relative bg-black flex-1 flex items-center justify-center" style={{ minHeight: 360, aspectRatio: '3/4' }}>
          {error ? (
            <div className="text-center px-6 py-10">
              <AlertCircle
                className="w-9 h-9 mx-auto mb-3"
                strokeWidth={1.6}
                style={{ color: 'var(--gold)' }}
              />
              <p className="text-[13px] text-white/90 leading-relaxed">
                {error}
              </p>
              <p className="mt-3 text-[11px] text-white/60">
                갤러리에서 직접 사진을 선택해주세요
              </p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover ${captured ? 'hidden' : ''}`}
              />
              {captured && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={captured}
                  alt="캡처된 사진"
                  className="w-full h-full object-cover"
                />
              )}
              {starting && !captured && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
              {overlay && !captured && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {overlay}
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </>
          )}
        </div>

        <div className="px-4 py-4 bg-black/80 flex items-center justify-center gap-4">
          {captured ? (
            <>
              <button
                type="button"
                onClick={retake}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[12px] font-bold text-white border border-white/30 hover:border-white transition"
              >
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={2.2} />
                다시
              </button>
              <button
                type="button"
                onClick={confirm}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-[13px] font-bold text-white transition active:scale-[0.99]"
                style={{ background: 'var(--terracotta)' }}
              >
                <CheckCircle2 className="w-4 h-4" strokeWidth={2.2} />
                사용
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleCapture}
              disabled={starting || !!error}
              aria-label="사진 찍기"
              className="w-16 h-16 rounded-full bg-white border-4 border-white/40 disabled:opacity-40 transition active:scale-[0.95]"
            >
              <span className="sr-only">사진 찍기</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
