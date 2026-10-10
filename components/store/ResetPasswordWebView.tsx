'use client'

/**
 * 새 비밀번호 '웹' 화면(웹 시안 WEB-A05 입력 · A06 링크 만료 · A07 변경 완료, 2026-10-10 웹 리뉴얼). 새 웹 가게 틀 안.
 *
 * 그리기만 한다 — 재설정 증표 확인·비밀번호 바꾸기·전 기기 로그아웃·로그인으로 이동은 /reset-password page.tsx 가 그대로
 * 하고 상태만 넘긴다(앱은 ResetPasswordAppView — 같은 상태). 안내 문구는 실제 규칙대로 "영문·숫자·특수문자 포함 8자 이상"
 * (가입 화면과 같은 규칙 — 사장님 2026-07-22; 시안의 "영문·숫자 포함"은 실제와 달라 고쳤다).
 */

import type { FormEvent } from 'react'
import Link from 'next/link'
import StoreShell from './StoreShell'
import { AuthErrorBox, AuthPasswordInput, AuthPrimaryButton } from '@/components/v3/auth/AuthAppParts'
import type { ResetPasswordAppStatus } from '@/components/v3/auth/ResetPasswordAppView'

export default function ResetPasswordWebView({
  status,
  expiredMessage,
  password,
  onPasswordChange,
  confirm,
  onConfirmChange,
  mismatch,
  updating,
  updateError,
  canSubmit,
  onSubmit,
}: {
  status: ResetPasswordAppStatus
  expiredMessage: string
  password: string
  onPasswordChange: (v: string) => void
  confirm: string
  onConfirmChange: (v: string) => void
  mismatch: boolean
  updating: boolean
  updateError: string
  canSubmit: boolean
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
          새 비밀번호
        </h1>
        <p style={{ margin: '12px 0 0', fontSize: 18, lineHeight: 1.6, color: '#3D3D3D' }}>새 비밀번호를 입력하면 바로 적용돼요.</p>

        {status === 'checking' && (
          <div role="status" aria-label="링크를 확인하는 중" style={{ marginTop: 40, display: 'flex', justifyContent: 'center' }}>
            <span className="animate-spin" style={{ width: 28, height: 28, borderRadius: 14, border: '2.5px solid #141414', borderTopColor: 'transparent' }} />
          </div>
        )}

        {status === 'expired' && (
          <>
            <div
              role="alert"
              style={{ marginTop: 30, padding: 18, border: '2px solid #B3261E', borderRadius: 4, display: 'grid', gridTemplateColumns: '24px 1fr', columnGap: 12, alignItems: 'start' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B3261E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ marginTop: 2 }}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5v5.5M12 16.5h.01" />
              </svg>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <strong style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.35 }}>링크가 만료됐어요</strong>
                <span style={{ fontSize: 17, lineHeight: 1.55, color: '#3D3D3D' }}>{expiredMessage}</span>
              </span>
            </div>
            <Link
              href="/forgot-password"
              style={{
                marginTop: 16,
                height: 58,
                borderRadius: 4,
                background: '#141414',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              메일 다시 받기
            </Link>
          </>
        )}

        {status === 'done' && (
          <div
            role="status"
            style={{ marginTop: 30, padding: 18, border: '2px solid #141414', borderRadius: 4, display: 'grid', gridTemplateColumns: '48px 1fr', columnGap: 14, alignItems: 'start' }}
          >
            <span aria-hidden style={{ width: 48, height: 48, background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <strong style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.3 }}>비밀번호가 변경됐어요</strong>
              <span style={{ fontSize: 17, lineHeight: 1.55, color: '#3D3D3D' }}>
                잠시 후 로그인 화면으로 이동해요.
                <br />새 비밀번호로 다시 로그인해 주세요.
              </span>
            </span>
          </div>
        )}

        {status === 'form' && (
          <form onSubmit={onSubmit} style={{ margin: '30px 0 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>새 비밀번호</span>
              <AuthPasswordInput required minLength={8} autoComplete="new-password" value={password} onChange={(e) => onPasswordChange(e.target.value)} />
              <span style={{ fontSize: 15, color: '#595959' }}>영문·숫자·특수문자 포함 8자 이상</span>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>새 비밀번호 확인</span>
              <AuthPasswordInput
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => onConfirmChange(e.target.value)}
                aria-invalid={mismatch || undefined}
              />
              {mismatch ? (
                <span role="alert" style={{ fontSize: 15, fontWeight: 700, color: '#B3261E' }}>
                  비밀번호가 일치하지 않아요
                </span>
              ) : (
                <span style={{ fontSize: 15, color: '#595959' }}>한 번 더 똑같이 입력해 주세요</span>
              )}
            </label>
            {updateError && <AuthErrorBox>{updateError}</AuthErrorBox>}
            <AuthPrimaryButton type="submit" disabled={!canSubmit} style={{ marginTop: 4 }}>
              {updating ? '변경 중...' : '비밀번호 변경'}
            </AuthPrimaryButton>
          </form>
        )}
      </section>
    </StoreShell>
  )
}
