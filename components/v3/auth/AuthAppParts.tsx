'use client'

/**
 * 로그인·가입·계정 앱 화면 공통 조각(앱 새 디자인 'A 포스터', 2026-10-09, 캔버스 W06~W13·W18·W22~W27).
 *
 * 이 화면들(/login · /forgot-password · /reset-password · /auth/confirmed · /onboarding/age-gate · /offline ·
 * /start/join)은 웹·앱이 같이 쓰는 최상위 경로라 AppChrome 밖에서 그려진다. 앱일 때만 이 조각으로 그리고
 * 웹은 각 화면의 예전 모양 그대로다. 앱 판정은 서버 레이아웃이 넘기는 값(components/app/ServerAppContext) —
 * 클라이언트 훅으로 고르면 첫 그림이 웹 모양이었다가 바뀐다.
 *
 * 바탕에 data-ft-chrome="app" 을 달아 앱 범위 규칙(제목 = Black Han Sans · 큰 숫자 = Anton)을 받는다.
 * 줄 높이는 시안처럼 normal(여러 줄 문구는 각자 지정). 값은 시안 원본 HTML 그대로.
 */

import Link from 'next/link'
import { useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react'
import { V3 } from '@/lib/design/tokens'
import './auth-app.css'

/** 화면 바탕 — 흰 바탕, 앱 범위, 안전 영역. 윗줄(AuthBackHeader)이 있는 화면은 safeTop={false}(윗줄이 안전 영역을 맡는다). */
export function AuthAppMain({
  children,
  padX = true,
  safeTop = true,
}: {
  children: ReactNode
  padX?: boolean
  safeTop?: boolean
}) {
  return (
    <main
      data-ft-chrome="app"
      style={{
        minHeight: '100dvh',
        boxSizing: 'border-box',
        paddingLeft: padX ? 20 : 0,
        paddingRight: padX ? 20 : 0,
        paddingTop: safeTop ? 'env(safe-area-inset-top)' : 0,
        paddingBottom: 'env(safe-area-inset-bottom)',
        display: 'flex',
        flexDirection: 'column',
        background: '#FFFFFF',
        color: V3.ink,
        lineHeight: 'normal',
        letterSpacing: '-0.02em',
        wordBreak: 'keep-all',
      }}
    >
      {children}
    </main>
  )
}

/** ← + 제목 윗줄(시안 W07·W08 — 앱 깊은 화면 윗줄과 같은 모양). */
export function AuthBackHeader({ href, backLabel, title }: { href: string; backLabel: string; title: string }) {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 30, flexShrink: 0, background: '#FFFFFF', paddingTop: 'env(safe-area-inset-top)' }}>
      <div
        style={{
          height: 64,
          boxSizing: 'border-box',
          padding: '0 12px 0 6px',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          borderBottom: `1px solid ${V3.rule}`,
        }}
      >
        <Link href={href} aria-label={backLabel} style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', color: V3.ink }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <span className="ft-poster" style={{ fontSize: 22 }}>
          {title}
        </span>
      </div>
    </header>
  )
}

/** 작은 머리말(먹색 네모 + 회색 글자, 시안 W09·W13). */
export function AuthKicker({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: V3.inkMute, ...style }}>
      <span aria-hidden style={{ width: 8, height: 8, background: V3.ink }} />
      {children}
    </span>
  )
}

/** 칸 이름(15/800). */
export function AuthLabel({ htmlFor, children, style }: { htmlFor?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <label htmlFor={htmlFor} style={{ fontSize: 15, fontWeight: 800, ...style }}>
      {children}
    </label>
  )
}

/** 입력칸(높이 56 · 1.5px 회색 선 · 포커스 먹선 — auth-app.css). */
export function AuthInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={'ft-auth-input' + (className ? ` ${className}` : '')} />
}

function EyeIcon({ off }: { off: boolean }) {
  return off ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/** 비밀번호 칸 — 오른쪽 눈 버튼(48×48)으로 보이기/숨기기. 보이기 상태는 칸마다 따로. */
export function AuthPasswordInput({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input {...rest} type={show ? 'text' : 'password'} className={'ft-auth-input has-eye' + (className ? ` ${className}` : '')} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? '비밀번호 숨기기' : '비밀번호 표시'}
        tabIndex={-1}
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: 48,
          height: 48,
          border: 0,
          padding: 0,
          background: 'transparent',
          color: V3.inkMute,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <EyeIcon off={show} />
      </button>
    </div>
  )
}

const PRIMARY: CSSProperties = {
  width: '100%',
  height: 58,
  boxSizing: 'border-box',
  border: 0,
  borderRadius: 4,
  background: V3.ink,
  color: '#FFFFFF',
  fontFamily: 'inherit',
  fontSize: 17,
  fontWeight: 800,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  textDecoration: 'none',
  cursor: 'pointer',
}

/** 주 버튼(먹색 · 높이 58). type 기본 button — 폼 제출은 type="submit" 을 넘긴다. */
export function AuthPrimaryButton({ style, children, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} {...rest} className="active:opacity-80 disabled:opacity-50" style={{ ...PRIMARY, ...style }}>
      {children}
    </button>
  )
}

/** 주 버튼 모양의 링크. */
export function AuthPrimaryLink({ href, children, style }: { href: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <Link href={href} className="active:opacity-80" style={{ ...PRIMARY, ...style }}>
      {children}
    </Link>
  )
}

/** 보조 링크(흰 바탕 1.5px 먹선 · 높이 52). */
export function AuthOutlineLink({ href, children, style }: { href: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <Link
      href={href}
      className="active:opacity-80"
      style={{
        height: 52,
        boxSizing: 'border-box',
        border: `1.5px solid ${V3.ink}`,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        fontWeight: 800,
        color: V3.ink,
        textDecoration: 'none',
        ...style,
      }}
    >
      {children}
    </Link>
  )
}

function AlertIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={V3.sale} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5v.01" />
    </svg>
  )
}

/** 빨간 테두리 오류 상자. sm = 폼 아래(시안 W22·W27), lg = 화면 한가운데 안내(시안 W10). */
export function AuthErrorBox({ children, size = 'sm', style }: { children: ReactNode; size?: 'sm' | 'lg'; style?: CSSProperties }) {
  const lg = size === 'lg'
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        padding: lg ? 18 : '12px 14px',
        border: `2px solid ${V3.sale}`,
        borderRadius: 4,
        display: 'flex',
        alignItems: lg ? 'flex-start' : 'center',
        gap: lg ? 12 : 10,
        ...style,
      }}
    >
      <span style={{ display: 'flex', marginTop: lg ? 1 : 0 }}>
        <AlertIcon size={lg ? 24 : 22} />
      </span>
      <span style={{ fontSize: lg ? 17 : 16, fontWeight: 700, lineHeight: lg ? 1.55 : 1.45 }}>{children}</span>
    </div>
  )
}

/** 먹선 안내 상자(체크 네모 + 제목 + 설명). sm = 로그인 위 안내(시안 W23·W24), lg = 완료 화면(시안 W25). */
export function AuthNoticeBox({ title, children, size = 'sm', style }: { title: string; children?: ReactNode; size?: 'sm' | 'lg'; style?: CSSProperties }) {
  const lg = size === 'lg'
  const sq = lg ? 32 : 28
  return (
    <div
      role="status"
      style={{
        padding: lg ? 18 : '12px 14px',
        border: `${lg ? 2 : 1.5}px solid ${V3.ink}`,
        borderRadius: 4,
        display: 'grid',
        gridTemplateColumns: `${sq}px 1fr`,
        columnGap: lg ? 14 : 12,
        alignItems: 'start',
        ...style,
      }}
    >
      <span aria-hidden style={{ width: sq, height: sq, borderRadius: 4, background: V3.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={lg ? 20 : 18} height={lg ? 20 : 18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: lg ? 6 : 3 }}>
        <strong style={{ fontSize: lg ? 19 : 17, fontWeight: 800 }}>{title}</strong>
        {children && <span style={{ fontSize: lg ? 16 : 15, lineHeight: lg ? 1.6 : 1.5, color: V3.inkSoft }}>{children}</span>}
      </span>
    </div>
  )
}

/** 아이콘 네모(먹색 채움 또는 2px 먹선). */
export function AuthIconBox({ children, filled = false, size = 72 }: { children: ReactNode; filled?: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        boxSizing: 'border-box',
        borderRadius: 4,
        border: filled ? 0 : `2px solid ${V3.ink}`,
        background: filled ? V3.ink : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  )
}

/** 결과 화면 가운데 묶음(시안 W11·W12·W18) — 아이콘 · 큰 제목 · 설명 · 버튼 · 작은 안내. */
export function AuthResultPanel({
  icon,
  title,
  titleSize = 38,
  body,
  action,
  note,
}: {
  icon: ReactNode
  title: ReactNode
  titleSize?: number
  body: ReactNode
  action: ReactNode
  note?: ReactNode
}) {
  return (
    <div style={{ flex: 1, paddingBottom: 40, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {icon}
      <h1 style={{ margin: '24px 0 0', fontSize: titleSize, lineHeight: titleSize >= 40 ? 1.12 : 1.15 }}>{title}</h1>
      <p style={{ margin: '14px 0 0', fontSize: 18, lineHeight: 1.6, color: V3.inkSoft }}>{body}</p>
      <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column' }}>{action}</div>
      {note && <p style={{ margin: '16px 0 0', fontSize: 15, lineHeight: 1.55, color: V3.inkMute, textAlign: 'center' }}>{note}</p>}
    </div>
  )
}

/** "비밀번호가 기억나셨나요? 로그인" 줄(시안 W07·W08). */
export function AuthLoginRow({ style }: { style?: CSSProperties }) {
  return (
    <p style={{ margin: '22px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 15, color: V3.inkMute, ...style }}>
      비밀번호가 기억나셨나요?
      <Link href="/login" style={{ minHeight: 48, display: 'flex', alignItems: 'center', fontWeight: 800, color: V3.ink, textDecoration: 'underline', textUnderlineOffset: 3 }}>
        로그인
      </Link>
    </p>
  )
}

/** "또는" 가름줄(시안 W06). */
export function AuthOrDivider({ label = '또는', style }: { label?: string; style?: CSSProperties }) {
  return (
    <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', gap: 14, ...style }}>
      <span style={{ flex: 1, height: 1, background: V3.rule }} />
      <span style={{ fontSize: 15, fontWeight: 700, color: V3.inkMute }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: V3.rule }} />
    </div>
  )
}
