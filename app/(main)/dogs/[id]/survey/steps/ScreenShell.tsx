// 설문 v4 공용 조각 (2026-09-22, 시니어 사용성 3단계 — 화면당 질문 하나).
// 2026-10-09 앱 새 디자인('A 포스터') — 설문 새 틀(캔버스 '설문 (새 틀)' E01~E17 · F22~F32). 치수는 시안 원본 HTML 그대로.
//
// 모든 화면이 같은 뼈대를 쓴다: 머리말("질문 3 / 11 · 몸 상태") → 큰 질문(h1) → 한 줄 설명 → 보기.
// 보기 모양은 결정 문서(앱시안_결정할것 1번 '설문 (새 틀)')대로 네 가지다:
//   · 짧은 보기 = 선택 막대(Segmented)  · 긴 보기 = 큰 칸(OptionList)
//   · 설명 있는 보기 = 줄 목록(LineList) · 재료 = 칩(Chips)
//   몸 상태(갈비뼈·허리·배)·지금 먹는 밥은 AI 사진 칸(PhotoGrid · PhotoRows).
// 둘째 줄 보조 질문(살 잘 찌는 편·사료 바꿀 때 무른 변 등)은 지우지 않고 옅은 초록 머리띠(LabelBar) 아래에 둔다
// (사장님 9/21 "지우지 말고 다른 화면에 두 번째 줄로").
// 칩을 재료에만 쓰는 이유(9/22): 칩은 줄바꿈되면 어르신이 "어디까지가 한 묶음인지" 못 읽는다 — 그래서 짧은 보기는
// 줄바꿈이 없는 한 줄 선택 막대, 긴 보기는 세로 큰 칸이고, 칩은 재료처럼 여러 개 고르는 보기에만 남긴다.
// 여기는 그리는 것만 — 답 키·값·저장·검증은 각 화면과 lib/survey/flow 가 그대로 가진다.
import { createContext, Fragment, useContext, type CSSProperties, type ReactNode } from 'react'

/**
 * 머리말의 앞부분("질문 3 / 11")과 정확도 올리기 여부 — SurveyClient 가 화면마다 넣어 준다.
 * 화면 컴포넌트는 자기 주제("몸 상태")만 알면 된다.
 */
export const SurveyScreenContext = createContext<{ counter: string; refine: boolean }>({
  counter: '',
  refine: false,
})

export function ScreenShell({
  kicker,
  title,
  sub,
  optional,
  children,
}: {
  /** 머리말 뒤쪽 — 주제("몸 상태") 또는 "선택"(추가 질문). */
  kicker: string
  title: ReactNode
  sub?: ReactNode
  /** 추가 질문(관문 뒤 선택 묶음) — 정확도 올리기 때 머리말 앞에 "정확도 올리기"(시안 L19). */
  optional?: boolean
  children?: ReactNode
}) {
  const { counter, refine } = useContext(SurveyScreenContext)
  const head = [refine && optional ? '정확도 올리기' : '', counter, kicker].filter(Boolean).join(' · ')
  return (
    <div className="s-page">
      <span className="s-kicker">{head}</span>
      <h1 className="s-title">{title}</h1>
      {sub && <p className="s-sub">{sub}</p>}
      {children}
    </div>
  )
}

/** 시안의 체크 표시(흰 굵은 V). */
export function CheckIcon({ size = 13, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={3.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

/** 고른 칸 오른쪽 위 먹색 동그라미 체크(시안 E01·E02·E03·E05·E06). */
function CheckBadge({ size, inset }: { size: number; inset: number }) {
  return (
    <span className="s-badge" style={{ width: size, height: size, top: inset, right: inset }} aria-hidden="true">
      <CheckIcon />
    </span>
  )
}

/** 줄 오른쪽 동그라미 — 고르면 먹색 체크, 안 고르면 빈 테두리(시안 E07·E08·E12). */
function CheckCircle({ on }: { on: boolean }) {
  return on ? (
    <span className="s-circle s-circle-on" aria-hidden="true">
      <CheckIcon />
    </span>
  ) : (
    <span className="s-circle" aria-hidden="true" />
  )
}

/** '\n' 을 줄바꿈으로 — 시안이 정해 둔 자리에서 끊는다(칸이 좁은 사진 보기). */
function Lines({ text }: { text: string }) {
  const parts = text.split('\n')
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {p}
        </Fragment>
      ))}
    </>
  )
}

export type OptionItem<V extends string | number> = {
  v: V
  label: string
  sub?: string
}

/**
 * 큰 칸 — 세로로 쌓인 높이 60 칸, 오른쪽 동그라미(시안 E07 간식 · E15 산책 · E16 운동).
 * `allowClear` 면 고른 것을 다시 눌러 풀 수 있다(선택 질문용).
 */
export function OptionList<V extends string | number>({
  options,
  value,
  onChange,
  allowClear = false,
  ariaLabel,
  style,
}: {
  options: ReadonlyArray<OptionItem<V>>
  value: V | null | ''
  onChange: (v: V | null) => void
  allowClear?: boolean
  ariaLabel?: string
  style?: CSSProperties
}) {
  return (
    <div className="s-optlist" role="group" aria-label={ariaLabel} style={style}>
      {options.map((o) => {
        const active = value === o.v
        return (
          <button
            key={String(o.v)}
            type="button"
            className="s-optbtn"
            aria-pressed={active}
            onClick={() => onChange(active && allowClear ? null : o.v)}
          >
            <span className="s-optbtn-lb">{o.label}</span>
            <CheckCircle on={active} />
          </button>
        )
      })}
    </div>
  )
}

/**
 * 줄 목록 — 칸 없이 줄로 나뉜 보기, 이름 + 회색 설명 한 줄(시안 E08 화식 경험 · E12 케어 목표 · F25 체중 잰 방법).
 */
export function LineList<V extends string>({
  options,
  value,
  onChange,
  allowClear = false,
  ariaLabel,
  style,
}: {
  options: ReadonlyArray<OptionItem<V>>
  value: V | ''
  onChange: (v: V | '') => void
  allowClear?: boolean
  ariaLabel?: string
  style?: CSSProperties
}) {
  return (
    <div className="s-lines" role="group" aria-label={ariaLabel} style={style}>
      {options.map((o, i) => {
        const active = value === o.v
        return (
          <Fragment key={o.v}>
            {i > 0 && <span className="s-line-sep" aria-hidden="true" />}
            <button
              type="button"
              className="s-line"
              aria-pressed={active}
              onClick={() => onChange(active && allowClear ? '' : o.v)}
            >
              <span className="s-line-body">
                <span className="s-line-lb">{o.label}</span>
                {o.sub && <span className="s-line-sub">{o.sub}</span>}
              </span>
              <CheckCircle on={active} />
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}

/**
 * 선택 막대 — 회색 홈 안에 칸을 똑같이 나눈 짧은 보기, 고른 칸 = 흰 바탕(시안 E04·E05·E09·E10·E11·F23).
 * 네 칸이면 글자를 한 단계 작게(시안 15.5). `allowClear` 면 고른 칸을 다시 눌러 비울 수 있다
 * ("모르면 비워 두세요" 질문 — 예전 칩과 같은 동작).
 */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
  allowClear = false,
  ariaLabel,
  style,
}: {
  options: ReadonlyArray<{ v: V; label: string }>
  value: V | ''
  onChange: (v: V | '') => void
  allowClear?: boolean
  ariaLabel?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={'s-seg' + (options.length >= 4 ? ' s-seg-sm' : '')}
      role="group"
      aria-label={ariaLabel}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, ...style }}
    >
      {options.map((o) => {
        const active = value === o.v
        return (
          <button
            key={o.v}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active && allowClear ? '' : o.v)}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * 사진 칸 격자 — 갈비뼈(2×2, 사진 높이 98) · 허리(3열, 사진 높이 188). 사진은 칸 비율로 잘라 둔
 * public/survey/ai/* (회색 바탕이 사진과 같은 색이라 남는 틈이 티 나지 않는다).
 */
export function PhotoGrid<V extends string>({
  options,
  value,
  onChange,
  columns,
  gap,
  photoHeight,
  center = false,
  badge,
  ariaLabel,
}: {
  options: ReadonlyArray<{ v: V; label: string; img: string }>
  value: V | ''
  onChange: (v: V) => void
  columns: number
  gap: number
  photoHeight: number
  /** 이름을 가운데로(허리 3열). */
  center?: boolean
  /** 체크 동그라미 크기·안쪽 여백. */
  badge: { size: number; inset: number }
  ariaLabel?: string
}) {
  return (
    <div
      className="s-photogrid"
      role="group"
      aria-label={ariaLabel}
      data-center={center ? 'true' : undefined}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap }}
    >
      {options.map((o) => {
        const active = value === o.v
        return (
          <button
            key={o.v}
            type="button"
            className="s-photo-opt"
            aria-pressed={active}
            onClick={() => onChange(o.v)}
          >
            <span className="s-photo" style={{ height: photoHeight }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- 칸 크기의 2배로 미리 줄인 작은 사진(4~5KB). 늦게 뜨면 안 돼서 lazy 없이 */}
              <img src={o.img} alt="" />
            </span>
            <span className="s-photo-lb">
              <Lines text={o.label} />
            </span>
            {active && <CheckBadge size={badge.size} inset={badge.inset} />}
          </button>
        )
      })}
    </div>
  )
}

/**
 * 사진 줄 — 왼쪽 사진 + 이름(시안 E03 배: 사진 104×60 · E06 지금 먹는 밥: 그릇 사진 84×72 + 회색 설명).
 */
export function PhotoRows<V extends string>({
  options,
  value,
  onChange,
  kind,
  ariaLabel,
}: {
  options: ReadonlyArray<{ v: V; label: string; sub?: string; img: string }>
  value: V | ''
  onChange: (v: V) => void
  kind: 'body' | 'food'
  ariaLabel?: string
}) {
  return (
    <div className="s-photorows" role="group" aria-label={ariaLabel} data-kind={kind}>
      {options.map((o) => {
        const active = value === o.v
        return (
          <button
            key={o.v}
            type="button"
            className="s-photorow"
            aria-pressed={active}
            onClick={() => onChange(o.v)}
          >
            <span className="s-rowimg">
              {/* eslint-disable-next-line @next/next/no-img-element -- 칸 크기의 2배로 미리 줄인 작은 사진(2~5KB). 늦게 뜨면 안 돼서 lazy 없이 */}
              <img src={o.img} alt="" />
              {active && <CheckBadge size={20} inset={4} />}
            </span>
            {o.sub ? (
              <span className="s-photorow-text">
                <span className="s-photorow-title">{o.label}</span>
                <span className="s-photorow-sub">{o.sub}</span>
              </span>
            ) : (
              <span className="s-photorow-lb">{o.label}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * 칩 — 재료·질환·잘 먹는 고기처럼 여러 개 고르는 보기(시안 E09·F22·F23). 고른 칩 = 먹색 + 체크.
 * disabled = 알레르기로 고른 고기라 고를 수 없음(옅게 + 가운데 줄).
 */
export function Chips({
  options,
  isOn,
  onToggle,
  ariaLabel,
  style,
}: {
  options: ReadonlyArray<{ v: string; label: string; disabled?: boolean }>
  isOn: (v: string) => boolean
  onToggle: (v: string) => void
  ariaLabel?: string
  style?: CSSProperties
}) {
  return (
    <div className="s-chips" role="group" aria-label={ariaLabel} style={style}>
      {options.map((o) => {
        const active = !o.disabled && isOn(o.v)
        return (
          <button
            key={o.v}
            type="button"
            className="s-chip"
            aria-pressed={active}
            disabled={o.disabled}
            onClick={() => onToggle(o.v)}
          >
            {active && <CheckIcon size={12} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** 둘째 줄 질문 머리띠 — 옅은 초록 띠 + 점(시안 LabelBar). optional 이면 뒤에 "(선택)". */
export function LabelBar({
  children,
  optional = false,
  style,
}: {
  children: ReactNode
  optional?: boolean
  style?: CSSProperties
}) {
  return (
    <div className="s-lbar" style={style}>
      <span>
        {children}
        {optional ? ' (선택)' : ''}
      </span>
    </div>
  )
}

/** 회색 도움말 한 줄(머리띠 아래). */
export function Help({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <p className="s-help" style={style}>
      {children}
    </p>
  )
}

/** 밑줄 글자 버튼 — 아래에서 올라오는 창을 연다(시안 E04 체중 잰 방법 · E07 간식 칼로리 · E05 건너뛰기). */
export function TextLink({
  children,
  onClick,
  pressed,
  style,
}: {
  children: ReactNode
  onClick: () => void
  /** 누른 상태가 있는 버튼(변 건너뛰기)만. */
  pressed?: boolean
  style?: CSSProperties
}) {
  return (
    <button type="button" className="s-tlink" onClick={onClick} aria-pressed={pressed} style={style}>
      {children}
    </button>
  )
}

/** 회색 안내 상자(시안 F22·F23 "고른 재료는 …"). */
export function Note({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="s-note" style={style}>
      {children}
    </div>
  )
}

/**
 * 글자 칸 — 높이 56 · 모서리 16 · 단위는 오른쪽(시안 E14·F26·F29). 적었거나 누르고 있으면 먹색 테두리(시안 E17).
 * multiline = 약 칸(textarea, 높이는 부르는 쪽).
 */
export function Field({
  value,
  onChange,
  placeholder,
  unit,
  ariaLabel,
  type = 'text',
  min,
  max,
  step,
  multiline = false,
  height,
  style,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  unit?: string
  ariaLabel: string
  type?: 'text' | 'number'
  min?: number
  max?: number
  step?: number
  multiline?: boolean
  height?: number
  style?: CSSProperties
}) {
  const filled = value.trim() !== ''
  return (
    <div
      className={'s-field' + (multiline ? ' s-field-multi' : '')}
      data-filled={filled ? 'true' : undefined}
      style={{ ...(height ? { height } : null), ...style }}
    >
      {multiline ? (
        <textarea
          aria-label={ariaLabel}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          type={type}
          inputMode={type === 'number' ? 'numeric' : undefined}
          onWheel={type === 'number' ? (e) => e.currentTarget.blur() : undefined}
          min={min}
          max={max}
          step={step}
          aria-label={ariaLabel}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
      {unit && <span className="s-field-unit">{unit}</span>}
    </div>
  )
}
