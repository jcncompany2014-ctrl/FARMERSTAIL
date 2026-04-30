/**
 * useModalA11y — modal / dialog 접근성 훅.
 *
 * 5가지 표준 동작을 한 번에:
 *   1) Esc 키로 닫기
 *   2) Tab / Shift+Tab focus trap (modal 내부에서만 순환)
 *   3) close 시 이전 active element 로 focus 복원
 *   4) modal 열릴 때 첫 focusable 로 자동 focus
 *   5) body 스크롤 잠금 (overscroll-behavior contain)
 *
 * # 사용법
 *
 *   const dialogRef = useRef<HTMLDivElement>(null)
 *   useModalA11y({ open, onClose: () => setOpen(false), containerRef: dialogRef })
 *
 *   return open ? (
 *     <div role="dialog" aria-modal="true" ref={dialogRef}>...</div>
 *   ) : null
 *
 * # 왜 라이브러리 안 쓰고 직접
 * - radix-ui/dialog 의 모달 부분만 80KB+. 우리는 50줄이면 충분.
 * - SSR/하이드레이션 충돌 회피 (focus trap 라이브러리들이 createPortal 가정).
 *
 * # 한계 / 주의
 * - container 안에 [tabindex="-1"] 만 있고 focusable 이 0개면 trap 무력화 됨.
 *   호출처에서 Cancel 버튼 같은 명시적 focusable 을 항상 두자.
 * - SSR 첫 렌더에서 `open=true` 라도 effect 가 client-only 라 1tick 늦게 잡힘.
 *   프로덕션에선 거의 인지 불가.
 */
import { useEffect } from 'react'
import type { RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export interface UseModalA11yOptions {
  /** 모달이 보이는 상태인지. false 면 모든 핸들러 noop. */
  open: boolean
  /** Esc / 외부 신호로 모달을 닫는 함수. */
  onClose: () => void
  /** focus trap 의 경계가 되는 element. open === true 시점에 mount 돼 있어야. */
  containerRef: RefObject<HTMLElement | null>
  /**
   * 첫 focus 를 지정하고 싶으면 specific element ref. 생략하면 container 안의
   * 첫 focusable.
   */
  initialFocusRef?: RefObject<HTMLElement | null>
  /** body scroll lock. 기본 true. fullscreen modal 이 아니면 false 도 가능. */
  lockScroll?: boolean
  /** Esc 무시 — 결제 진행 중처럼 의도적으로 막아야 할 때만 true. 기본 false. */
  preventEscape?: boolean
}

export function useModalA11y({
  open,
  onClose,
  containerRef,
  initialFocusRef,
  lockScroll = true,
  preventEscape = false,
}: UseModalA11yOptions) {
  // 1) body scroll lock
  useEffect(() => {
    if (!open || !lockScroll) return
    const prevOverflow = document.body.style.overflow
    const prevPaddingRight = document.body.style.paddingRight
    // 스크롤바 폭 보정 — 모달 열릴 때 body 가 살짝 옆으로 밀리는 jank 방지.
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbarW > 0) {
      document.body.style.paddingRight = `${scrollbarW}px`
    }
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPaddingRight
    }
  }, [open, lockScroll])

  // 2) initial focus + 3) focus restore on close
  useEffect(() => {
    if (!open) return
    const prevActive = document.activeElement as HTMLElement | null

    // 첫 focusable 잡기 — 다음 microtask 로 미뤄서 portal/animation 이 mount 후.
    const t = window.setTimeout(() => {
      const target =
        initialFocusRef?.current ??
        containerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
        containerRef.current
      target?.focus()
    }, 0)

    return () => {
      window.clearTimeout(t)
      // 모달 닫힐 때 직전 element 로 focus 복원 — 키보드 사용자가 흐름 잃지 않게.
      if (prevActive && typeof prevActive.focus === 'function') {
        prevActive.focus()
      }
    }
  }, [open, containerRef, initialFocusRef])

  // 4) Esc + 5) Tab focus trap
  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !preventEscape) {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const root = containerRef.current
      if (!root) return
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (el) =>
          // visibility / display:none 제외 — getBoundingClientRect 0,0 이면 보통 숨김.
          el.offsetParent !== null || el === document.activeElement,
      )
      if (focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, containerRef, preventEscape])
}
