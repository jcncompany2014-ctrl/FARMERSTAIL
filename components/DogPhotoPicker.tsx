'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, X, Lightbulb, HelpCircle } from 'lucide-react'
import DogPawMark from '@/components/DogPawMark'
import { MAX_PHOTO_BYTES, type PhotoState } from '@/lib/dogPhotos'
import PhotoFrameGuide from './PhotoFrameGuide'
import { isAdvancedUiEnabled } from '@/lib/ui-flags'
import { Modal, Cropper } from '@/components/v3'

const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif'

type Props = {
  /** Currently persisted photo URL, if any. */
  currentUrl: string | null
  /** Fires when the user picks, replaces, removes, or reverts. */
  onChange: (state: PhotoState) => void
  /** Size in pixels (square). Default 96. */
  size?: number
  /**
   * R15-C29: 사용자가 파일 선택 후 Cropper modal 띄워 정사각 crop.
   * default false (기존 동작). NewDogClient / EditDogClient 에서 true 권장.
   */
  enableCrop?: boolean
}

export default function DogPhotoPicker({
  currentUrl,
  onChange,
  size = 96,
  enableCrop = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<PhotoState>({ action: 'keep' })
  const [error, setError] = useState<string | null>(null)
  // 촬영 가이드 모달 — 신분증 촬영처럼 frame 안내. 발명 모듈 B 보조.
  // 가이드 모달 닫힐 때 또는 "이대로 사진 선택" 시 file input 트리거.
  const [guideOpen, setGuideOpen] = useState(false)
  // R15-C29: enableCrop 일 때 file pick → cropper 띄움.
  const [pendingFileUrl, setPendingFileUrl] = useState<string | null>(null)
  const [pendingFileName, setPendingFileName] = useState<string>('photo.jpg')
  // 초기 단계 — 촬영 팁 / 신용카드 안내 hide. default OFF.
  const showPhotoTips = isAdvancedUiEnabled('photo_tips')

  // revoke any created object URLs on unmount / replacement
  useEffect(() => {
    return () => {
      if (state.action === 'replace') {
        URL.revokeObjectURL(state.previewUrl)
      }
    }
  }, [state])

  function update(next: PhotoState) {
    setState((prev) => {
      if (prev.action === 'replace' && prev !== next) {
        URL.revokeObjectURL(prev.previewUrl)
      }
      return next
    })
    onChange(next)
  }

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking same file
    if (!file) return

    if (file.size > MAX_PHOTO_BYTES) {
      setError('사진은 3MB 이하만 올릴 수 있어요')
      return
    }
    if (!ACCEPTED.split(',').includes(file.type)) {
      setError('JPG, PNG, WebP, GIF만 지원해요')
      return
    }

    if (enableCrop) {
      // Cropper modal 띄움 — crop 완료 후 update().
      const url = URL.createObjectURL(file)
      setPendingFileName(file.name || 'photo.jpg')
      setPendingFileUrl(url)
      return
    }

    const previewUrl = URL.createObjectURL(file)
    update({ action: 'replace', file, previewUrl })
  }

  function handleCropDone(blob: Blob) {
    const cropped = new File([blob], pendingFileName.replace(/\.[^.]+$/, '.jpg'), {
      type: 'image/jpeg',
    })
    const previewUrl = URL.createObjectURL(blob)
    update({ action: 'replace', file: cropped, previewUrl })
    if (pendingFileUrl) URL.revokeObjectURL(pendingFileUrl)
    setPendingFileUrl(null)
  }

  function handleCropCancel() {
    if (pendingFileUrl) URL.revokeObjectURL(pendingFileUrl)
    setPendingFileUrl(null)
  }

  function handleRemove() {
    setError(null)
    if (state.action === 'replace') {
      // user picked a new file but hadn't saved — revert to current
      update({ action: 'keep' })
    } else if (currentUrl) {
      // mark existing photo for removal on save
      update({ action: 'remove' })
    }
  }

  const displayUrl =
    state.action === 'replace'
      ? state.previewUrl
      : state.action === 'remove'
      ? null
      : currentUrl

  const canRemove = state.action === 'replace' || (state.action === 'keep' && !!currentUrl)

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative group shrink-0"
        style={{ width: size, height: size }}
        aria-label="사진 업로드"
      >
        {/* Circular image mask — overflow clips the image only, not the badge */}
        <span
          className="absolute inset-0 rounded-full overflow-hidden bg-bg border border-rule group-hover:border-terracotta transition block"
        >
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayUrl}
              alt="강아지 사진"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="w-full h-full flex items-center justify-center">
              <DogPawMark className="w-8 h-8 text-muted" />
            </span>
          )}
          {/* Camera overlay (inside mask) */}
          <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center pointer-events-none">
            <span className="w-8 h-8 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" strokeWidth={2} />
            </span>
          </span>
        </span>
        {/* Always-visible camera badge — lives on the outer wrapper so it can
            sit on the circle's edge without being clipped by overflow-hidden. */}
        <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-terracotta border-2 border-white flex items-center justify-center shadow-sm md:group-hover:scale-110 transition z-10">
          <Camera className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
        </span>
      </button>

      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.2em]">
          Photo
        </div>
        <div className="text-[12px] text-text/70 mt-0.5 leading-relaxed">
          {state.action === 'replace'
            ? '저장하면 새 사진이 적용돼요'
            : state.action === 'remove'
            ? '저장하면 사진이 제거돼요'
            : displayUrl
            ? '탭해서 사진을 변경할 수 있어요'
            : '강아지 사진을 올려주세요 (최대 3MB)'}
        </div>
        {/* 발명 모듈 B 안내 — 참조 객체 함께 촬영 시 절대 크기 보정.
            voice-guidelines §11 사진은 옵션. 강제 X.
            초기 단계 — ui-flag 'photo_tips' OFF 면 hide. */}
        {showPhotoTips && !displayUrl && state.action !== 'remove' && (
          <div
            className="mt-2 inline-flex items-start gap-1.5 text-[10.5px] leading-relaxed"
            style={{ color: 'var(--terracotta)' }}
          >
            <Lightbulb
              className="w-3 h-3 shrink-0 mt-0.5"
              strokeWidth={2}
              aria-hidden
            />
            <span>신용카드를 같이 찍으면 맞춤도가 더 정확해요</span>
          </div>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rule bg-white text-[11px] font-bold text-text hover:border-terracotta hover:text-terracotta transition"
          >
            <Camera className="w-3 h-3" strokeWidth={2} />
            {displayUrl ? '변경' : '선택'}
          </button>
          {/* 촬영 가이드 — 모달 트리거. 작은 보조 링크라 강제감 없음.
              ui-flag 'photo_tips' OFF 면 hide. */}
          {showPhotoTips && (
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-bold text-muted hover:text-terracotta transition"
              aria-label="촬영 가이드 보기"
            >
              <HelpCircle className="w-3 h-3" strokeWidth={2} />
              촬영 팁
            </button>
          )}
          {canRemove && (
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rule bg-white text-[11px] font-bold text-muted hover:border-sale hover:text-sale transition"
            >
              <X className="w-3 h-3" strokeWidth={2.5} />
              제거
            </button>
          )}
          {state.action === 'remove' && currentUrl && (
            <button
              type="button"
              onClick={() => update({ action: 'keep' })}
              className="text-[11px] font-bold text-muted underline hover:text-text"
            >
              되돌리기
            </button>
          )}
        </div>
        {error && (
          <div className="text-[11px] font-semibold text-sale mt-1.5">
            {error}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        onChange={handlePick}
        className="hidden"
      />

      {/* 촬영 가이드 — 신분증 frame 패턴. 발명 모듈 B 의 시각적 보조.
          가이드의 "이대로 사진 선택" 클릭 시 file input 트리거.
          모달은 useModalA11y 가 Esc/Tab/Body lock 처리. */}
      <PhotoFrameGuide
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onTakePhoto={() => inputRef.current?.click()}
      />

      {/* R15-C29: Cropper modal — enableCrop 일 때 file pick 직후 노출. */}
      {enableCrop && (
        <Modal
          open={pendingFileUrl !== null}
          onClose={handleCropCancel}
          title="사진 크롭"
          dismissOnBackdrop={false}
          maxWidth={360}
        >
          <Modal.Body>
            {pendingFileUrl && (
              <Cropper
                src={pendingFileUrl}
                viewportSize={280}
                outputSize={512}
                onCrop={handleCropDone}
                onCancel={handleCropCancel}
              />
            )}
          </Modal.Body>
        </Modal>
      )}
    </div>
  )
}
