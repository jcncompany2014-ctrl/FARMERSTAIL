'use client'

/**
 * Dropdown — v3 kebab action menu.
 *
 * **앱 컨텍스트 전용.** 카드/리스트 아이템의 우측 ⋯ 버튼에서 펼쳐지는 작은
 * 액션 메뉴. native HTML5 popover 또는 outside-click hook 으로 외부 클릭 닫힘.
 *
 * # API
 *
 *   <Dropdown
 *     trigger={<MoreVertical size={16} />}
 *     items={[
 *       { label: '수정', onSelect: () => router.push('/edit') },
 *       { label: '삭제', onSelect: handleDelete, tone: 'danger' },
 *     ]}
 *   />
 *
 * # 디자인
 *
 *  - trigger: 28×28 ghost button (paperHi hover)
 *  - menu: paperHi + 1px rule + radius 4 + 8px elevation
 *  - 아이템: 13px ink, hover paperDeep, danger tone = sale red
 *  - separator: 1px ruleSoft
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { V3, V3FontWeight, V3Radius } from '@/lib/design/tokens'

export interface DropdownItem {
  label: string
  onSelect: () => void
  icon?: ReactNode
  /** danger = sale red. accent = clay red. default = ink. */
  tone?: 'default' | 'accent' | 'danger'
  disabled?: boolean
}

interface DropdownProps {
  trigger: ReactNode
  items: (DropdownItem | 'separator')[]
  /** 메뉴 정렬 — start (left) / end (right, default). */
  align?: 'start' | 'end'
  /** trigger 버튼 aria-label. */
  ariaLabel?: string
}

const TONE_COLOR: Record<NonNullable<DropdownItem['tone']>, string> = {
  default: V3.ink,
  accent: V3.accent,
  danger: V3.sale,
}

export default function Dropdown({
  trigger,
  items,
  align = 'end',
  ariaLabel = '더보기',
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // outside click 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // ESC 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const handleSelect = useCallback((item: DropdownItem) => {
    if (item.disabled) return
    item.onSelect()
    setOpen(false)
  }, [])

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center transition"
        style={{
          width: 28,
          height: 28,
          borderRadius: V3Radius.xs,
          background: open ? V3.paperDeep : 'transparent',
          border: 'none',
          color: V3.inkMute,
          cursor: 'pointer',
        }}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            [align === 'end' ? 'right' : 'left']: 0,
            minWidth: 144,
            background: V3.paperHi,
            border: `1px solid ${V3.rule}`,
            borderRadius: V3Radius.sm,
            boxShadow: '0 8px 24px -6px rgba(22,20,15,0.16)',
            zIndex: 60,
            overflow: 'hidden',
            padding: '4px 0',
          }}
        >
          {items.map((item, i) => {
            if (item === 'separator') {
              return (
                <div
                  key={`sep-${i}`}
                  aria-hidden
                  style={{
                    height: 1,
                    background: V3.ruleSoft,
                    margin: '4px 0',
                  }}
                />
              )
            }
            const color = TONE_COLOR[item.tone ?? 'default']
            return (
              <button
                key={item.label}
                role="menuitem"
                type="button"
                onClick={() => handleSelect(item)}
                disabled={item.disabled}
                className="w-full text-left transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  padding: '8px 14px',
                  fontSize: 13,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: V3FontWeight.medium,
                  color,
                  background: 'transparent',
                  border: 'none',
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  letterSpacing: '-0.01em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  if (!item.disabled)
                    e.currentTarget.style.background = V3.paperDeep
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {item.icon}
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
