'use client'

import { useState, useEffect } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import {
  readThemeChoice,
  writeThemeChoice,
  type ThemeChoice,
} from '@/lib/theme'

/**
 * 다크모드 토글 — system / light / dark 3-way segmented control.
 *
 * # 동작
 *  - 'system' (기본): OS prefers-color-scheme 따름
 *  - 'light' / 'dark': 사용자 수동 override (localStorage 에 저장)
 *  - lib/theme 의 readThemeChoice / writeThemeChoice 사용 — html[data-theme]
 *    속성 업데이트 + globals.css 의 CSS variable 자동 swap.
 *
 * # SSR
 * mount 전엔 'system' 으로 표시 — hydration mismatch 회피. 1프레임 후 실제
 * 선택값으로 swap.
 */

const OPTIONS: { key: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { key: 'system', label: '자동', Icon: Monitor },
  { key: 'light', label: '라이트', Icon: Sun },
  { key: 'dark', label: '다크', Icon: Moon },
]

export default function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // SSR / hydration mismatch 회피용 — mount 시 localStorage 에서 읽어와 한 번만 swap.
    // 동시에 DOM 의 data-theme 도 동기화 — 사용자가 dark 선택 후 reload 하면
    // SSR 은 attribute 없이 light 로 그려지는데, mount 시 attribute 를 다시
    // 박아줘야 globals.css 의 dark 변수가 활성화됨.
    const stored = readThemeChoice()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(stored)
    writeThemeChoice(stored)
    setMounted(true)
  }, [])

  function handleChange(next: ThemeChoice) {
    setChoice(next)
    writeThemeChoice(next)
  }

  return (
    <div
      className="rounded-2xl border border-rule bg-white px-5 py-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[12.5px] font-bold text-text">화면 테마</div>
          <div className="text-[10.5px] text-muted mt-0.5">
            기기 설정에 맞추거나 직접 선택
          </div>
        </div>
      </div>
      <div
        className="grid grid-cols-3 gap-px rounded-xl overflow-hidden"
        style={{ background: 'var(--rule)' }}
      >
        {OPTIONS.map(({ key, label, Icon }) => {
          const active = mounted && choice === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleChange(key)}
              className="py-2.5 inline-flex items-center justify-center gap-1.5 text-[11.5px] font-bold transition"
              style={{
                background: active ? 'var(--ink)' : 'white',
                color: active ? 'var(--bg)' : 'var(--text)',
              }}
              aria-pressed={active}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={2} />
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
