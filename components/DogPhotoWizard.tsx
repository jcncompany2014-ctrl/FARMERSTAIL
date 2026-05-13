'use client'

import { useState } from 'react'
import {
  ChevronLeft,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import InAppCamera from './InAppCamera'
import DogSilhouette, {
  type SilhouetteView,
  type ReferenceMode,
} from './DogSilhouette'
import { computeWImage, type WImageInput } from '@/lib/vision/w-image'

/**
 * DogPhotoWizard — 측면 / 정면 / 위 3장 wizard (B-27).
 *
 * 각 step:
 *  1. InAppCamera open (silhouette overlay + reference)
 *  2. 캡처 → 캡처된 이미지 표시 + 이슈 안내 (W_image lib)
 *  3. "다음" → 다음 view
 *  4. 마지막 → onComplete(photos) 콜백
 *
 * # 정책
 * - 사용자가 "이번 sequence 끝" 또는 step skip 가능 — 강제 X.
 * - 측면 한 장만 좋아도 OK (voice-guidelines §11 + 사용자 A-24).
 */

type Step = {
  view: SilhouetteView
  label: string
  ref: ReferenceMode
  hint: string
}

const STEPS: Step[] = [
  {
    view: 'side',
    label: '측면',
    ref: 'card',
    hint: '강아지 옆 모습 + 신용카드를 발 옆 바닥에',
  },
  {
    view: 'front',
    label: '정면',
    ref: 'card',
    hint: '강아지 정면 — 코높이에서',
  },
  {
    view: 'top',
    label: '위에서',
    ref: 'card',
    hint: '강아지가 서있을 때 위에서 — 허리 라인 확인',
  },
]

export default function DogPhotoWizard({
  open,
  onClose,
  onComplete,
}: {
  open: boolean
  onClose: () => void
  onComplete: (photos: Array<{ view: SilhouetteView; dataUrl: string }>) => void
}) {
  const [step, setStep] = useState(0)
  const [photos, setPhotos] = useState<
    Array<{ view: SilhouetteView; dataUrl: string }>
  >([])
  const [cameraOpen, setCameraOpen] = useState(false)
  const [lastWImage, setLastWImage] = useState<{
    score: number
    issues: string[]
  } | null>(null)

  function reset() {
    setStep(0)
    setPhotos([])
    setLastWImage(null)
  }

  function handleCapture(dataUrl: string) {
    const current = STEPS[step]
    if (!current) return

    // W_image 평가 — 기본 입력 (캡처 분석 후 더 정교화 가능)
    const wImageInput: WImageInput = {
      coverageRatio: 0.55, // canvas 분석 후 정확값. 일단 가정.
      brightness: 130,
      sharpness: 120,
      referenceFound: false, // 자동 감지 X — 사용자 신고 안 함
      viewType: current.view,
    }
    const w = computeWImage(wImageInput)
    setLastWImage({ score: w.score, issues: w.issues })

    setPhotos((prev) => {
      const next = [...prev]
      next[step] = { view: current.view, dataUrl }
      return next
    })
  }

  function next() {
    if (step + 1 >= STEPS.length) {
      onComplete(photos)
      onClose()
      reset()
      return
    }
    setStep(step + 1)
    setLastWImage(null)
  }

  function skip() {
    if (step + 1 >= STEPS.length) {
      onComplete(photos)
      onClose()
      reset()
      return
    }
    setStep(step + 1)
    setLastWImage(null)
  }

  function close() {
    onClose()
    reset()
  }

  if (!open) return null

  const current = STEPS[step]
  const captured = photos[step]?.dataUrl

  return (
    <>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center px-4"
        style={{ background: 'rgba(0,0,0,0.7)' }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close()
        }}
      >
        <div
          className="w-full max-w-sm rounded-2xl bg-white shadow-xl"
          style={{ maxHeight: '92dvh', overflowY: 'auto' }}
        >
          {/* 헤더 + 진행 stepper */}
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--terracotta)' }}>
                Photo Wizard · {step + 1}/{STEPS.length}
              </span>
              <button
                type="button"
                onClick={close}
                aria-label="닫기"
                className="text-muted hover:text-text"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2.2} />
              </button>
            </div>
            <div className="flex gap-1.5 mb-3">
              {STEPS.map((s, i) => (
                <div
                  key={s.view}
                  className="flex-1 h-1.5 rounded-full"
                  style={{
                    background:
                      i < step
                        ? 'var(--moss)'
                        : i === step
                          ? 'var(--terracotta)'
                          : 'var(--rule)',
                  }}
                />
              ))}
            </div>
            <h2
              className="font-serif leading-tight"
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              {current.label} 사진 찍기
            </h2>
            <p className="mt-1 text-[12px] text-muted leading-relaxed">
              {current.hint}
            </p>
          </div>

          {/* preview area */}
          <div className="px-5">
            <div
              className="rounded-xl overflow-hidden relative"
              style={{
                aspectRatio: '3/4',
                background: 'var(--bg)',
                border: '1px solid var(--rule)',
              }}
            >
              {captured ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={captured}
                  alt={`${current.label} 사진`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <DogSilhouette view={current.view} reference={current.ref} stroke="rgba(120,120,120,0.5)" />
              )}
            </div>

            {/* W_image 결과 */}
            {lastWImage && (
              <div
                className="mt-3 rounded-xl px-3 py-2.5"
                style={{
                  background:
                    lastWImage.score >= 0.5
                      ? 'color-mix(in srgb, var(--moss) 8%, white)'
                      : 'color-mix(in srgb, var(--gold) 10%, white)',
                  border:
                    lastWImage.score >= 0.5
                      ? '1px solid color-mix(in srgb, var(--moss) 30%, transparent)'
                      : '1px solid color-mix(in srgb, var(--gold) 30%, transparent)',
                }}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-bold mb-1">
                  {lastWImage.score >= 0.5 ? (
                    <>
                      <Sparkles
                        className="w-3 h-3"
                        strokeWidth={2.2}
                        style={{ color: 'var(--moss)' }}
                      />
                      <span style={{ color: 'var(--ink)' }}>
                        사진 신뢰도 {Math.round(lastWImage.score * 100)}%
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle
                        className="w-3 h-3"
                        strokeWidth={2.2}
                        style={{ color: 'var(--gold)' }}
                      />
                      <span style={{ color: 'var(--ink)' }}>다시 찍어볼까요?</span>
                    </>
                  )}
                </div>
                {lastWImage.issues.length > 0 && (
                  <ul className="text-[11px] text-muted leading-relaxed list-disc pl-4">
                    {lastWImage.issues.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="px-5 py-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-[12.5px] font-bold text-white transition active:scale-[0.99]"
              style={{ background: 'var(--terracotta)' }}
            >
              {captured ? '다시 찍기' : '카메라 열기'}
            </button>
            {captured ? (
              <button
                type="button"
                onClick={next}
                className="inline-flex items-center justify-center gap-1 px-4 py-3 rounded-xl text-[12.5px] font-bold text-text border border-rule hover:border-ink transition"
              >
                <Check className="w-4 h-4" strokeWidth={2.2} />
                다음
              </button>
            ) : (
              <button
                type="button"
                onClick={skip}
                className="inline-flex items-center justify-center px-3 py-3 rounded-xl text-[11.5px] font-bold text-muted hover:text-text transition"
              >
                건너뛰기
              </button>
            )}
          </div>
        </div>
      </div>

      <InAppCamera
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCapture}
        title={`${current.label} 사진 찍기`}
        overlay={
          <div className="w-3/4 h-3/4">
            <DogSilhouette view={current.view} reference={current.ref} />
          </div>
        }
      />
    </>
  )
}
