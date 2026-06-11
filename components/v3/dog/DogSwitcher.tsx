'use client'

/**
 * DogSwitcher — 다견 가구 dashboard switch (item 87).
 *
 * 핸드오프 패턴:
 *   - 작은 strip — 각 강아지 32px circle thumb + active 표시
 *   - 클릭 시 onSwitch(id) — 호출자가 active dog 변경 + 홈 reflow
 *
 * Greeting 우상단 Signature 아래에 두는 작은 row.
 */

import Image from 'next/image'
import { Plus, PawPrint as DogIcon } from 'lucide-react'
import { V3 } from '@/lib/design/tokens'

export interface SwitcherDog {
  id: string
  name: string
  photoUrl?: string | null
  toneBg?: string
}

interface DogSwitcherProps {
  dogs: SwitcherDog[]
  /** 현재 active 강아지 id. */
  activeId: string | null
  /** active 변경 콜백. */
  onSwitch: (id: string) => void
  /** "아이 추가" 액션. */
  onAdd?: () => void
}

export default function DogSwitcher({
  dogs,
  activeId,
  onSwitch,
  onAdd,
}: DogSwitcherProps) {
  if (dogs.length <= 1 && !onAdd) return null

  return (
    <div
      className="flex items-center"
      style={{ gap: 8, padding: '0 20px 14px' }}
    >
      {dogs.map((d) => {
        const active = d.id === activeId
        return (
          <button
            key={d.id}
            onClick={() => onSwitch(d.id)}
            className="relative shrink-0 overflow-hidden transition active:scale-90"
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: d.toneBg ?? '#d6c9aa',
              border: active
                ? `2px solid ${V3.ink}`
                : `1px solid ${V3.rule}`,
              padding: 0,
              cursor: 'pointer',
            }}
            aria-label={`${d.name} 으로 전환`}
            aria-pressed={active}
          >
            {d.photoUrl ? (
              <Image
                src={d.photoUrl}
                alt={d.name}
                fill
                sizes="36px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <DogIcon size={18} color={V3.inkMute} strokeWidth={1.4} />
              </div>
            )}
            {active && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  bottom: -4,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 8,
                  height: 2,
                  background: V3.accent,
                }}
              />
            )}
          </button>
        )
      })}
      {onAdd && (
        <button
          onClick={onAdd}
          className="shrink-0 flex items-center justify-center transition active:scale-90"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'transparent',
            border: `1.5px dashed ${V3.rule}`,
            cursor: 'pointer',
          }}
          aria-label="강아지 추가"
        >
          <Plus size={16} color={V3.ink} strokeWidth={1.8} />
        </button>
      )}
    </div>
  )
}
