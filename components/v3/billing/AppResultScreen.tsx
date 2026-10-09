/**
 * AppResultScreen — 카드 등록 결과 화면의 앱 모양(앱 새 디자인 'A 포스터', 2026-10-09, 캔버스 S34~S37).
 *
 * 처리 중 · 등록 완료 · 등록 실패 · 등록 안 됨 네 화면이 같은 틀이다: 가운데 동그란 표식 → 큰 제목(Black Han Sans)
 * → (있으면) 결제수단 칩 → 본문 → 아래에 붙은 버튼. 판정·문구·이동 주소는 각 page.tsx(billing-success·billing-fail)가
 * 정하고, 이 틀은 그리기만 한다. /subscribe/* 는 AppChrome 밖이라 앱 틀 표식(data-ft-chrome="app")을 여기서 단다 —
 * 앱 색 변수·제목 글꼴이 닿게. 웹 모양은 각 page.tsx 의 예전 그대로다.
 */

import Link from 'next/link'
import type { ReactNode } from 'react'
import { V3 } from '@/lib/design/tokens'

export type ResultMark = 'spin' | 'done' | 'fail' | 'card'

function Mark({ kind }: { kind: ResultMark }) {
  if (kind === 'spin') {
    return (
      <span
        aria-hidden
        className="animate-spin"
        style={{
          width: 56,
          height: 56,
          boxSizing: 'border-box',
          borderRadius: 28,
          border: '5px solid #EFEDEE',
          borderTopColor: V3.ink,
          borderRightColor: V3.ink,
        }}
      />
    )
  }
  const base = {
    width: 84,
    height: 84,
    boxSizing: 'border-box' as const,
    borderRadius: 42,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
  if (kind === 'done') {
    return (
      <span aria-hidden style={{ ...base, background: V3.ink }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    )
  }
  if (kind === 'fail') {
    return (
      <span aria-hidden style={{ ...base, background: V3.sale }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round">
          <path d="M12 6.5v7.5M12 17.6v.4" />
        </svg>
      </span>
    )
  }
  return (
    <span aria-hidden style={{ ...base, background: V3.soft, border: `2px solid ${V3.ink}` }}>
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={V3.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
        <path d="M3 9.5h18" />
      </svg>
    </span>
  )
}

/** 결제수단 칩 — "신한카드 ····1234"(시안 S35). */
export function PayMethodChip({ text }: { text: string }) {
  return (
    <span
      style={{
        marginTop: 12,
        height: 36,
        padding: '0 12px',
        borderRadius: 4,
        background: V3.soft,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 16,
        fontWeight: 800,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
        <path d="M3 9.5h18" />
      </svg>
      {text}
    </span>
  )
}

const primaryStyle = {
  height: 60,
  borderRadius: 4,
  background: V3.ink,
  color: '#FFFFFF',
  fontSize: 17,
  fontWeight: 800,
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  border: 0,
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const

const secondaryStyle = {
  height: 56,
  boxSizing: 'border-box' as const,
  borderRadius: 4,
  border: `1.5px solid ${V3.ink}`,
  background: '#FFFFFF',
  color: V3.ink,
  fontSize: 17,
  fontWeight: 800,
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const

/**
 * 아래 버튼 — 링크(href) **또는** 동작(onClick) 중 하나는 꼭 받는다(둘 다 없으면 눌러도 아무 일 없는 죽은 버튼 —
 * 규칙38). 첫째 = 먹색 주 버튼, 둘째 = 먹선 보조 버튼.
 */
type ResultActionProps = {
  primary?: boolean
  /** 오른쪽 화살표(→) — "내 정기배송 보기" 처럼 다음 화면으로 넘어갈 때. */
  arrow?: boolean
  children: ReactNode
} & ({ href: string; onClick?: never } | { onClick: () => void; href?: never })

export function ResultAction(props: ResultActionProps) {
  const { primary = false, arrow = false, children } = props
  const style = primary ? primaryStyle : secondaryStyle
  const body = (
    <>
      {children}
      {arrow && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      )}
    </>
  )
  if (props.href !== undefined) {
    return (
      <Link href={props.href} className="active:opacity-80" style={style}>
        {body}
      </Link>
    )
  }
  return (
    <button type="button" onClick={props.onClick} className="active:opacity-80" style={style}>
      {body}
    </button>
  )
}

export default function AppResultScreen({
  mark,
  title,
  chip,
  body,
  actions,
  alert = false,
}: {
  mark: ResultMark
  title: ReactNode
  chip?: ReactNode
  body: ReactNode
  actions?: ReactNode
  /** 실패 — 화면 읽기 프로그램이 즉시 끊고 알린다(role=alert). 그 밖엔 status(polite). */
  alert?: boolean
}) {
  return (
    <main
      data-ft-chrome="app"
      className="min-h-[100dvh] flex flex-col"
      style={{
        background: '#FFFFFF',
        color: V3.ink,
        // 최상위 경로라 AppChrome 이 safe-area 를 안 챙겨 준다 — 여기서 더한다.
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <section
        role={alert ? 'alert' : 'status'}
        aria-live={alert ? 'assertive' : 'polite'}
        style={{
          flex: 1,
          padding: '32px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          wordBreak: 'keep-all',
        }}
      >
        <Mark kind={mark} />
        {/* 제목 글꼴은 앱 틀의 h1 규칙이 준다 — fontFamily·fontWeight 를 여기서 주지 않는다. */}
        <h1 style={{ margin: mark === 'spin' ? '24px 0 0' : '26px 0 0', fontSize: 30, lineHeight: 1.25 }}>{title}</h1>
        {chip}
        <div style={{ margin: chip ? '22px 0 0' : '12px 0 0', fontSize: 17, lineHeight: 1.7, color: V3.inkSoft }}>{body}</div>
      </section>
      {actions && <div style={{ padding: '0 20px 28px', display: 'flex', flexDirection: 'column', gap: 8 }}>{actions}</div>}
    </main>
  )
}
