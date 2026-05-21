'use client'

/**
 * DogDetailFAB — 강아지 상세 페이지 우하단 floating + 버튼 (item 55).
 *
 * 핸드오프 패턴:
 *   - 56×56 ink circle + paper plus icon
 *   - 클릭 시 빠른 기록 sheet 트리거 — 식사 / 산책 / 체중 / 메모 4-옵션 popup
 *
 * Sheet 의 실제 옵션 핸들러는 호출자가 onSelect 로 전달.
 */

import { useState } from 'react'
import { Plus, X, Soup, Footprints, Scale, Pencil } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'

export type FabAction = 'meal' | 'walk' | 'weight' | 'memo'

interface DogDetailFABProps {
  /** 옵션 선택 콜백. */
  onSelect: (action: FabAction) => void
  /** TabBar 와 겹치지 않도록 bottom 추가 offset (px). 기본 88. */
  bottomOffset?: number
}

const ACTION_LABEL: Record<FabAction, string> = {
  meal: '식사 기록',
  walk: '산책 기록',
  weight: '체중 기록',
  memo: '메모 추가',
}

const ACTION_ICON: Record<FabAction, typeof Soup> = {
  meal: Soup,
  walk: Footprints,
  weight: Scale,
  memo: Pencil,
}

const ACTIONS: FabAction[] = ['weight', 'meal', 'walk', 'memo']

export default function DogDetailFAB({
  onSelect,
  bottomOffset = 88,
}: DogDetailFABProps) {
  const [open, setOpen] = useState(false)

  function handleSelect(a: FabAction) {
    onSelect(a)
    setOpen(false)
  }

  return (
    <>
      {/* backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40"
          style={{
            background: 'rgba(22,20,15,0.4)',
            transition: 'opacity 200ms',
          }}
          aria-hidden
        />
      )}

      {/* options popup — opens above FAB */}
      {open && (
        <div
          className="fixed z-50 flex flex-col"
          style={{
            right: 20,
            bottom: bottomOffset + 64 + 14,
            gap: 8,
          }}
        >
          {ACTIONS.map((a) => {
            const Icon = ACTION_ICON[a]
            return (
              <button
                key={a}
                onClick={() => handleSelect(a)}
                className="inline-flex items-center transition active:scale-95"
                style={{
                  background: V3.paperHi,
                  color: V3.ink,
                  border: `1px solid ${V3.rule}`,
                  borderRadius: 4,
                  padding: '10px 14px',
                  gap: 10,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: V3FontWeight.bold,
                  fontSize: 13,
                  letterSpacing: '-0.005em',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(22,20,15,0.16)',
                }}
              >
                <Icon size={16} color={V3.accent} strokeWidth={1.8} />
                {ACTION_LABEL[a]}
              </button>
            )
          })}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed z-50 flex items-center justify-center transition active:scale-90"
        style={{
          right: 20,
          bottom: bottomOffset,
          width: 56,
          height: 56,
          borderRadius: 28,
          background: V3.ink,
          color: V3.paperHi,
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 8px 22px rgba(22,20,15,0.32)',
        }}
        aria-label={open ? '메뉴 닫기' : '빠른 기록'}
        aria-expanded={open}
      >
        {open ? (
          <X size={22} color={V3.paperHi} strokeWidth={2.2} />
        ) : (
          <Plus size={26} color={V3.paperHi} strokeWidth={2.2} />
        )}
      </button>
    </>
  )
}
