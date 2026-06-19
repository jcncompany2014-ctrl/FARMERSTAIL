'use client'

/**
 * FdSlider — FD 가로 캐러셀 (farm v6, 2026-06-13 · a11y 심화 2026-06-14 회차28).
 *
 * thefarmersdog.com 의 후기/수의사 후기/제품 캐러셀 복제: 가로 scroll-snap +
 * 드래그/스와이프(네이티브 overflow) + 좌우 화살표 버튼. 카드는 children 으로
 * 받고 각 카드에 snap-start shrink-0 + 폭을 준다. reduced-motion 은 globals.css
 * 전역 net 이 smooth scroll 을 억제. 화살표는 :focus-visible 가시 포커스.
 *
 * a11y(ARIA APG 캐러셀 idiom): 뷰포트 role=group + aria-roledescription="캐러셀"
 * + tabIndex 0 으로 키보드 포커스 가능, ←/→ 로 한 폭씩·Home/End 로 처음/끝 이동.
 * 화살표는 끝단에서 aria-disabled + dim(40%) — 포커스 유실 방지 위해 native
 * disabled 대신 aria-disabled + onClick 가드(APG 권장).
 */
import { Children, useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// prefers-reduced-motion 이면 프로그램 스크롤(화살표·Home/End)도 즉시 이동.
// JS behavior:'smooth' 는 CSS scroll-behavior 와 달리 reduced-motion 자동 억제가
// 안 되므로 명시적으로 분기(회차114, 모션 민감 사용자 보호).
function smoothBehavior(): ScrollBehavior {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    return 'auto'
  }
  return 'smooth'
}

export default function FdSlider({
  children,
  ariaLabel,
}: {
  children: React.ReactNode
  ariaLabel?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const total = Children.count(children)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [grabbing, setGrabbing] = useState(false)
  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: false })

  const updateEdges = useCallback(() => {
    const el = ref.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setAtStart(scrollLeft <= 1)
    // 콘텐츠가 안 넘치면(scrollWidth<=clientWidth) atEnd 도 true → 양쪽 화살표 dim.
    setAtEnd(scrollLeft >= scrollWidth - clientWidth - 1)
    // 현재 슬라이드 = 컨테이너 좌측(scrollPadding 20 + 여유 8)에 걸린 마지막 카드.
    // getBoundingClientRect 로 positioning 영향 없이 정확. 카드 수 적어 비용 무시.
    const edge = el.getBoundingClientRect().left + 28
    const items = el.children
    let idx = 0
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (it && it.getBoundingClientRect().left <= edge) idx = i
      else break
    }
    setActiveIdx(idx)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    updateEdges()
    el.addEventListener('scroll', updateEdges, { passive: true })
    const ro = new ResizeObserver(updateEdges)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateEdges)
      ro.disconnect()
    }
  }, [updateEdges])

  const nudge = useCallback((dir: number) => {
    const el = ref.current
    if (!el) return
    const amount = Math.min(el.clientWidth * 0.85, 440)
    el.scrollBy({ left: dir * amount, behavior: smoothBehavior() })
  }, [])

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      nudge(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      nudge(-1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      el.scrollTo({ left: 0, behavior: smoothBehavior() })
    } else if (e.key === 'End') {
      e.preventDefault()
      el.scrollTo({ left: el.scrollWidth, behavior: smoothBehavior() })
    }
  }

  // 마우스 드래그-투-스크롤 (FD 데스크톱 캐러셀). 터치는 네이티브 overflow 가
  // 이미 처리하므로 pointerType==='mouse' 에만. 드래그 중엔 snap 해제(자유 스크롤),
  // release 시 snap-mandatory 복귀로 카드에 스냅. 드래그였으면 카드 링크 클릭 가드.
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse') return
    const el = ref.current
    if (!el) return
    drag.current = { down: true, startX: e.clientX, startLeft: el.scrollLeft, moved: false }
    setGrabbing(true)
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* 합성/무효 pointerId 등 — 캡처 실패해도 드래그 자체는 동작 */
    }
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current
    const el = ref.current
    if (!d.down || !el) return
    const dx = e.clientX - d.startX
    if (Math.abs(dx) > 3) d.moved = true
    el.scrollLeft = d.startLeft - dx
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current.down) return
    drag.current.down = false
    setGrabbing(false)
    try {
      ref.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
  }
  function onClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (drag.current.moved) {
      e.preventDefault()
      e.stopPropagation()
      drag.current.moved = false
    }
  }

  // 화살표 base — 시각을 인라인 style 가 아닌 클래스로 둬야 :hover 가 먹는다
  // (인라인 background 는 클래스보다 우선순위가 높아 hover 를 못 덮음, 회차91).
  const arrowBase =
    'inline-flex items-center justify-center w-11 h-11 rounded-full border transition active:translate-y-[1px] focus:outline-none focus-visible:[outline:2px_solid_var(--fd-green)] focus-visible:[outline-offset:2px]'

  return (
    <div className="relative">
      <div
        ref={ref}
        role="group"
        aria-roledescription="캐러셀"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
        className={`flex gap-4 overflow-x-auto scrollbar-hide pb-1 -mx-5 px-5 md:mx-0 md:px-0 rounded-[4px] focus:outline-none focus-visible:[outline:2px_solid_var(--fd-green)] focus-visible:[outline-offset:3px] ${
          grabbing ? 'snap-none cursor-grabbing select-none' : 'snap-x snap-mandatory md:cursor-grab'
        }`}
        style={{ scrollPaddingLeft: 20 }}
      >
        {children}
      </div>

      <div className="flex items-center justify-between gap-3 pt-6">
        {/* 슬라이드 위치 인디케이터 (FD "Slide X of N"). aria-live 로 SR 위치 안내. */}
        {total > 1 ? (
          <span
            aria-live="polite"
            className="text-[12px] tabular-nums"
            style={{ color: 'var(--fd-muted)', fontWeight: 700, letterSpacing: '0.02em' }}
          >
            <span className="sr-only">{total}개 중 {activeIdx + 1}번째</span>
            <span aria-hidden>
              {activeIdx + 1} <span style={{ opacity: 0.45 }}>/ {total}</span>
            </span>
          </span>
        ) : (
          <span />
        )}
        <div className="flex gap-2.5">
          <button
            type="button"
            aria-label="이전"
            aria-disabled={atStart || undefined}
            onClick={() => !atStart && nudge(-1)}
            className={`${arrowBase} bg-white text-[var(--fd-pine)] border-[var(--fd-line)] ${
              atStart
                ? 'opacity-40 cursor-default'
                : 'cursor-pointer hover:bg-[var(--fd-cream)] hover:border-[var(--fd-pine)] hover:-translate-y-0.5 hover:shadow-md'
            }`}
          >
            <ChevronLeft size={20} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            aria-label="다음"
            aria-disabled={atEnd || undefined}
            onClick={() => !atEnd && nudge(1)}
            className={`${arrowBase} bg-[var(--fd-pine)] text-white border-[var(--fd-pine)] ${
              atEnd
                ? 'opacity-40 cursor-default'
                : 'cursor-pointer hover:bg-[var(--fd-green)] hover:border-[var(--fd-green)] hover:-translate-y-0.5 hover:shadow-md'
            }`}
          >
            <ChevronRight size={20} strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </div>
  )
}
