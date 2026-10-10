'use client'

/**
 * 14세 확인 '앱' 화면(앱 새 디자인 'A 포스터', 2026-10-09, 캔버스 W13 · W26 14세 미만).
 *
 * 그리기만 한다 — 출생 연도 저장·14세 미만 차단(DB 트리거까지)·가입 전환 계측·다음 화면 이동은 /onboarding/age-gate
 * page.tsx 가 그대로 하고 상태만 넘긴다. 연도 고르기는 **진짜 select** 를 투명하게 덮어 둔다 — 폰의 기본 고르기 창
 * (아이폰 휠)이 그대로 뜨고, 보이는 칸만 시안 모양(큰 숫자 글꼴 + 꺾쇠).
 */

import { V3 } from '@/lib/design/tokens'
import { AuthAppMain, AuthKicker, AuthLabel, AuthPrimaryButton } from './AuthAppParts'

export default function AgeGateAppView({
  year,
  years,
  onYearChange,
  isUnder14,
  error,
  saving,
  canSubmit,
  onPrimary,
}: {
  year: string
  years: number[]
  onYearChange: (v: string) => void
  isUnder14: boolean
  error: string
  saving: boolean
  canSubmit: boolean
  onPrimary: () => void
}) {
  const message = isUnder14 ? '만 14세 미만은 가입할 수 없어요. 보호자와 상의해 주세요.' : error
  return (
    <AuthAppMain>
      <AuthKicker style={{ marginTop: 52 }}>14세 확인</AuthKicker>
      <h1 style={{ margin: '10px 0 0', fontSize: 40, lineHeight: 1.15 }}>
        출생 연도를
        <br />
        알려주세요
      </h1>
      <p style={{ margin: '14px 0 0', fontSize: 17, lineHeight: 1.65, color: V3.inkSoft }}>
        파머스테일은 만 14세 이상만 이용할 수 있어요. 개인정보보호법에 따라 한 번만 확인할게요. 입력하신 연도는 이후 가입
        흐름에서 다시 묻지 않아요.
      </p>

      <AuthLabel htmlFor="age-gate-year" style={{ marginTop: 30 }}>
        출생 연도
      </AuthLabel>
      <div
        style={{
          position: 'relative',
          marginTop: 8,
          height: 60,
          boxSizing: 'border-box',
          padding: '0 12px 0 16px',
          border: `2px solid ${isUnder14 ? V3.sale : V3.ink}`,
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {year ? (
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span className="ft-num" style={{ fontSize: 28, lineHeight: 1 }}>
              {year}
            </span>
            <span style={{ fontSize: 17, fontWeight: 800 }}>년</span>
          </span>
        ) : (
          <span style={{ fontSize: 17, color: '#767676' }}>선택해 주세요</span>
        )}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={V3.ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
        <select
          id="age-gate-year"
          value={year}
          onChange={(e) => onYearChange(e.target.value)}
          disabled={saving}
          aria-invalid={isUnder14 || undefined}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', fontSize: 16 }}
        >
          <option value="">선택해 주세요</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
      </div>

      {message && (
        <p
          role="alert"
          style={{ margin: '10px 0 0', display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 16, fontWeight: 700, lineHeight: 1.5, color: '#B23624' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, marginTop: 2 }}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5.5M12 16.5v.01" />
          </svg>
          {message}
        </p>
      )}

      <AuthPrimaryButton onClick={onPrimary} disabled={!canSubmit} style={{ marginTop: 20, background: isUnder14 ? V3.sale : V3.ink }}>
        {saving ? '저장 중...' : isUnder14 ? '확인 — 가입을 종료할게요' : '계속하기'}
      </AuthPrimaryButton>

      <p style={{ margin: 'auto 0 0', padding: '20px 0 32px', fontSize: 14, lineHeight: 1.55, color: V3.inkMute, textAlign: 'center' }}>
        개인정보보호법 제22조의2에 따라 만 14세 이상 사용자만 이용할 수 있어요.
      </p>
    </AuthAppMain>
  )
}
