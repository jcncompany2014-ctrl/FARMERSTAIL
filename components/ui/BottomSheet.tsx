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

import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react'

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
  // 드래그로 닫기 — 그래버/헤더 영역을 아래로 끌면 시트가 따라 내려오고,
  // 90px 이상이면 닫힘 / 미만이면 스프링백. 시각 변화 없음(동작만 추가).
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef({ startY: 0, dy: 0, active: false })
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
      // 이전 드래그 잔여 transform 제거 — 새로 열릴 때 항상 제자리.
      const sheet = sheetRef.current
      if (sheet) {
        sheet.style.transition = ''
        sheet.style.transform = ''
      }
    } else if (!open && el.open) {
      el.close()
    }
  }, [open])

  // 드래그 핸들러 — 그래버+제목 영역 한정 (본문 스크롤과 충돌 방지).
  // dismissOnBackdrop=false(저장 중 등 닫기 잠금)면 드래그 닫기도 잠금.
  const onDragStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dismissOnBackdrop) return
      drag.current = { startY: e.clientY, dy: 0, active: true }
      e.currentTarget.setPointerCapture(e.pointerId)
      const sheet = sheetRef.current
      if (sheet) sheet.style.transition = 'none'
    },
    [dismissOnBackdrop],
  )
  const onDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const s = drag.current
    if (!s.active) return
    s.dy = Math.max(0, e.clientY - s.startY)
    const sheet = sheetRef.current
    if (sheet) sheet.style.transform = `translateY(${s.dy}px)`
  }, [])
  const onDragEnd = useCallback(() => {
    const s = drag.current
    if (!s.active) return
    s.active = false
    const sheet = sheetRef.current
    if (!sheet) return
    if (s.dy > 90) {
      sheet.style.transition = ''
      sheet.style.transform = ''
      onClose()
    } else {
      sheet.style.transition = 'transform 180ms ease'
      sheet.style.transform = 'translateY(0)'
      window.setTimeout(() => {
        sheet.style.transition = ''
        sheet.style.transform = ''
      }, 200)
    }
  }, [onClose])

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

  // aria-labelledby 용 고유 id. useId 는 SSR/CSR 동일 id 를 보장(hydration 안전)
  // 하면서, 한 페이지에 BottomSheet 가 둘 이상 떠도 id 충돌이 없게 한다.
  // (이전엔 하드코딩 'bottom-sheet-title' → 동시 2개 시 aria-labelledby 모호.)
  const generatedId = useId()
  const titleId = title ? generatedId : undefined

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
      // showModal() 이 포커스 대상이 없으면 dialog 자체에 포커스를 준다 →
      // 전역 :focus-visible(2px terracotta) 아웃라인이 시트 상단에 '일자 오렌지 선'
      // 으로 드러남(안쪽 div 만 라운드라 사각 dialog 테두리가 보임). 컨테이너
      // 아웃라인만 제거 — 내부 버튼/입력의 포커스 링은 그대로 유지된다.
      style={{ maxHeight, outline: 'none' }}
    >
      {/* 내부 컨테이너 — dialog 에 직접 bg 를 먹이면 backdrop 과 겹쳐 엉킴 */}
      <div
        ref={sheetRef}
        className="bg-bg rounded-t-3xl shadow-[0_-8px_24px_-12px_rgba(30,26,20,0.25)] flex flex-col overflow-hidden"
      >
        {/* 드래그 존 — 그래버 + 제목. touchAction none 으로 스크롤 대신
            pointermove 수신. 본문(Body) 스크롤은 영향 없음. */}
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          style={{ touchAction: 'none' }}
        >
          {/* Grabber — 드래그로 닫기 가능. */}
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
        </div>
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
      className={`px-5 py-4 shrink-0 border-t border-rule bg-bg-2/80 backdrop-blur-sm${className ? ` ${className}` : ''}`}
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
