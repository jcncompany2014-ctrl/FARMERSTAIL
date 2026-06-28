'use client'

// 견종 자동완성 콤보박스 (FD 웹 톤).
//
// 사장님 지시(2026-06-16): 드롭다운 스크롤 대신 "타이핑하면 자동완성".
// BREED_NAMES(lib/breeds/breed-names) 를 부분일치로 필터해 제안. 목록에 없는
// 견종은 그냥 입력해도 됨(자유 텍스트 — 믹스/희귀견 대응). 값은 선택/입력한
// 한글 라벨 그대로(영양 findBreedByLabel 와 정합).

import { useEffect, useMemo, useRef, useState } from 'react'
import { BREED_NAMES } from '@/lib/breeds/breed-names'

type Props = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputClassName?: string
  inputStyle?: React.CSSProperties
  /** 입력 후 다음 필드로 이동 힌트 */
  enterKeyHint?: React.InputHTMLAttributes<HTMLInputElement>['enterKeyHint']
  /** 스크린리더용 접근명 — 콤보박스는 이름 필수(placeholder 만으론 부족). */
  ariaLabel?: string
}

const MAX_SUGGESTIONS = 8

export default function BreedCombobox({
  value,
  onChange,
  placeholder,
  inputClassName,
  inputStyle,
  enterKeyHint,
  ariaLabel = '견종',
}: Props) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return BREED_NAMES.slice(0, MAX_SUGGESTIONS)
    // 정확 일치(이미 선택됨)면 제안 숨김.
    if (BREED_NAMES.some((b) => b.toLowerCase() === q && b === value)) return []
    const starts: string[] = []
    const contains: string[] = []
    for (const b of BREED_NAMES) {
      const l = b.toLowerCase()
      if (l.startsWith(q)) starts.push(b)
      else if (l.includes(q)) contains.push(b)
    }
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS)
  }, [value])

  // 바깥 클릭 시 닫기.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function pick(b: string) {
    onChange(b)
    setOpen(false)
    setHi(0)
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint={enterKeyHint}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="breed-listbox"
        aria-activedescendant={open && matches.length > 0 && hi >= 0 ? `breed-option-${hi}` : undefined}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setHi(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!open) {
              setOpen(true)
              return
            }
            setHi((h) => Math.min(h + 1, matches.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHi((h) => Math.max(h - 1, 0))
          } else if (e.key === 'Enter') {
            if (open && matches[hi]) {
              e.preventDefault()
              pick(matches[hi]!)
            }
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        className={inputClassName}
        style={inputStyle}
      />
      {open && matches.length > 0 && (
        <ul
          id="breed-listbox"
          role="listbox"
          style={{
            position: 'absolute',
            zIndex: 30,
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#FFFFFF',
            border: '1px solid var(--fd-line)',
            borderRadius: 12,
            boxShadow: '0 14px 36px -14px rgba(23,59,51,0.28)',
            maxHeight: 280,
            overflowY: 'auto',
            listStyle: 'none',
            margin: 0,
            padding: 4,
          }}
        >
          {matches.map((b, i) => (
            <li
              key={b}
              id={`breed-option-${i}`}
              role="option"
              aria-selected={i === hi}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(b)
              }}
              onMouseEnter={() => setHi(i)}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 14,
                cursor: 'pointer',
                color: 'var(--fd-pine)',
                background: i === hi ? 'var(--fd-offwhite)' : 'transparent',
                fontWeight: i === hi ? 700 : 500,
                // 키보드 탐색 시 하이라이트 항목 포커스 표시(배경색만으론 색약 사용자 부족).
                outline: i === hi ? '2px solid var(--fd-coral)' : 'none',
                outlineOffset: -2,
              }}
            >
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
