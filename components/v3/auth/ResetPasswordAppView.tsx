'use client'

/**
 * 새 비밀번호 '앱' 화면(앱 새 디자인 'A 포스터', 2026-10-09, 캔버스 W09 입력 · W10 링크 만료 · W25 변경 완료).
 *
 * 그리기만 한다 — 재설정 증표 확인(token_hash/code)·비밀번호 바꾸기·전 기기 로그아웃·로그인으로 이동은
 * /reset-password page.tsx 가 그대로 하고 상태만 넘긴다. 점검 화면(/design-check-auth)이 같은 부품에 예시 값을 넣는다.
 *
 * 안내 문구는 실제 규칙대로 "영문·숫자·특수문자 포함 8자 이상"(가입 화면과 같은 규칙 — 사장님 2026-07-22). 시안 W09 의
 * "영문·숫자 포함"은 가입 화면과 달라 결정 문서 '문구가 서로 다른 곳'에 올라 있던 것.
 */

import type { FormEvent } from 'react'
import { V3 } from '@/lib/design/tokens'
import {
  AuthAppMain,
  AuthErrorBox,
  AuthKicker,
  AuthLabel,
  AuthNoticeBox,
  AuthPasswordInput,
  AuthPrimaryButton,
  AuthPrimaryLink,
} from './AuthAppParts'

export type ResetPasswordAppStatus = 'checking' | 'expired' | 'form' | 'done'

export default function ResetPasswordAppView({
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
    <AuthAppMain>
      <AuthKicker style={{ marginTop: 52 }}>비밀번호 재설정</AuthKicker>
      <h1 style={{ margin: '10px 0 0', fontSize: 44, lineHeight: 1.1 }}>새 비밀번호</h1>
      <p style={{ margin: '10px 0 0', fontSize: 17, lineHeight: 1.6, color: V3.inkSoft }}>새 비밀번호를 입력하면 바로 적용돼요.</p>

      {status === 'checking' && (
        <div role="status" aria-label="링크를 확인하는 중" style={{ marginTop: 40, display: 'flex', justifyContent: 'center' }}>
          <span className="animate-spin" style={{ width: 28, height: 28, borderRadius: 14, border: `2.5px solid ${V3.ink}`, borderTopColor: 'transparent' }} />
        </div>
      )}

      {status === 'expired' && (
        <>
          <AuthErrorBox size="lg" style={{ marginTop: 30 }}>
            {expiredMessage}
          </AuthErrorBox>
          <AuthPrimaryLink href="/forgot-password" style={{ marginTop: 16 }}>
            메일 다시 받기
          </AuthPrimaryLink>
        </>
      )}

      {status === 'done' && (
        <AuthNoticeBox size="lg" title="비밀번호가 변경됐어요" style={{ marginTop: 30 }}>
          잠시 후 로그인 페이지로 이동해요. 새 비밀번호로 다시 로그인해 주세요.
        </AuthNoticeBox>
      )}

      {status === 'form' && (
        <form onSubmit={onSubmit} style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
          <AuthLabel htmlFor="new-password" style={{ marginTop: 30 }}>
            새 비밀번호
          </AuthLabel>
          <div style={{ marginTop: 8 }}>
            <AuthPasswordInput
              id="new-password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="새 비밀번호"
            />
          </div>
          <span style={{ marginTop: 6, fontSize: 14, color: V3.inkMute }}>영문·숫자·특수문자 포함 8자 이상</span>

          <AuthLabel htmlFor="confirm-password" style={{ marginTop: 20 }}>
            새 비밀번호 확인
          </AuthLabel>
          <div style={{ marginTop: 8 }}>
            <AuthPasswordInput
              id="confirm-password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => onConfirmChange(e.target.value)}
              aria-invalid={mismatch || undefined}
              placeholder="비밀번호 다시 입력"
            />
          </div>
          {mismatch && (
            <p role="alert" style={{ margin: '8px 0 0', fontSize: 15, fontWeight: 700, color: '#B23624' }}>
              비밀번호가 일치하지 않아요
            </p>
          )}

          {updateError && <AuthErrorBox style={{ marginTop: 14 }}>{updateError}</AuthErrorBox>}

          <AuthPrimaryButton type="submit" disabled={!canSubmit} style={{ marginTop: 24 }}>
            {updating ? '변경 중...' : '비밀번호 변경'}
          </AuthPrimaryButton>
        </form>
      )}
    </AuthAppMain>
  )
}
