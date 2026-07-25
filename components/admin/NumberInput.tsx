'use client'

import { useState } from 'react'
import { displayValue, parseTyped } from '@/lib/number-field'

/**
 * 어드민 숫자 입력 (2026-07-26 사장님 제보 — "20 지우고 150 넣으려는데
 * 앞에 늘 0이 붙고, 그 0은 지워지지도 않아").
 *
 * # 무슨 버그였나
 * 지금까지 admin 숫자 칸은 전부 이 패턴이었다:
 *
 *   value={form.stock}
 *   onChange={(e) => update('stock', Number(e.target.value))}
 *
 * 칸을 다 지우면 `e.target.value` 는 빈 문자열이고 **`Number('')` 는 0** 이다.
 * 그래서 state 가 0 이 되고 화면은 즉시 "0" 을 다시 그린다 —
 * **칸이 빌 수가 없으니 그 0 을 지울 방법이 없다.** 그 상태로 150 을 치면
 * "0150" 이 된다. 사장님이 겪으신 게 정확히 이것.
 *
 * # 어떻게 고쳤나
 * 타이핑하는 동안에는 **화면에 보이는 글자(raw)를 이 컴포넌트가 직접 들고**
 * 있는다. 그래서 빈 칸 상태가 유지된다. 포커스가 빠지면 raw 를 버리고 다시
 * 바깥 값을 따른다(폼 리셋·외부 변경이 정상 반영됨).
 *
 * effect 로 동기화하지 않은 이유: 이 리포는 `react-hooks/set-state-in-effect`
 * 를 금지한다. raw 를 `null`(바깥 값 사용) / 문자열(편집 중) 두 상태로 두면
 * effect 없이 같은 결과가 나온다.
 *
 * # 덤 — 휠 스크롤 방어
 * 숫자 칸 위에서 마우스 휠을 굴리면 값이 멋대로 바뀌는 브라우저 기본 동작도
 * 막는다. 고객 화면은 커밋 53b70af 에서 이미 막았는데 admin 은 빠져 있었다.
 *
 * # 쓰는 법
 *   <NumberInput value={form.stock} onChange={(v) => update('stock', v ?? 0)}
 *                emptyAs={0} min={0} className={inputClass} />
 * 필수 항목이면 `emptyAs={0}`, 비워도 되는 항목이면 `emptyAs={null}`(기본값).
 */
export default function NumberInput({
  value,
  onChange,
  emptyAs = null,
  className = '',
  min,
  max,
  step,
  placeholder,
  disabled,
  id,
  autoFocus,
  style,
  onBlur,
  onKeyDown,
  'aria-label': ariaLabel,
}: {
  value: number | null | undefined
  onChange: (v: number | null) => void
  /** 칸을 비웠을 때 바깥으로 보낼 값. 필수 항목이면 0, 선택 항목이면 null. */
  emptyAs?: number | null
  className?: string
  min?: number
  max?: number
  step?: number | string
  placeholder?: string
  disabled?: boolean
  id?: string
  autoFocus?: boolean
  style?: React.CSSProperties
  /** 편집 종료 시 저장 등. 내부 raw 초기화는 이 컴포넌트가 먼저 처리한다. */
  onBlur?: () => void
  /** Enter 로 저장 · Esc 로 취소 같은 인라인 편집용. */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  'aria-label'?: string
}) {
  // null = 편집 중 아님(바깥 값 표시) / 문자열 = 사용자가 지금 치고 있는 글자
  const [raw, setRaw] = useState<string | null>(null)
  // 표시값·파싱 규칙은 lib/number-field.ts 에 순수 함수로 있고 테스트로 고정돼 있다.
  const shown = displayValue(raw, value)

  return (
    <input
      type="number"
      inputMode="decimal"
      id={id}
      value={shown}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
      style={style}
      autoFocus={autoFocus}
      onKeyDown={onKeyDown}
      onWheel={(e) => e.currentTarget.blur()}
      onChange={(e) => {
        const text = e.target.value
        setRaw(text)
        const next = parseTyped(text, emptyAs)
        // undefined = '-' · 'abc' 처럼 아직 숫자가 아닌 입력 도중 상태.
        // 바깥 값을 건드리지 않고 화면(raw)만 유지한다 — 마저 치면 숫자가 된다.
        if (next !== undefined) onChange(next)
      }}
      onBlur={() => {
        // raw 를 먼저 버려야(=바깥 값 표시로 복귀) 저장 로직이 화면과 일치한다.
        setRaw(null)
        onBlur?.()
      }}
    />
  )
}
