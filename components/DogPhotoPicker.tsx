'use client'

import { useEffect, useRef, useState } from 'react'
import { Lightbulb, HelpCircle } from 'lucide-react'
import { MAX_PHOTO_BYTES, type PhotoState } from '@/lib/dogPhotos'
import PhotoFrameGuide from './PhotoFrameGuide'
import { isAdvancedUiEnabled } from '@/lib/ui-flags'
import { Modal, Cropper } from '@/components/v3'
import { V3, V3Radius } from '@/lib/design/tokens'
import { CameraIcon, PawFillIcon } from '@/components/v3/dog/DogIcons'
import { IDLE_BORDER } from '@/components/v3/dog/DogFormParts'

/**
 * DogPhotoPicker — 강아지 등록(/dogs/new)·정보 수정(/dogs/[id]/edit) 전용 사진 고르기(앱).
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 D11·D13): 왼쪽 사진 동그라미 88(사진 없으면 회색 면 + 발바닥) +
 * 오른쪽 아래 먹색 사진기 표시(32) · 오른쪽에 안내 한 줄 + 네모 버튼(먹선 '사진 고르기'/'바꾸기', 옅은 테두리 '지우기').
 * 바깥 칸(등록 = 점선, 수정 = 회색 면)은 부르는 화면이 그린다. 영어 머리말('Photo')은 뺐고,
 * "탭해서 사진을 변경할 수 있어요" → "눌러서 사진을 바꿀 수 있어요"(시안·'탭' 대신 '누르').
 * 고르기·자르기·용량 검사·되돌리기 동작은 그대로다.
 */

const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif'

type Props = {
  /** Currently persisted photo URL, if any. */
  currentUrl: string | null
  /** Fires when the user picks, replaces, removes, or reverts. */
  onChange: (state: PhotoState) => void
  /** Size in pixels (square). Default 88(시안). */
  size?: number
  /**
   * R15-C29: 사용자가 파일 선택 후 Cropper modal 띄워 정사각 crop.
   * default false (기존 동작). NewDogClient / EditDogClient 에서 true 권장.
   */
  enableCrop?: boolean
}

/** 오른쪽 네모 버튼(높이 40). */
function smallButton(primary: boolean): React.CSSProperties {
  return {
    height: 40,
    padding: '0 14px',
    boxSizing: 'border-box',
    border: `1.5px solid ${primary ? V3.ink : IDLE_BORDER}`,
    borderRadius: V3Radius.sm,
    background: '#FFFFFF',
    color: primary ? V3.ink : V3.inkSoft,
    fontFamily: 'inherit',
    fontSize: 15,
    fontWeight: primary ? 800 : 700,
    display: 'inline-flex',
    alignItems: 'center',
    cursor: 'pointer',
  }
}

export default function DogPhotoPicker({
  currentUrl,
  onChange,
  size = 88,
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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${size}px 1fr`,
        columnGap: 16,
        alignItems: 'center',
        lineHeight: 'normal',
      }}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{ position: 'relative', width: size, height: size, padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}
        aria-label={displayUrl ? '사진 바꾸기' : '사진 올리기'}
      >
        {/* 동그라미 — 사진만 잘린다(아래 사진기 표시는 바깥이라 안 잘림). */}
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: size / 2,
            overflow: 'hidden',
            background: V3.soft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayUrl} alt="강아지 사진" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <PawFillIcon size={Math.round(size * 0.43)} color="#9A9A9A" />
          )}
        </span>
        <span
          aria-hidden
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: 32,
            height: 32,
            boxSizing: 'border-box',
            borderRadius: 16,
            background: V3.ink,
            border: '2px solid #FFFFFF',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CameraIcon size={16} strokeWidth={2.4} />
        </span>
      </button>

      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: displayUrl ? 15 : 16, lineHeight: 1.45, color: V3.inkSoft }}>
          {state.action === 'replace' ? (
            '저장하면 새 사진이 적용돼요'
          ) : state.action === 'remove' ? (
            '저장하면 사진이 제거돼요'
          ) : displayUrl ? (
            '눌러서 사진을 바꿀 수 있어요'
          ) : (
            <>
              강아지 사진을 올려주세요
              <br />
              <span style={{ fontSize: 14, color: V3.inkMute }}>3MB까지</span>
            </>
          )}
        </span>
        {/* 발명 모듈 B 안내 — 참조 객체 함께 촬영 시 절대 크기 보정.
            voice-guidelines §11 사진은 옵션. 강제 X.
            초기 단계 — ui-flag 'photo_tips' OFF 면 hide. */}
        {showPhotoTips && !displayUrl && state.action !== 'remove' && (
          <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 6, fontSize: 14, lineHeight: 1.5, color: V3.inkSoft }}>
            <Lightbulb size={14} strokeWidth={2} aria-hidden style={{ flexShrink: 0, marginTop: 3 }} />
            <span>신용카드를 같이 찍으면 맞춤도가 더 정확해요</span>
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => inputRef.current?.click()} style={smallButton(true)}>
            {displayUrl ? '바꾸기' : '사진 고르기'}
          </button>
          {/* 촬영 가이드 — 모달 트리거. 작은 보조 링크라 강제감 없음.
              ui-flag 'photo_tips' OFF 면 hide. */}
          {showPhotoTips && (
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              aria-label="촬영 가이드 보기"
              style={{ ...smallButton(false), border: 0, padding: '0 6px', gap: 4 }}
            >
              <HelpCircle size={14} strokeWidth={2} aria-hidden />
              촬영 팁
            </button>
          )}
          {canRemove && (
            <button type="button" onClick={handleRemove} style={smallButton(false)}>
              지우기
            </button>
          )}
          {state.action === 'remove' && currentUrl && (
            <button
              type="button"
              onClick={() => update({ action: 'keep' })}
              style={{
                minHeight: 40,
                padding: '0 4px',
                border: 0,
                background: 'transparent',
                color: V3.inkSoft,
                fontFamily: 'inherit',
                fontSize: 15,
                fontWeight: 700,
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              되돌리기
            </button>
          )}
        </span>
        {error && (
          <span role="alert" style={{ fontSize: 14, fontWeight: 700, color: V3.sale }}>
            {error}
          </span>
        )}
      </span>

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
