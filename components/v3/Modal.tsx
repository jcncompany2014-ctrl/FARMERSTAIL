'use client'

/**
 * Modal — v3 중앙 정렬 dialog (2026-05-22 R10-3).
 *
 * **앱 컨텍스트 전용.** native `<dialog>` 요소 기반 — BottomSheet 와 동일 패턴
 * 이지만 중앙 정렬. ESC / backdrop click / focus trap / inert 가 브라우저 기본
 * 동작으로 무료 제공.
 *
 * # 언제 쓰나
 *
 * - 확인 dialog (해지/삭제/탈퇴 confirm) — 브라우저 `confirm()` 대체
 * - 사진 zoom / lightbox
 * - 짧은 inline 폼 (1~2 필드)
 * - 결제 method 선택 같은 중요 선택
 *
 * 긴 폼 / 리스트 / 모바일 풀 시트는 BottomSheet 를 쓸 것.
 *
 * # API
 *
 *   <Modal open={isOpen} onClose={() => setOpen(false)} title="정말 해지할까요?">
 *     <Modal.Body>
 *       해지하면 다음 배송이 중단돼요.
 *     </Modal.Body>
 *     <Modal.Footer>
 *       <button onClick={cancel}>아니요</button>
 *       <button onClick={confirm}>해지하기</button>
 *     </Modal.Footer>
 *   </Modal>
 *
 * # 디자인 핸드오프
 *
 *   - 컨테이너: paperHi + 1px ink rule + radius 4
 *   - title: sans 800 18px + 좌측 정렬
 *   - body: 13.5px ink + line-height 1.55
 *   - footer: 우측 정렬 액션 + 1px rule top
 *   - backdrop: ink 40% + 가벼운 blur
 *
 * # 접근성
 *
 *   - title 이 있으면 aria-labelledby 자동 연결
 *   - title 없을 땐 ariaLabel prop 필수
 *   - ESC 로 닫힘 (native dialog 기본)
 *   - backdrop click 으로 닫힘 (dismissOnBackdrop=true 기본)
 */

import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { V3, V3FontWeight, V3LetterSpacing, V3Radius } from '@/lib/design/tokens'

interface ModalProps {
  open: boolean
  onClose: () => void
  /** 헤더에 굵게 들어가는 제목. ariaLabel 자동 연결. */
  title?: string
  /** title 없을 때 필수 — screen reader 용 짧은 설명. */
  ariaLabel?: string
  /** 스크림 클릭으로 닫기. 폼 입력 중인 modal 은 false 권장. 기본 true. */
  dismissOnBackdrop?: boolean
  /** 우상단 X 버튼 표시. 기본 true. confirm dialog 는 false 권장 (강제 결정). */
  showClose?: boolean
  /** 컨테이너 max width. 기본 360 (mobile compact). 큰 콘텐츠는 480~520. */
  maxWidth?: number | string
  children: ReactNode
}

function ModalRoot({
  open,
  onClose,
  title,
  ariaLabel,
  dismissOnBackdrop = true,
  showClose = true,
  maxWidth = 360,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  // open prop → native dialog 제어
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open && !el.open) {
      try {
        el.showModal()
      } catch {
        // Safari < 15.4 fallback
        el.show()
      }
    } else if (!open && el.open) {
      el.close()
    }
  }, [open])

  // native close → onClose 호출 (ESC, form method=dialog submit 등)
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const handler = () => onClose()
    el.addEventListener('close', handler)
    return () => el.removeEventListener('close', handler)
  }, [onClose])

  // backdrop click → close (target === dialog 자체일 때)
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (!dismissOnBackdrop) return
      if (e.target === dialogRef.current) onClose()
    },
    [dismissOnBackdrop, onClose],
  )

  const titleId = title ? 'modal-title' : undefined

  return (
    <dialog
      ref={dialogRef}
      onClick={handleClick}
      aria-labelledby={titleId}
      aria-label={title ? undefined : ariaLabel}
      className="p-0 bg-transparent backdrop:bg-[rgba(22,20,15,0.42)] backdrop:backdrop-blur-[1px] animate-fade-in"
      style={{
        // dialog 의 기본 중앙 정렬을 활용 — margin auto.
        width: '100%',
        maxWidth,
        // padding 은 viewport edge 안전 마진. mobile 에서 작게.
        marginInline: 16,
      }}
    >
      <div
        style={{
          background: V3.paperHi,
          border: `1px solid ${V3.rule}`,
          borderRadius: V3Radius.sm,
          overflow: 'hidden',
          // 살짝의 elevation — paperHi 배경 위에 떠 있는 느낌.
          boxShadow: '0 12px 36px -8px rgba(22,20,15,0.28)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {(title || showClose) && (
          <header
            className="flex items-start justify-between"
            style={{
              padding: '16px 18px 0',
              gap: 12,
            }}
          >
            {title ? (
              <h2
                id={titleId}
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: V3FontWeight.black,
                  fontSize: 16,
                  color: V3.ink,
                  letterSpacing: V3LetterSpacing.heading,
                  lineHeight: 1.3,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {title}
              </h2>
            ) : (
              <span />
            )}
            {showClose && (
              <button
                type="button"
                aria-label="닫기"
                onClick={onClose}
                className="shrink-0 flex items-center justify-center"
                style={{
                  width: 28,
                  height: 28,
                  marginTop: -4,
                  marginRight: -6,
                  borderRadius: V3Radius.xs,
                  background: 'transparent',
                  border: 'none',
                  color: V3.inkMute,
                  cursor: 'pointer',
                }}
              >
                <X size={16} strokeWidth={2} />
              </button>
            )}
          </header>
        )}
        {children}
      </div>
    </dialog>
  )
}

/**
 * Body — 본문 컨테이너. padding + 본문 톤.
 */
function ModalBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={className}
      style={{
        padding: '12px 18px 18px',
        fontSize: 13.5,
        color: V3.ink,
        lineHeight: 1.55,
      }}
    >
      {children}
    </div>
  )
}

/**
 * Footer — 액션 row. 1px rule top, 우측 정렬, 기본 8px gap.
 */
function ModalFooter({
  children,
  className,
  align = 'right',
}: {
  children: ReactNode
  className?: string
  align?: 'right' | 'between' | 'center'
}) {
  const justify =
    align === 'between'
      ? 'space-between'
      : align === 'center'
        ? 'center'
        : 'flex-end'
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        justifyContent: justify,
        gap: 8,
        padding: '14px 18px',
        borderTop: `1px solid ${V3.rule}`,
        background: V3.paper,
      }}
    >
      {children}
    </div>
  )
}

export const Modal = Object.assign(ModalRoot, {
  Body: ModalBody,
  Footer: ModalFooter,
})

export default Modal
