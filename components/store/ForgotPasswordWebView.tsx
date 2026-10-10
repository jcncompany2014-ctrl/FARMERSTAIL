'use client'

/**
 * 비밀번호 찾기 '웹' 화면(웹 시안 WEB-A03 입력 · WEB-A04 메일 보냄, 2026-10-10 웹 리뉴얼). 새 웹 가게 틀 안.
 *
 * 그리기만 한다 — 메일 보내기·30초 재발송 막기·가입 여부 숨기기는 /forgot-password page.tsx 가 그대로 하고 결과만 넘긴다
 * (앱은 ForgotPasswordAppView). 링크 유효 1시간 = Supabase 재설정 메일 기본값.
 */

import type { FormEvent } from 'react'
import Link from 'next/link'
import StoreShell from './StoreShell'
import { AuthErrorBox, AuthInput, AuthPrimaryButton } from '@/components/v3/auth/AuthAppParts'

function Bullet({ muted = false, children }: { muted?: boolean; children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: 10, fontSize: 16, lineHeight: 1.5, color: muted ? '#595959' : '#141414' }}>
      <span aria-hidden style={{ flexShrink: 0, width: 6, height: 6, marginTop: 9, background: muted ? '#8A8A8A' : '#141414' }} />
      {children}
    </li>
  )
}

export default function ForgotPasswordWebView({
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
    <StoreShell>
      <section style={{ padding: '36px 20px 64px', display: 'flex', flexDirection: 'column' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: '#595959' }}>
          <span aria-hidden style={{ width: 8, height: 8, background: '#141414' }} />
          비밀번호 재설정
        </span>
        <h1 className="d" style={{ margin: '10px 0 0', fontSize: 40, lineHeight: 1.1 }}>
          비밀번호 찾기
        </h1>
        <p style={{ margin: '12px 0 0', fontSize: 18, lineHeight: 1.6, color: '#3D3D3D' }}>가입한 이메일을 입력하시면 재설정 링크를 보내드려요.</p>

        {submitted ? (
          <div role="status" style={{ marginTop: 30, border: '2px solid #141414', borderRadius: 4, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 18px 16px', display: 'grid', gridTemplateColumns: '48px 1fr', columnGap: 14, alignItems: 'start' }}>
              <span aria-hidden style={{ width: 48, height: 48, background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="1.5" />
                  <path d="M3.5 6l8.5 7 8.5-7" />
                </svg>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <strong style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.3 }}>메일을 보냈어요</strong>
                <span style={{ fontSize: 17, lineHeight: 1.55, color: '#3D3D3D', overflowWrap: 'anywhere' }}>
                  <strong style={{ fontWeight: 800, color: '#141414' }}>{email}</strong>으로 재설정 링크를 보냈어요.
                </span>
              </span>
            </div>
            <ul style={{ margin: 0, padding: '16px 18px 18px', listStyle: 'none', borderTop: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Bullet>메일이 안 보이면 스팸함도 확인해 주세요.</Bullet>
              <Bullet>링크는 1시간 동안 쓸 수 있어요.</Bullet>
              <Bullet muted>가입하지 않은 이메일로는 메일이 가지 않아요.</Bullet>
            </ul>
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
            <label style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>이메일</span>
              <AuthInput
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
            </label>
            {error && <AuthErrorBox style={{ marginTop: 12 }}>{error}</AuthErrorBox>}
            <AuthPrimaryButton type="submit" disabled={loading} style={{ marginTop: 16 }}>
              {loading ? '보내는 중...' : '재설정 메일 보내기'}
            </AuthPrimaryButton>
          </form>
        )}

        <p style={{ margin: '22px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 16, color: '#595959' }}>
          비밀번호가 기억나셨나요?
          <Link
            href="/login"
            style={{ minHeight: 48, padding: '0 4px', display: 'flex', alignItems: 'center', fontWeight: 800, color: '#141414', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            로그인
          </Link>
        </p>
      </section>
    </StoreShell>
  )
}
