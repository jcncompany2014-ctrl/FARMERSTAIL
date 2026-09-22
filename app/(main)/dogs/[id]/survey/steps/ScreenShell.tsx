// 설문 v4 공용 조각 (2026-09-22, 시니어 사용성 3단계 — 화면당 질문 하나).
//
// 모든 화면이 같은 뼈대를 쓴다: 머리말(kicker) → 큰 질문(h1) → 한 줄 설명 → 선택지.
// 선택지는 **세로로 쌓인 큰 버튼**(.s-optbtn, 58px 이상·17px 글자)이 기본이다 —
// 칩(.s-chip)은 줄바꿈되면 어르신이 "어디까지가 한 묶음인지" 못 읽는다. 칩은
// 둘째 줄 보조 질문(SecondLine)의 짧은 2~4지선다에만 남긴다.
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Check } from 'lucide-react'

export function ScreenShell({
  kicker,
  title,
  sub,
  optional,
  children,
}: {
  kicker: string
  title: ReactNode
  sub?: ReactNode
  /** 답하지 않아도 넘어갈 수 있는 화면 — 머리말 옆에 '선택' 표시. */
  optional?: boolean
  children?: ReactNode
}) {
  return (
    <div className="s-page">
      <div className="s-kickrow">
        <span className="s-kicker">{kicker}</span>
        {optional && <span className="s-opt-badge">선택</span>}
      </div>
      <h1 className="s-title">{title}</h1>
      {sub && <p className="s-sub">{sub}</p>}
      {children}
    </div>
  )
}

export type OptionItem<V extends string | number> = {
  v: V
  label: string
  sub?: string
  Icon?: LucideIcon
}

/**
 * 단일 선택 — 세로 큰 버튼. `allowClear` 면 선택된 것을 다시 눌러 해제(선택 질문용).
 */
export function OptionList<V extends string | number>({
  options,
  value,
  onChange,
  allowClear = false,
  ariaLabel,
}: {
  options: ReadonlyArray<OptionItem<V>>
  value: V | null | ''
  onChange: (v: V | null) => void
  allowClear?: boolean
  ariaLabel?: string
}) {
  return (
    <div className="s-optlist" role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const active = value === o.v
        const Icon = o.Icon
        return (
          <button
            key={String(o.v)}
            type="button"
            className="s-optbtn"
            aria-pressed={active}
            onClick={() => onChange(active && allowClear ? null : o.v)}
          >
            {Icon && (
              <span className="s-optbtn-ic" aria-hidden>
                <Icon size={20} strokeWidth={2} />
              </span>
            )}
            <span className="s-optbtn-body">
              <span className="s-optbtn-lb">{o.label}</span>
              {o.sub && <span className="s-optbtn-sub">{o.sub}</span>}
            </span>
            <span className="s-optbtn-check" aria-hidden>
              {active && <Check size={18} strokeWidth={3} />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * 둘째 줄 질문 — 사장님(9/21): "'살 잘 찌는 편'·'사료 바꿀 때 무른 변'은 지우지
 * 말고 다른 화면에 두 번째 줄로". 본 질문과 점선으로 구분되는 보조 영역.
 */
export function SecondLine({
  label,
  hint,
  optional = true,
  children,
}: {
  label: string
  hint?: ReactNode
  optional?: boolean
  children: ReactNode
}) {
  return (
    <div className="s-second">
      <div className="s-sect-lbl">
        <span className="s-label-text">{label}</span>
        {optional && <span className="s-opt">선택</span>}
      </div>
      {hint && <p className="s-qhint">{hint}</p>}
      {children}
    </div>
  )
}

/** 짧은 2~4지선다 칩(둘째 줄 전용). 다시 누르면 해제. */
export function ChipRow<V extends string>({
  options,
  value,
  onChange,
  allowClear = true,
  tone,
}: {
  options: ReadonlyArray<OptionItem<V>>
  value: V | ''
  onChange: (v: V | '') => void
  allowClear?: boolean
  /** 'terra' = 코랄 선택색(질환 계열). */
  tone?: 'terra'
}) {
  return (
    <div className="s-chiprow">
      {options.map((o) => {
        const active = value === o.v
        const Icon = o.Icon
        return (
          <button
            key={o.v}
            type="button"
            className={
              's-chip' + (tone === 'terra' ? ' s-terra' : '') + (active ? ' s-on' : '')
            }
            aria-pressed={active}
            onClick={() => onChange(active && allowClear ? '' : o.v)}
          >
            {Icon && <Icon size={14} strokeWidth={2} aria-hidden />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
