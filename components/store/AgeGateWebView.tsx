'use client'

/**
 * 14세 확인 '웹' 화면(웹 시안 WEB-A09 · A10 14세 미만, 2026-10-10 웹 리뉴얼). 새 웹 가게 틀 안.
 *
 * 그리기만 한다 — 출생 연도 저장·14세 미만 차단(DB 트리거까지)·가입 전환 계측·다음 화면 이동은 /onboarding/age-gate
 * page.tsx 가 그대로 하고 상태만 넘긴다(앱은 AgeGateAppView — 같은 상태). 연도 고르기는 **진짜 select** 를 투명하게 덮어
 * 둔다 — 폰의 기본 고르기 창이 그대로 뜨고, 보이는 칸만 시안 모양.
 */

import StoreShell from './StoreShell'
import { AuthPrimaryButton } from '@/components/v3/auth/AuthAppParts'

export default function AgeGateWebView({
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
    <StoreShell>
      <section style={{ padding: '36px 20px 64px', display: 'flex', flexDirection: 'column' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: '#595959' }}>
          <span aria-hidden style={{ width: 8, height: 8, background: '#141414' }} />
          14세 확인
        </span>
        <h1 className="d" style={{ margin: '10px 0 0', fontSize: 40, lineHeight: 1.12 }}>
          출생 연도를
          <br />
          알려주세요
        </h1>
        <p style={{ margin: '14px 0 0', fontSize: 18, lineHeight: 1.6, color: '#3D3D3D' }}>
          파머스테일은 만 14세 이상만 이용할 수 있어요. 개인정보보호법에 따라 딱 한 번만 확인할게요.
        </p>

        <label htmlFor="age-gate-year-web" style={{ marginTop: 30, fontSize: 16, fontWeight: 800 }}>
          출생 연도
        </label>
        <div
          style={{
            position: 'relative',
            marginTop: 8,
            height: 56,
            boxSizing: 'border-box',
            padding: '0 12px 0 14px',
            border: isUnder14 ? '2px solid #B3261E' : '1.5px solid #8A8A8A',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 18,
          }}
        >
          {year ? <span style={{ fontWeight: 700 }}>{year}년</span> : <span style={{ color: '#767676' }}>선택해 주세요</span>}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#141414" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
          <select
            id="age-gate-year-web"
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
          <p role="alert" style={{ margin: '10px 0 0', display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 17, fontWeight: 700, lineHeight: 1.5, color: '#B3261E' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, marginTop: 3 }}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5v5.5M12 16.5v.01" />
            </svg>
            {message}
          </p>
        )}

        <AuthPrimaryButton onClick={onPrimary} disabled={!canSubmit} style={{ marginTop: 20 }}>
          {saving ? '저장 중...' : isUnder14 ? '확인 — 가입을 종료할게요' : '계속하기'}
        </AuthPrimaryButton>
        <p style={{ margin: '18px 0 0', fontSize: 15, lineHeight: 1.55, color: '#595959', textAlign: 'center' }}>
          개인정보보호법 제22조의2에 따라
          <br />만 14세 이상만 이용할 수 있어요.
        </p>
      </section>
    </StoreShell>
  )
}
