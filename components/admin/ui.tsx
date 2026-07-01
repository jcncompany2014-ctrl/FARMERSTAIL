import type { ReactNode } from 'react'

/**
 * 기능형 클린 어드민 공통 프리미티브 (2026-07 Phase B).
 *
 * admin 페이지들이 제각각 쓰던 헤더(font-Archivo_Black)·카드(rounded-2xl)·
 * 배지를 하나로 통일. 중립 회색조(zinc) + terracotta 절제 포인트.
 * 페이지는 이걸 import 해서 시각을 일관화한다.
 */

/** 페이지 상단 헤더 — 제목 + 부제 + 우측 액션 슬롯. */
export function AdminHeader({
  title,
  sub,
  actions,
}: {
  title: ReactNode
  sub?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 leading-tight">
          {title}
        </h1>
        {sub != null && (
          <p className="text-[13px] text-zinc-500 mt-1">{sub}</p>
        )}
      </div>
      {actions != null && <div className="shrink-0">{actions}</div>}
    </div>
  )
}

/** 흰 카드 — 얇은 zinc 보더 + rounded-lg(기존 rounded-2xl 대비 절제). */
export function AdminCard({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white ${padded ? 'p-5' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

export type BadgeTone = 'neutral' | 'green' | 'red' | 'amber' | 'blue'

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-zinc-100 text-zinc-600',
  green: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
}

/** 상태 배지 — 표/리스트의 상태 표시 통일. */
export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: BadgeTone
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  )
}

/** 주요 액션 버튼 — terracotta 포인트(절제 사용). */
export function AdminButton({
  children,
  href,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled,
}: {
  children: ReactNode
  href?: string
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'ghost'
  disabled?: boolean
}) {
  const cls =
    variant === 'primary'
      ? 'bg-terracotta text-white hover:bg-[#8A3822]'
      : 'bg-white text-zinc-700 border border-zinc-300 hover:border-zinc-400'
  const base = `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50 ${cls}`
  if (href) {
    return (
      <a href={href} className={base}>
        {children}
      </a>
    )
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={base}>
      {children}
    </button>
  )
}
