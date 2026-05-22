'use client'

/**
 * Tooltip — v3 인라인 도움말 (2026-05-22 R12).
 *
 * **앱 컨텍스트 전용.** trigger 에 hover/focus 시 portal 없이 absolute 위에 떠
 * 짧은 안내 문구를 보여줌. 모바일 터치도 지원 (tap → toggle).
 *
 * # 디자인
 *  - ink 배경 + paperHi 텍스트 (대비 강)
 *  - radius 2 (xs) + 1px paperHi text
 *  - 작은 화살표 (▼) 으로 trigger 방향 표시
 *  - prefers-reduced-motion 존중 (fade-in 비활성)
 *
 * @example
 *   <Tooltip content="이 점수는 FEDIAF 기준으로 계산돼요">
 *     <Info size={14} />
 *   </Tooltip>
 */

import { useState, useRef, useId, type ReactNode } from 'react'
import { V3, V3FontWeight, V3Radius } from '@/lib/design/tokens'

interface TooltipProps {
  /** 떠 있는 박스 안 텍스트/요소. */
  content: ReactNode
  /** trigger — children. */
  children: ReactNode
  /** trigger 기준 위치. 기본 'top'. */
  placement?: 'top' | 'bottom'
  /** 박스 최대 너비. 기본 200. 긴 안내는 240~280. */
  maxWidth?: number
}

export default function Tooltip({
  content,
  children,
  placement = 'top',
  maxWidth = 200,
}: TooltipProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const closeTimerRef = useRef<number | null>(null)

  function show() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setOpen(true)
  }

  function hide() {
    // 80ms grace — 마우스가 tooltip 안 휙 움직일 때 깜빡임 방지.
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 80)
  }

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onTouchStart={() => setOpen((v) => !v)}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute z-50 pointer-events-none motion-safe:animate-fade-in"
          style={{
            ...(placement === 'top'
              ? { bottom: 'calc(100% + 6px)' }
              : { top: 'calc(100% + 6px)' }),
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth,
            padding: '6px 10px',
            borderRadius: V3Radius.xs,
            background: V3.ink,
            color: V3.paperHi,
            fontSize: 11.5,
            fontWeight: V3FontWeight.medium,
            lineHeight: 1.4,
            letterSpacing: '-0.005em',
            whiteSpace: 'normal',
            wordBreak: 'keep-all',
            textAlign: 'center',
            boxShadow: '0 4px 14px rgba(22,20,15,0.18)',
          }}
        >
          {content}
        </span>
      )}
    </span>
  )
}
