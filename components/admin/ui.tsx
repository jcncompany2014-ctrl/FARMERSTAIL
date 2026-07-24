import type { ReactNode } from 'react'
import Link from 'next/link'

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

export type AdminTab = { href: string; label: string }

/**
 * 라우트 링크형 세그먼트 탭 (대개편 v2 T0) — 비슷한 페이지들을 한 화면군으로 묶는다.
 * 페이지 병합 없이 각 페이지 상단에 이 탭바를 얹고, 사이드바 메뉴는 대표 1개만 노출.
 * active 는 각 페이지가 자기 href 를 넘긴다(서버 컴포넌트 호환 — usePathname 불필요).
 */
export function AdminTabs({
  tabs,
  active,
}: {
  tabs: readonly AdminTab[]
  active: string
}) {
  return (
    <div className="mb-5 inline-flex flex-wrap gap-1 rounded-lg bg-zinc-100 p-1">
      {tabs.map((t) => {
        const isActive = t.href === active
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={isActive ? 'page' : undefined}
            className={`px-3.5 py-1.5 rounded-md text-[12.5px] font-bold transition ${
              isActive
                ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
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

/**
 * 도움말 툴팁 — 지표/용어 옆 작은 "?" 에 마우스를 올리면 쉬운 설명이 뜬다.
 * 코드/용어를 모르는 사람도 각 숫자가 뭔지 바로 이해하도록. (CSS hover 전용,
 * 클라이언트 JS 불필요 → 서버 컴포넌트에서도 동작.)
 */
export function HelpTip({ text }: { text: string }) {
  return (
    <span className="group/help relative inline-flex align-middle">
      <span
        className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 text-[9px] font-bold cursor-help select-none leading-none"
        aria-hidden="true"
      >
        ?
      </span>
      <span className="sr-only">{text}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-30 mt-1.5 w-56 rounded-lg bg-zinc-900 px-3 py-2 text-[11px] font-normal normal-case tracking-normal leading-relaxed text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover/help:opacity-100"
      >
        {text}
      </span>
    </span>
  )
}

export type StatTone = 'neutral' | 'green' | 'red' | 'amber'

const STAT_TONE_TEXT: Record<StatTone, string> = {
  neutral: 'text-zinc-900',
  green: 'text-emerald-600',
  red: 'text-red-600',
  amber: 'text-amber-600',
}

/**
 * 지표 카드 — 쉬운 라벨 + 큰 숫자 + 보조설명 + (옵션)도움말.
 * label 옆 help 를 주면 "?" 툴팁으로 "이게 뭐예요" 를 설명한다.
 */
export function StatCard({
  label,
  value,
  sub,
  help,
  tone = 'neutral',
}: {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  help?: string
  tone?: StatTone
}) {
  return (
    <div className="p-4 rounded-lg bg-white border border-zinc-200">
      <p className="flex items-center text-[12px] text-zinc-500 font-semibold">
        <span>{label}</span>
        {help && <HelpTip text={help} />}
      </p>
      <p className={`mt-1.5 font-bold tracking-tight text-2xl ${STAT_TONE_TEXT[tone]}`}>
        {value}
      </p>
      {sub != null && <p className="mt-1 text-[11px] text-zinc-500 leading-snug">{sub}</p>}
    </div>
  )
}

/** 섹션 제목 + (옵션)쉬운 설명 — "이건 이렇게 보세요" 안내용. */
export function SectionTitle({
  title,
  desc,
  action,
}: {
  title: ReactNode
  desc?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold text-zinc-900">{title}</h2>
        {desc != null && (
          <p className="text-[12px] text-zinc-500 mt-0.5 leading-snug">{desc}</p>
        )}
      </div>
      {action != null && <div className="shrink-0">{action}</div>}
    </div>
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
