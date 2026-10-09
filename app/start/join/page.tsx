'use client'

// 앱 Phase B(증분2) — 강아지정보 입력 직후 '바로 회원가입' 독립 화면(사장님 2026-07-20).
//
// 앱 흐름: /start(강아지 기본, StartClient) → [여기] 가입 → 강아지 생성 → 앱내
//   설문(/dogs/[id]/survey). 웹은 이 페이지를 거치지 않고 기존 흐름(설문 먼저 →
//   결과직전 가입) 유지 — StartClient 가 앱 컨텍스트에서만 여기로 보낸다.
//
//  · 카카오/애플: next=/start/onboard → 강아지만 생성 → 설문.
//  · 이메일: signUp(이메일확인 ON → 메일 인증 후 첫 로그인 시 /login 훅이
//    surveyDeferred 표식 보고 dog 생성 → 설문). signUp 인자·검증은 StartSurvey
//    (기존 설문끝 이메일가입)와 동일 형태 — 회원가입 로직 재사용.
//
// ★독립 회원가입 화면 = 수집 항목(이름·이메일·비번·출생연도·동의)과 조건이 한
//   화면에 보인다 → 카카오 개인정보 동의항목 심사의 '회원가입 화면' 근거.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import StartAppShell from '@/components/start/StartAppShell'
import KakaoLoginButton from '@/components/KakaoLoginButton'
import AppleLoginButton from '@/components/AppleLoginButton'
import { createClient } from '@/lib/supabase/client'
import { saveAutosignupDraft } from '@/lib/autosignup-draft'
import ResendConfirmationButton from '@/components/auth/ResendConfirmationButton'
import type { CSSProperties } from 'react'
import { V3 } from '@/lib/design/tokens'
import {
  AuthErrorBox,
  AuthIconBox,
  AuthInput,
  AuthLabel,
  AuthOrDivider,
  AuthPasswordInput,
  AuthPrimaryButton,
  AuthPrimaryLink,
} from '@/components/v3/auth/AuthAppParts'

const emailValid = (e: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())

// 비밀번호 강도 — 8자 이상 + 영문·숫자·특수문자 각 1개 이상(사장님 2026-07-22).
const passwordStrong = (pw: string) =>
  pw.length >= 8 &&
  /[a-zA-Z]/.test(pw) &&
  /[0-9]/.test(pw) &&
  /[^a-zA-Z0-9]/.test(pw)

// signUp 에러 원문 → 사용자용 한국어(StartSurvey humanizeSignupError 와 동일 정책).
function humanizeSignupError(raw: string): string {
  const s = raw.toLowerCase()
  if (s.includes('already') || s.includes('registered') || s.includes('exists'))
    return '이미 가입된 이메일이에요. 로그인해 주세요.'
  if (s.includes('weak') || s.includes('easy to guess') || s.includes('pwned'))
    return '많이 알려져 유출된 적 있는 비밀번호예요. 다른 비밀번호로 바꿔 주세요.'
  if (s.includes('password')) return '비밀번호는 영문·숫자·특수문자를 포함해 8자 이상이어야 해요.'
  // ★발송 한도·발송 실패를 '형식 오류'로 읽지 않는다(2026-09-26 점검 7차). 'email rate limit
  //   exceeded'·'Error sending confirmation email' 도 'email' 을 품어, 가입이 몰린 날 올바른
  //   주소를 넣은 고객에게 "형식을 확인해 주세요"가 떴다. 한도·발송을 먼저, 형식은 invalid 일 때만.
  if (s.includes('rate') || s.includes('too many'))
    return '요청이 많아요. 잠시 후 다시 시도해 주세요.'
  if (s.includes('sending')) return '인증 메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.'
  if (s.includes('email') && s.includes('invalid')) return '이메일 형식을 확인해 주세요.'
  return '가입에 실패했어요. 잠시 후 다시 시도해 주세요.'
}

export default function StartJoinPage() {
  const router = useRouter()
  const supabase = createClient()

  const [guardianName, setGuardianName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [agreeRequired, setAgreeRequired] = useState(false)
  const [agreeMarketing, setAgreeMarketing] = useState(false)
  const [signupError, setSignupError] = useState('')
  const [saving, setSaving] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const currentYear = new Date().getFullYear()
  const birthYearNum = birthYear ? Number(birthYear) : NaN
  const birthYearValid =
    Number.isInteger(birthYearNum) &&
    birthYearNum >= currentYear - 100 &&
    birthYearNum <= currentYear - 14

  const passwordMismatch =
    confirmPassword.length > 0 && password !== confirmPassword
  const emailFormValid =
    guardianName.trim().length >= 2 &&
    emailValid(email) &&
    passwordStrong(password) &&
    password === confirmPassword &&
    birthYearValid &&
    agreeRequired

  async function handleEmailSignup() {
    if (saving || !emailFormValid) return
    setSignupError('')
    setSaving(true)
    // 앱 가입-먼저 표식 — 메일 인증 후 첫 로그인 시 로그인 훅이 dog 만 만들고 앱
    // 설문으로(createDogFromDraft). 강아지정보는 이미 초안에 있음.
    saveAutosignupDraft({ surveyDeferred: true })
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          signup_profile: {
            // ★ top-level 'name' 금지 — 반드시 중첩(handle_new_user 복원신호 보존).
            name: guardianName.trim(),
            phone: '',
            zip: '',
            address: '',
            address_detail: '',
            birth_year: Number.isFinite(birthYearNum) ? birthYearNum : null,
            birth_month: null,
            birth_day: null,
            agree_email: agreeMarketing,
            agree_sms: agreeMarketing,
          },
        },
      },
    })
    if (error) {
      setSaving(false)
      setSignupError(humanizeSignupError(error.message ?? ''))
      return
    }
    // 이메일 중복 — Supabase 는 열거(enumeration) 방지로 에러 대신 identities 를
    // 빈 배열로 응답한다. 이 경우 '이미 가입됨' 안내(가짜 '메일 보냈어요' 방지).
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setSaving(false)
      setSignupError('이미 가입된 이메일이에요. 로그인해 주세요.')
      return
    }
    setPassword('') // 비밀번호 즉시 폐기
    setConfirmPassword('')
    if (data.session) {
      // 이메일확인 OFF(즉시 세션) → onboard 허브 재사용(dog 생성 → 설문).
      router.push('/start/onboard')
      return
    }
    // 이메일확인 ON → 메일 인증 안내.
    if (data.user) setEmailSent(true)
    setSaving(false)
  }

  // ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 W27) — 이 화면은 앱 전용(StartClient 가 앱 컨텍스트에서만 보낸다)이라
  //   갈래 없이 새 모양. 가입 처리(handleEmailSignup)·검증(emailFormValid)·재발송은 위 그대로.
  const hint = (text: string, error = false) => (
    <p
      role={error ? 'alert' : undefined}
      style={{ margin: 0, fontSize: 14, fontWeight: error ? 700 : 400, lineHeight: 1.5, color: error ? '#B23624' : V3.inkMute }}
    >
      {text}
    </p>
  )
  const field: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 }

  // ── 메일 인증 안내 ──
  if (emailSent) {
    return (
      <StartAppShell>
        <main data-ft-chrome="app" style={{ padding: '36px 20px 32px', display: 'flex', flexDirection: 'column', color: V3.ink, lineHeight: 'normal' }}>
          <AuthIconBox size={64}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={V3.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="1.5" />
              <path d="M3.5 6l8.5 7 8.5-7" />
            </svg>
          </AuthIconBox>
          <h1 style={{ margin: '20px 0 0', fontSize: 36, lineHeight: 1.15 }}>가입 메일을 보냈어요</h1>
          <p style={{ margin: '14px 0 0', fontSize: 17, lineHeight: 1.65, color: V3.inkSoft, overflowWrap: 'anywhere' }}>
            <strong style={{ fontWeight: 800, color: V3.ink }}>{email.trim()}</strong> 로 보낸 인증 링크를 눌러 가입을 완료해 주세요. 인증 후
            로그인하면 우리 아이 맞춤 설문으로 바로 이어져요.
          </p>
          <p style={{ margin: '10px 0 0', fontSize: 16, lineHeight: 1.6, color: V3.inkMute }}>메일이 안 보이면 스팸함도 확인해 주세요.</p>
          <ResendConfirmationButton email={email} color={V3.inkSoft} className="mt-2 text-[15px]" />
          <AuthPrimaryLink href="/login" style={{ marginTop: 22 }}>
            로그인하러 가기
          </AuthPrimaryLink>
        </main>
      </StartAppShell>
    )
  }

  const pwWeak = !!password && !passwordStrong(password)
  const yearBad = !!birthYear && !birthYearValid

  return (
    <StartAppShell>
      <main data-ft-chrome="app" style={{ padding: '26px 20px 32px', display: 'flex', flexDirection: 'column', color: V3.ink, lineHeight: 'normal' }}>
        <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.12 }}>
          회원가입하고
          <br />
          분석 이어가기
        </h1>
        <p style={{ margin: '12px 0 0', fontSize: 17, lineHeight: 1.6, color: V3.inkSoft }}>
          가입하면 우리 아이 맞춤 분석을 이어갈 수 있어요. 몇 가지 설문만 더 답하면 끝이에요.
        </p>

        {/* 카카오·애플 — 원탭·이름 자동. 복귀 착지 = /start/onboard(강아지 생성→설문). */}
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <KakaoLoginButton variant="signup" next="/start/onboard" look="app" />
          <AppleLoginButton variant="signup" next="/start/onboard" look="app" />
        </div>

        <AuthOrDivider label="또는 이메일로 가입" style={{ margin: '22px 0' }} />

        {/* 이메일 회원가입 — 수집 항목·조건이 한 화면에(카카오 심사 근거). */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={field}>
            <AuthLabel htmlFor="join-guardian-name">보호자 이름</AuthLabel>
            <AuthInput
              id="join-guardian-name"
              type="text"
              value={guardianName}
              maxLength={20}
              placeholder="예: 홍길동"
              autoComplete="name"
              enterKeyHint="next"
              onChange={(e) => setGuardianName(e.target.value)}
            />
          </div>
          <div style={field}>
            <AuthLabel htmlFor="join-email">이메일</AuthLabel>
            <AuthInput
              id="join-email"
              type="email"
              value={email}
              placeholder="example@email.com"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div style={field}>
            <AuthLabel htmlFor="join-password">비밀번호</AuthLabel>
            <AuthPasswordInput
              id="join-password"
              value={password}
              placeholder="비밀번호"
              autoComplete="new-password"
              enterKeyHint="next"
              aria-invalid={pwWeak || undefined}
              onChange={(e) => setPassword(e.target.value)}
            />
            {pwWeak ? hint('영문·숫자·특수문자를 포함해 8자 이상이어야 해요', true) : hint('영문·숫자·특수문자 포함 8자 이상')}
          </div>
          <div style={field}>
            <AuthLabel htmlFor="join-password-confirm">비밀번호 확인</AuthLabel>
            <AuthPasswordInput
              id="join-password-confirm"
              value={confirmPassword}
              placeholder="비밀번호를 한 번 더 입력"
              autoComplete="new-password"
              enterKeyHint="next"
              aria-invalid={passwordMismatch || undefined}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {passwordMismatch && hint('비밀번호가 일치하지 않아요', true)}
          </div>
          <div style={field}>
            <AuthLabel htmlFor="join-birth-year">
              보호자 출생연도 <span style={{ fontWeight: 600, color: V3.inkMute }}>(만 14세 이상)</span>
            </AuthLabel>
            <AuthInput
              id="join-birth-year"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={birthYear}
              placeholder={`예: ${currentYear - 30}`}
              enterKeyHint="done"
              aria-invalid={yearBad || undefined}
              className={birthYear ? 'ft-num' : undefined}
              style={birthYear ? { fontSize: 24, fontWeight: 400 } : undefined}
              onChange={(e) => setBirthYear(e.target.value.replace(/[^0-9]/g, ''))}
            />
            {yearBad && hint('만 14세 이상만 가입할 수 있어요', true)}
          </div>

          {/* 동의 — 회색 면 안 두 줄(시안 W27). 진짜 체크박스는 숨기고 네모만 그린다(누르는 칸 = 줄 전체). */}
          <div style={{ padding: '6px 16px', borderRadius: 4, background: V3.soft, display: 'flex', flexDirection: 'column' }}>
            <label style={{ ...CONSENT_ROW, borderBottom: `1px solid ${V3.rule}` }}>
              <input type="checkbox" checked={agreeRequired} onChange={(e) => setAgreeRequired(e.target.checked)} style={HIDDEN_CHECK} />
              <CheckSquare on={agreeRequired} />
              <span style={{ fontSize: 16, lineHeight: 1.55 }}>
                <b style={{ fontWeight: 800, color: V3.sale }}>[필수]</b> 만 14세 이상이며,{' '}
                <Link href="/legal/terms" target="_blank" style={CONSENT_LINK}>
                  이용약관
                </Link>
                ·
                <Link href="/legal/privacy" target="_blank" style={CONSENT_LINK}>
                  개인정보처리방침
                </Link>
                에 동의합니다
              </span>
            </label>
            <label style={CONSENT_ROW}>
              <input type="checkbox" checked={agreeMarketing} onChange={(e) => setAgreeMarketing(e.target.checked)} style={HIDDEN_CHECK} />
              <CheckSquare on={agreeMarketing} />
              <span style={{ fontSize: 16, lineHeight: 1.55, color: V3.inkSoft }}>
                <b style={{ fontWeight: 800 }}>[선택]</b> 혜택·이벤트 소식 수신에 동의합니다
              </span>
            </label>
          </div>

          {signupError && <AuthErrorBox>{signupError}</AuthErrorBox>}

          <AuthPrimaryButton onClick={handleEmailSignup} disabled={!emailFormValid || saving} style={{ marginTop: 4 }}>
            {saving ? '가입 중...' : '이메일로 가입하기'}
          </AuthPrimaryButton>
        </div>
      </main>
    </StartAppShell>
  )
}

const CONSENT_ROW: CSSProperties = {
  position: 'relative',
  minHeight: 56,
  padding: '10px 0',
  boxSizing: 'border-box',
  display: 'grid',
  gridTemplateColumns: '26px 1fr',
  columnGap: 12,
  alignItems: 'start',
  cursor: 'pointer',
}

// 화면에선 숨기되 키보드·읽기 프로그램은 그대로 쓰는 체크박스.
const HIDDEN_CHECK: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: 0,
  opacity: 0,
  pointerEvents: 'none',
}

const CONSENT_LINK: CSSProperties = { fontWeight: 800, color: V3.ink, textDecoration: 'underline', textUnderlineOffset: 3 }

function CheckSquare({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        marginTop: 1,
        width: 24,
        height: 24,
        boxSizing: 'border-box',
        borderRadius: 4,
        border: on ? 0 : '1.5px solid #8E8C8D',
        background: on ? V3.ink : '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {on && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      )}
    </span>
  )
}
