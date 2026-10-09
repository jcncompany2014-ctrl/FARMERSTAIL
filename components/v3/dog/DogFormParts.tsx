'use client'

/**
 * DogFormParts — 우리 아이 화면 묶음의 입력·버튼·시트 조각 (2026-10-09 앱 새 디자인 'A 포스터').
 *
 * 강아지 등록(D11)·정보 수정(D13)·건강일지(D06)·의료 기록(D07)·약물 추가(D15)·예방접종 추가(D17)·
 * 리마인더 추가(D19)·체중 기록(D20)·일기 쓰기(D02)가 모두 같은 규칙으로 그린다 — 화면마다 따로 그리면
 * 하나만 고쳐지고 나머지가 옛 모양으로 남는다. 치수는 시안 원본 HTML 값 그대로.
 *
 *  · 이름표 = 16px 굵게(800). 꼭 넣을 칸은 빨간 *, 덧말("(선택)"·"(오늘)")은 회색 600.
 *  · 입력 칸 = 모서리 4 · 1.5px 테두리. 값이 있거나 누르고 있으면 먹선(#141414), 비었으면 옅은 회색(#D5D3D4).
 *  · 고르기 칸 = 안 고른 것 흰 바탕 + 옅은 회색 테두리, 고른 것 먹색 바탕 흰 글자.
 *  · 주 버튼 = 먹색 바탕 흰 글자(높이 58) · 보조 버튼 = 흰 바탕 1.5px 먹선.
 *  · 아래에서 올라오는 창 = 위 모서리 12 · 그래버 40×4 · 바탕 막 rgba(20,20,20,0.42).
 *
 * 저장·검사 로직은 각 화면이 그대로 가진다. 여기는 그리는 것만.
 * 자리표시 글자색·날짜/시간 고르기 단추는 인라인으로 못 주는 가상 요소라 이 조각들 전용 클래스(ft-dogf*)로
 * 준다 — React 19 의 <style href precedence> 라 몇 번 그려도 한 번만 들어간다(globals.css 는 건드리지 않는다).
 */

import {
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { V3, V3Radius } from '@/lib/design/tokens'
import BreedCombobox from '@/components/web/fd/BreedCombobox'
import { CalendarIcon, ChevronDownIcon, ClockIcon, SearchIcon } from './DogIcons'

/** 빈 칸·안 고른 칸 테두리 — 시안의 옅은 회색(그래버와 같은 색). */
export const IDLE_BORDER = '#D5D3D4'
/** 자리표시 글자색(시안). */
export const PLACEHOLDER_INK = '#8A8A8A'
/** 아래에서 올라오는 창·가운데 창 뒤 바탕 막(시안). */
export const SCRIM_BG = 'rgba(20, 20, 20, 0.42)'

const FORM_CSS = `
[data-ft-chrome="app"] .ft-dogf::placeholder { color: ${PLACEHOLDER_INK}; opacity: 1; }
[data-ft-chrome="app"] .ft-dogf-pick::-webkit-calendar-picker-indicator { opacity: 0; cursor: pointer; }
[data-ft-chrome="app"] .ft-dogf-pick[data-empty="true"]::-webkit-datetime-edit { color: ${PLACEHOLDER_INK}; }
`

function FormCss() {
  return (
    <style href="ft-dog-form" precedence="medium">
      {FORM_CSS}
    </style>
  )
}

/** 이름표 — "이름 *" · "변 횟수 (오늘)". */
export function FieldLabel({
  children,
  required,
  hint,
}: {
  children: ReactNode
  required?: boolean
  /** 이름표 뒤 회색 덧말 — "(선택)" · "· 적고 + 를 눌러요". */
  hint?: ReactNode
}) {
  return (
    <span style={{ fontSize: 16, fontWeight: 800, lineHeight: 'normal', color: V3.ink }}>
      {children}
      {required && <span style={{ color: V3.sale }}> *</span>}
      {hint && <span style={{ fontWeight: 600, color: V3.inkMute }}> {hint}</span>}
    </span>
  )
}

/** 이름표가 입력을 감싼다 — 스크린리더가 이름을 읽고, 이름표를 눌러도 입력으로 간다. */
export function Field({
  label,
  required,
  hint,
  help,
  children,
  style,
  asDiv = false,
}: {
  label: ReactNode
  required?: boolean
  hint?: ReactNode
  /** 칸 아래 회색 안내 한 줄(14px). */
  help?: ReactNode
  children: ReactNode
  style?: CSSProperties
  /** 안에 목록(견종 고르기처럼 펼쳐지는 칸)이 있어 label 로 감싸면 안 될 때 — 이름은 입력의 aria-label 이 맡는다. */
  asDiv?: boolean
}) {
  const Root = asDiv ? 'div' : 'label'
  return (
    <Root style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      <FieldLabel required={required} hint={hint}>
        {label}
      </FieldLabel>
      {children}
      {help && <span style={{ fontSize: 14, lineHeight: 1.5, color: V3.inkMute }}>{help}</span>}
    </Root>
  )
}

/** 고르기 묶음 — fieldset + legend(이름표) + 칸 나눈 격자. */
export function ChoiceGroup({
  legend,
  required,
  hint,
  columns,
  gap = 6,
  children,
  style,
  after,
}: {
  legend: ReactNode
  required?: boolean
  hint?: ReactNode
  /** 칸 수 — 없으면 줄바꿈하는 가로 줄(반복 주기처럼 글자 길이가 다른 칩). */
  columns?: number
  gap?: number
  children: ReactNode
  style?: CSSProperties
  /** 칸 아래 안내. */
  after?: ReactNode
}) {
  return (
    <fieldset style={{ margin: 0, padding: 0, border: 0, minWidth: 0, ...style }}>
      <legend style={{ padding: 0, marginBottom: 8, float: 'left', width: '100%' }}>
        <FieldLabel required={required} hint={hint}>
          {legend}
        </FieldLabel>
      </legend>
      <div
        style={
          columns
            ? { clear: 'both', display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap }
            : { clear: 'both', display: 'flex', flexWrap: 'wrap', gap }
        }
      >
        {children}
      </div>
      {after}
    </fieldset>
  )
}

/** 고르기 칸 — 고른 것 = 먹색 바탕 흰 글자. */
export function ChoiceButton({
  active,
  onClick,
  children,
  height = 50,
  fontSize = 16,
  padding = '0 4px',
  ariaLabel,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  height?: number
  fontSize?: number
  padding?: string
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        height,
        padding,
        boxSizing: 'border-box',
        border: active ? 0 : `1.5px solid ${IDLE_BORDER}`,
        borderRadius: V3Radius.sm,
        background: active ? V3.ink : '#FFFFFF',
        color: active ? '#FFFFFF' : V3.ink,
        fontFamily: 'inherit',
        fontSize,
        fontWeight: active ? 800 : 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

type FieldBox = {
  /** 칸 높이 — 시안 52(카드 안) · 54(시트) · 56(등록·수정). */
  height?: number
  fontSize?: number
  /** 좌우 안쪽 여백. */
  padX?: number
  /** 오른쪽 끝 글자(kg·회) 또는 그림. */
  trailing?: ReactNode
  /** 값이 있다고 볼지 — 안 주면 value 로 판단. */
  filled?: boolean
  /** 테두리 두께 — 기본 1.5, 큰 숫자 칸(체중)은 2(시안 D20). */
  borderWidth?: number
}

function borderFor(active: boolean, width = 1.5): string {
  return `${width}px solid ${active ? V3.ink : IDLE_BORDER}`
}

function Trailing({ padX, children }: { padX: number; children: ReactNode }) {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        right: padX,
        top: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        pointerEvents: 'none',
        color: V3.inkMute,
      }}
    >
      {children}
    </span>
  )
}

/** 오른쪽 끝 단위 글자 — "kg"·"회". */
export function UnitText({ children, size = 15, weight = 700 }: { children: ReactNode; size?: number; weight?: number }) {
  return <span style={{ fontSize: size, fontWeight: weight, color: V3.inkMute }}>{children}</span>
}

/** 한 줄 입력 칸. */
export function TextField({
  height = 52,
  fontSize = 17,
  padX = 14,
  trailing,
  filled,
  borderWidth,
  style,
  className,
  onFocus,
  onBlur,
  ...rest
}: FieldBox & Omit<InputHTMLAttributes<HTMLInputElement>, 'height'>) {
  const [focus, setFocus] = useState(false)
  const hasValue = filled ?? (rest.value != null && String(rest.value) !== '')
  return (
    <span style={{ position: 'relative', display: 'block', width: '100%' }}>
      <FormCss />
      <input
        {...rest}
        className={className ? `ft-dogf ${className}` : 'ft-dogf'}
        onFocus={(e) => {
          setFocus(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocus(false)
          onBlur?.(e)
        }}
        style={{
          display: 'block',
          width: '100%',
          height,
          boxSizing: 'border-box',
          padding: `0 ${trailing ? padX + 30 : padX}px 0 ${padX}px`,
          border: borderFor(focus || hasValue, borderWidth),
          borderRadius: V3Radius.sm,
          background: '#FFFFFF',
          color: V3.ink,
          fontFamily: 'inherit',
          fontSize,
          outline: 'none',
          boxShadow: 'none',
          appearance: 'none',
          WebkitAppearance: 'none',
          ...style,
        }}
      />
      {trailing && <Trailing padX={padX}>{trailing}</Trailing>}
    </span>
  )
}

/** 여러 줄 입력 칸. */
export function TextArea({
  minHeight = 88,
  fontSize = 17,
  style,
  className,
  onFocus,
  onBlur,
  ...rest
}: { minHeight?: number; fontSize?: number } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [focus, setFocus] = useState(false)
  const hasValue = rest.value != null && String(rest.value) !== ''
  return (
    <>
      <FormCss />
      <textarea
        {...rest}
        className={className ? `ft-dogf ${className}` : 'ft-dogf'}
        onFocus={(e) => {
          setFocus(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocus(false)
          onBlur?.(e)
        }}
        style={{
          display: 'block',
          width: '100%',
          minHeight,
          boxSizing: 'border-box',
          padding: '12px 14px',
          border: borderFor(focus || hasValue),
          borderRadius: V3Radius.sm,
          background: '#FFFFFF',
          color: V3.ink,
          fontFamily: 'inherit',
          fontSize,
          lineHeight: 1.5,
          outline: 'none',
          boxShadow: 'none',
          resize: 'none',
          ...style,
        }}
      />
    </>
  )
}

/** 고르기 목록(native select) — 휴대폰 고르기 창이 그대로 뜬다. 오른쪽 꺾쇠는 그림. */
export function SelectField({
  height = 54,
  fontSize = 17,
  padX = 14,
  options,
  children,
  style,
  onFocus,
  onBlur,
  ...rest
}: {
  height?: number
  fontSize?: number
  padX?: number
  options?: ReadonlyArray<{ value: string; label: string }>
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const [focus, setFocus] = useState(false)
  const hasValue = rest.value != null && String(rest.value) !== ''
  return (
    <span style={{ position: 'relative', display: 'block', width: '100%' }}>
      <select
        {...rest}
        onFocus={(e) => {
          setFocus(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocus(false)
          onBlur?.(e)
        }}
        style={{
          display: 'block',
          width: '100%',
          height,
          boxSizing: 'border-box',
          padding: `0 ${padX + 28}px 0 ${padX}px`,
          border: borderFor(focus || hasValue),
          borderRadius: V3Radius.sm,
          background: '#FFFFFF',
          color: hasValue ? V3.ink : PLACEHOLDER_INK,
          fontFamily: 'inherit',
          fontSize,
          outline: 'none',
          boxShadow: 'none',
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          cursor: 'pointer',
          ...style,
        }}
      >
        {children ??
          options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
      </select>
      <Trailing padX={padX}>
        <ChevronDownIcon size={18} color={V3.ink} />
      </Trailing>
    </span>
  )
}

/**
 * 날짜·시간 칸(native) — 휴대폰 고르기 창이 그대로 뜬다. 오른쪽 그림은 장식이고, 원래 고르기 단추는
 * 투명하게 그 자리에 남아 컴퓨터에서도 눌린다.
 */
export function PickerField({
  kind = 'date',
  height = 52,
  fontSize = 17,
  padX = 14,
  iconColor = V3.inkMute,
  style,
  className,
  onFocus,
  onBlur,
  ...rest
}: {
  kind?: 'date' | 'time'
  height?: number
  fontSize?: number
  padX?: number
  iconColor?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'height'>) {
  const [focus, setFocus] = useState(false)
  const hasValue = rest.value != null && String(rest.value) !== ''
  return (
    <span style={{ position: 'relative', display: 'block', width: '100%' }}>
      <FormCss />
      <input
        {...rest}
        type={kind}
        data-empty={hasValue ? undefined : 'true'}
        className={className ? `ft-dogf ft-dogf-pick ${className}` : 'ft-dogf ft-dogf-pick'}
        onFocus={(e) => {
          setFocus(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocus(false)
          onBlur?.(e)
        }}
        style={{
          display: 'block',
          width: '100%',
          height,
          boxSizing: 'border-box',
          padding: `0 ${padX}px`,
          border: borderFor(focus || hasValue),
          borderRadius: V3Radius.sm,
          background: '#FFFFFF',
          color: V3.ink,
          fontFamily: 'inherit',
          fontSize,
          outline: 'none',
          boxShadow: 'none',
          appearance: 'none',
          WebkitAppearance: 'none',
          textAlign: 'left',
          ...style,
        }}
      />
      <Trailing padX={padX}>
        {kind === 'time' ? <ClockIcon size={19} color={iconColor} /> : <CalendarIcon size={20} color={iconColor} />}
      </Trailing>
    </span>
  )
}

/**
 * 견종 칸 — 웹·앱이 같이 쓰는 자동완성(components/web/fd/BreedCombobox, tone='app')에 이 화면들의 칸 모양을
 * 입힌다(그 부품은 고치지 않는다). 오른쪽 돋보기는 장식. 누르고 있는지는 감싼 칸에서 focus 를 받아 안다.
 */
export function BreedField({
  value,
  onChange,
  placeholder,
  enterKeyHint,
  height = 56,
  fontSize = 17,
  padX = 16,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  enterKeyHint?: InputHTMLAttributes<HTMLInputElement>['enterKeyHint']
  height?: number
  fontSize?: number
  padX?: number
}) {
  const [focus, setFocus] = useState(false)
  const hasValue = value.trim() !== ''
  return (
    <span
      style={{ position: 'relative', display: 'block' }}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
    >
      <FormCss />
      <BreedCombobox
        tone="app"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        ariaLabel="견종"
        enterKeyHint={enterKeyHint}
        inputClassName="ft-dogf"
        inputStyle={{
          display: 'block',
          width: '100%',
          height,
          boxSizing: 'border-box',
          padding: `0 ${padX + 30}px 0 ${padX}px`,
          border: borderFor(focus || hasValue),
          borderRadius: V3Radius.sm,
          background: '#FFFFFF',
          color: V3.ink,
          fontFamily: 'inherit',
          fontSize,
          outline: 'none',
          boxShadow: 'none',
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          right: padX,
          top: 0,
          height,
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        <SearchIcon size={20} color={V3.inkMute} />
      </span>
    </span>
  )
}

/** 주 버튼 모양 — button·Link 어디든 style 로 입힌다. */
export function primaryButtonStyle(height = 58, disabled = false): CSSProperties {
  return {
    width: '100%',
    height,
    boxSizing: 'border-box',
    border: 0,
    borderRadius: V3Radius.sm,
    background: disabled ? V3.inkMute : V3.ink,
    color: '#FFFFFF',
    fontFamily: 'inherit',
    fontSize: 17,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    textDecoration: 'none',
    cursor: disabled ? 'default' : 'pointer',
  }
}

/** 보조 버튼 모양 — 흰 바탕 1.5px 먹선. */
export function secondaryButtonStyle(height = 54, fontSize = 16): CSSProperties {
  return {
    width: '100%',
    height,
    boxSizing: 'border-box',
    border: `1.5px solid ${V3.ink}`,
    borderRadius: V3Radius.sm,
    background: '#FFFFFF',
    color: V3.ink,
    fontFamily: 'inherit',
    fontSize,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    textDecoration: 'none',
    cursor: 'pointer',
  }
}

/** 창 위 손잡이(그래버) — 40×4. */
export function Grabber() {
  return (
    <span
      aria-hidden
      style={{ alignSelf: 'center', flexShrink: 0, width: 40, height: 4, borderRadius: 2, background: IDLE_BORDER }}
    />
  )
}

/** 아래에서 올라오는 창 뒤 바탕 막 — 화면 전체, 창은 아래에 붙는다. */
export const SHEET_SCRIM: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  background: SCRIM_BG,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
}

/** 아래에서 올라오는 창 몸통(시안: 위 10 · 좌우 20 · 아래 28 · 위 모서리 12). */
export const SHEET_PANEL: CSSProperties = {
  width: '100%',
  maxWidth: 448,
  maxHeight: '90vh',
  overflowY: 'auto',
  boxSizing: 'border-box',
  padding: '10px 20px calc(28px + env(safe-area-inset-bottom))',
  background: '#FFFFFF',
  color: V3.ink,
  borderRadius: '12px 12px 0 0',
  boxShadow: '0 -8px 30px rgba(20, 20, 20, 0.12)',
  display: 'flex',
  flexDirection: 'column',
  outline: 'none',
}

/** 가운데 뜨는 확인 창 뒤 바탕 막. */
export const CENTER_SCRIM: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  background: SCRIM_BG,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 24px',
}

/** 가운데 뜨는 확인 창 몸통(시안 D21: 위 26 · 좌우 20 · 아래 20 · 모서리 12). */
export const CENTER_PANEL: CSSProperties = {
  width: '100%',
  maxWidth: 400,
  boxSizing: 'border-box',
  padding: '26px 20px 20px',
  background: '#FFFFFF',
  color: V3.ink,
  borderRadius: 12,
  boxShadow: '0 12px 40px rgba(20, 20, 20, 0.18)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  outline: 'none',
}

/** 섹션 제목(제목 글꼴 24) + 아래 먹선 목록 — "최근 30일 기록"·"다가오는 일정". h2 는 앱 틀이 제목 글꼴을 준다. */
export function SectionTitle({ children, color, style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return <h2 style={{ margin: '0 0 10px', fontSize: 24, lineHeight: 1.2, color: color ?? V3.ink, ...style }}>{children}</h2>
}

/** 저장 실패 문구 — 버튼 바로 위(시트 안에서는 토스트가 가려지는 곳이 있어 인라인으로). */
export function FormError({ msg, style }: { msg: string | null | undefined; style?: CSSProperties }) {
  if (!msg) return null
  return (
    <p role="alert" style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.45, color: V3.sale, ...style }}>
      {msg}
    </p>
  )
}
