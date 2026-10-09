'use client'

/**
 * 비밀번호 찾기 '앱' 화면(앱 새 디자인 'A 포스터', 2026-10-09, 캔버스 W07 입력 · W08 메일 보냄).
 *
 * 그리기만 한다 — 메일 보내기·30초 재발송 막기·가입 여부 숨기기는 /forgot-password page.tsx 가 그대로 하고
 * 결과만 넘긴다. 점검 화면(/design-check-auth)이 같은 부품에 예시 값을 넣는다(메일을 실제로 보내지 않고).
 */

import type { FormEvent } from 'react'
import { V3 } from '@/lib/design/tokens'
import {
  AuthAppMain,
  AuthBackHeader,
  AuthErrorBox,
  AuthIconBox,
  AuthInput,
  AuthLabel,
  AuthLoginRow,
  AuthPrimaryButton,
} from './AuthAppParts'

function Dot({ muted = false }: { muted?: boolean }) {
  return <span aria-hidden style={{ flexShrink: 0, width: 6, height: 6, marginTop: 9, background: muted ? '#8E8C8D' : V3.mustard }} />
}

export default function ForgotPasswordAppView({
  submitted,
  email,
  onEmailChange,
  loading,
  error,
  onSubmit,
}: {
  submitted: boolean
  email: string
  onEmailChange: (v: string) => void
  loading: boolean
  error: string
  onSubmit: (e: FormEvent) => void
}) {
  return (
    <AuthAppMain padX={false} safeTop={false}>
      <AuthBackHeader href="/login" backLabel="로그인으로" title="비밀번호 찾기" />
      {submitted ? (
        <div style={{ padding: '36px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <AuthIconBox size={64}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={V3.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="1.5" />
              <path d="M3.5 6l8.5 7 8.5-7" />
            </svg>
          </AuthIconBox>
          <h1 style={{ margin: '20px 0 0', fontSize: 36, lineHeight: 1.15 }}>메일을 보냈어요</h1>
          <p style={{ margin: '14px 0 0', fontSize: 17, lineHeight: 1.65, color: V3.inkSoft, overflowWrap: 'anywhere' }}>
            <strong style={{ fontWeight: 800, color: V3.ink }}>{email}</strong> 로 재설정 링크를 보냈어요.
          </p>
          <ul
            style={{
              margin: '22px 0 0',
              padding: '16px 18px',
              listStyle: 'none',
              borderRadius: 4,
              background: V3.soft,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <li style={{ display: 'flex', gap: 10, fontSize: 16, lineHeight: 1.5 }}>
              <Dot />
              메일이 안 보이면 스팸함도 확인해 주세요.
            </li>
            <li style={{ display: 'flex', gap: 10, fontSize: 16, lineHeight: 1.5 }}>
              <Dot />
              링크는 1시간 동안 유효해요.
            </li>
            <li style={{ display: 'flex', gap: 10, fontSize: 16, lineHeight: 1.5, color: V3.inkMute }}>
              <Dot muted />
              가입하지 않은 이메일은 메일이 발송되지 않아요.
            </li>
          </ul>
          <AuthLoginRow style={{ marginTop: 26 }} />
        </div>
      ) : (
        <form onSubmit={onSubmit} style={{ margin: 0, padding: '30px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <p style={{ margin: 0, fontSize: 19, fontWeight: 700, lineHeight: 1.55 }}>
            가입한 이메일을 입력하시면
            <br />
            재설정 링크를 보내드려요.
          </p>
          <AuthLabel htmlFor="forgot-email" style={{ marginTop: 28 }}>
            이메일
          </AuthLabel>
          <div style={{ marginTop: 8 }}>
            <AuthInput
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="example@email.com"
            />
          </div>
          {error && <AuthErrorBox style={{ marginTop: 12 }}>{error}</AuthErrorBox>}
          <AuthPrimaryButton type="submit" disabled={loading} style={{ marginTop: 16 }}>
            {loading ? '발송 중...' : '재설정 메일 보내기'}
          </AuthPrimaryButton>
          <AuthLoginRow />
        </form>
      )}
    </AuthAppMain>
  )
}
