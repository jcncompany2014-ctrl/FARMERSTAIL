'use client'

/**
 * Farmer's Tail — Bottom sheet modal.
 *
 * # 왜 <dialog> native element 를 쓰는가
 *
 * 자체 portal + div 로 만들면 ESC · focus trap · inert · click-outside 전부
 * 직접 구현해야 하고, iOS Safari 에서 스크롤 스큐 이슈가 끝없이 터진다.
 * HTMLDialogElement.showModal() 은 이 모든 걸 무료로 준다:
 *   - ::backdrop 가상 요소가 scrim 을 그려줌
 *   - body 외 영역을 inert 로 만들고 키보드 포커스 가둠
 *   - ESC 로 close → onClose 이벤트 발화
 *   - 브라우저 기본 top layer 로 올라가 z-index 전쟁 제로
 *
 * 대신 기본 사용자 UI 가 중앙 정렬이라, 하단 시트로 보이게 CSS 로 재배치.
 *
 * # API
 *
 *   <BottomSheet open={isOpen} onClose={() => setOpen(false)} title="옵션 선택">
 *     <BottomSheet.Body>...</BottomSheet.Body>
 *     <BottomSheet.Footer>
 *       <button>확인</button>
 *     </BottomSheet.Footer>
 *   </BottomSheet>
 *
 * title 이 주어지면 <h2> 로 렌더 + aria-labelledby 로 연결된다.
 * title 없는 경우 `aria-label` 을 직접 넘겨야 screen reader 가 헤매지 않음.
 */

import { useCallback, useEffect, useRef, type ReactNode } from 'react'

type BottomSheetProps = {
  open: boolean
  onClose: () => void
  title?: string
  /** title 없을 때 필수. 짧은 문맥 설명 — screen reader 용. */
  ariaLabel?: string
  /** 스크림 클릭으로 닫기. 폼 입력 중엔 false 로 두는 게 안전. 기본 true. */
  dismissOnBackdrop?: boolean
  /** Sheet 최대 높이. 기본 85vh 라 긴 리스트도 내부 스크롤 가능. */
  maxHeight?: string
  children: ReactNode
}

function BottomSheetRoot({
  open,
  onClose,
  title,
  ariaLabel,
  dismissOnBackdrop = true,
  maxHeight = '85vh',
  children,
}: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  // open prop 변화에 따라 native dialog 제어.
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open && !el.open) {
      try {
        el.showModal()
      } catch {
        /* Safari < 15.4 fallback — showModal 지원 안 하면 .show() 로 flat fallback */
        el.show()
      }
    } else if (!open && el.open) {
      el.close()
    }
  }, [open])

  // ESC / dialog native close → onClose 호출. native close 는 사용자의 ESC,
  // form method=dialog submit, 스크립트의 .close() 등으로 발화.
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const handler = () => onClose()
    el.addEventListener('close', handler)
    return () => el.removeEventListener('close', handler)
  }, [onClose])

  // 스크림 클릭 → 닫기. <dialog> 의 click 이벤트는 dialog 영역 바깥이면
  // target === dialog 자체라는 특성을 이용.
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (!dismissOnBackdrop) return
      if (e.target === dialogRef.current) onClose()
    },
    [dismissOnBackdrop, onClose],
  )

  // aria-labelledby 용 안정된 id. useId 를 써도 되지만 한 번 마운트 후 stable
  // 이면 충분 + SSR 과의 hydration 이슈 없음.
  const titleId = title ? 'bottom-sheet-title' : undefined

  return (
    <dialog
      ref={dialogRef}
      onClick={handleClick}
      aria-labelledby={titleId}
      aria-label={title ? undefined : ariaLabel}
      className={[
        // 기본 dialog 스타일 리셋 (브라우저마다 border/padding 다름).
        'p-0 bg-transparent',
        // 하단 정렬 + 폰 프레임 폭에 맞춤 (≥md 에선 PhoneFrame 가운데 정렬).
        'mt-auto mb-0 w-full max-w-[440px]',
        // backdrop 은 ::backdrop 가상요소로 제어 — Tailwind arbitrary 사용.
        'backdrop:bg-ink/40 backdrop:backdrop-blur-[1px]',
        // 등장 애니메이션 — globals.css 의 --animate-slide-in-up 토큰.
        'animate-slide-in-up',
      ].join(' ')}
      style={{ maxHeight }}
    >
      {/* 내부 컨테이너 — dialog 에 직접 bg 를 먹이면 backdrop 과 겹쳐 엉킴 */}
      <div className="bg-bg rounded-t-3xl shadow-[0_-8px_24px_-12px_rgba(30,26,20,0.25)] flex flex-col overflow-hidden">
        {/* Grabber — 시각적 드래그 힌트. 실제 드래그 제스처는 범위 밖. */}
        <div
          className="flex justify-center pt-2.5 pb-1 shrink-0"
          aria-hidden="true"
        >
          <span className="block h-1 w-10 rounded-full bg-rule-2" />
        </div>
        {title && (
          <header className="px-5 pt-2 pb-3 shrink-0 border-b border-rule">
            <h2
              id={titleId}
              className="text-base font-bold text-ink leading-snug"
            >
              {title}
            </h2>
          </header>
        )}
        {children}
      </div>
    </dialog>
  )
}

function BottomSheetBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`px-5 py-4 overflow-y-auto flex-1${className ? ` ${className}` : ''}`}
    >
      {children}
    </div>
  )
}

function BottomSheetFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`px-5 py-4 shrink-0 border-t border-rule bg-white/60 backdrop-blur-sm${className ? ` ${className}` : ''}`}
    >
      {children}
    </div>
  )
}

export const BottomSheet = Object.assign(BottomSheetRoot, {
  Body: BottomSheetBody,
  Footer: BottomSheetFooter,
})

export default BottomSheet
