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

import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { V3, V3FontWeight, V3FontSize, V3LetterSpacing, V3Radius } from '@/lib/design/tokens'

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
  const panelRef = useRef<HTMLDivElement | null>(null)

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
      // ★자동 포커스를 첫 버튼(X/취소)이 아니라 패널로 옮긴다 — showModal 은
      //   기본으로 첫 focusable 을 포커스해 :focus-visible 주황 링이 "열자마자
      //   자동으로" 뜬다(2026-07-19 사장님 폰). 패널(tabindex=-1·outline:none)
      //   포커스는 링이 안 뜨고, 포커스 트랩·스크린리더 제목은 그대로 유지.
      requestAnimationFrame(() => panelRef.current?.focus())
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

  // 하드코딩 'modal-title' 은 같은 페이지에 Modal 2개(둘 다 open prop으로 항상 DOM
  // 상주)면 id 중복 → aria-labelledby 깨짐. useId 로 인스턴스별 유일 id(2026-06-20).
  const reactId = useId()
  const titleId = title ? `${reactId}-title` : undefined

  return (
    <dialog
      ref={dialogRef}
      onClick={handleClick}
      aria-labelledby={titleId}
      aria-label={title ? undefined : ariaLabel}
      // ★flex 는 `open:` variant 로만 — 인라인 display:flex 를 박으면 UA 의
      //   `dialog:not([open]){display:none}` 을 덮어써 닫힌 모달이 "항상 떠
      //   있는" 회귀가 난다(2026-07-19 사장님 폰). hidden(기본 none) + open:flex.
      className="hidden open:flex open:items-center open:justify-center bg-transparent backdrop:bg-[rgba(22,20,15,0.42)] backdrop:backdrop-blur-[1px] animate-fade-in"
      style={{
        // ★네이티브 <dialog> 세로 중앙정렬이 iOS 에서 상단에 붙던 문제 →
        //   dialog 를 뷰포트 전체 flex 컨테이너로 만들어 패널을 확실히 중앙정렬
        //   (2026-07-19 사장님 폰). padding 이 viewport edge 안전 마진.
        width: '100vw',
        height: '100dvh',
        maxWidth: 'none',
        maxHeight: 'none',
        margin: 0,
        padding: 16,
        border: 'none',
        background: 'transparent',
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        style={{
          outline: 'none', // 패널 프로그램 포커스 — 링 없이(위 requestAnimationFrame)
          width: '100%',
          maxWidth,
          background: V3.paperHi,
          border: `1px solid ${V3.rule}`,
          borderRadius: V3Radius.sm,
          // 긴 본문/세로 짧은 화면(가로모드·소형기기)서 헤더·닫기가 뷰포트 위로
          // 잘려 스크롤 불가하던 것 방지 — 뷰포트 높이로 캡 + 내부 스크롤(2026-07-17).
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
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
                  fontSize: V3FontSize.md,
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
                  // 탭 영역 40px(HIG 근접) — 아이콘 시각 위치는 마진 보정으로 유지
                  // (28px 는 오탭 위험, 2026-07-17).
                  width: 40,
                  height: 40,
                  marginTop: -10,
                  marginRight: -12,
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
        fontSize: V3FontSize.base,
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
