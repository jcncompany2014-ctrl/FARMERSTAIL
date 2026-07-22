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
import { AlertCircle } from 'lucide-react'
import StartAppShell from '@/components/start/StartAppShell'
import KakaoLoginButton from '@/components/KakaoLoginButton'
import AppleLoginButton from '@/components/AppleLoginButton'
import { createClient } from '@/lib/supabase/client'
import { saveAutosignupDraft } from '@/lib/autosignup-draft'

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
  if (s.includes('password')) return '비밀번호는 6자 이상이어야 해요.'
  if (s.includes('email')) return '이메일 형식을 확인해 주세요.'
  if (s.includes('rate') || s.includes('too many'))
    return '요청이 많아요. 잠시 후 다시 시도해 주세요.'
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

  // ── 메일 인증 안내 ──
  if (emailSent) {
    return (
      <StartAppShell>
        <main className="px-5 pt-10 pb-20">
          <h1
            className="font-sans"
            style={{
              fontSize: 25,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
            }}
          >
            가입 메일을 보냈어요
          </h1>
          <p
            className="mt-3 text-[13.5px]"
            style={{ color: 'var(--muted)', lineHeight: 1.7 }}
          >
            <b style={{ color: 'var(--ink)' }}>{email.trim()}</b> 로 보낸 인증
            링크를 눌러 가입을 완료해 주세요. 인증 후 로그인하면 우리 아이 맞춤
            설문으로 바로 이어져요.
          </p>
          <Link
            href="/login"
            className="mt-7 block text-center font-bold text-[14px]"
            style={{
              padding: '15px 24px',
              borderRadius: 9999,
              background: 'var(--fd-coral)',
              color: '#fff',
            }}
          >
            로그인하러 가기
          </Link>
        </main>
      </StartAppShell>
    )
  }

  const inputCls =
    'w-full px-4 py-3 rounded-lg border text-[16px] focus:outline-none transition'
  const inputStyle = {
    borderColor: 'var(--rule)' as const,
    background: '#FFFFFF',
    color: 'var(--ink)',
  }
  const labelCls = 'block text-[11px] font-bold mb-1.5'

  return (
    <StartAppShell>
      <main className="px-5 pt-8 pb-20">
        <h1
          className="font-sans"
          style={{
            fontSize: 27,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
            lineHeight: 1.22,
          }}
        >
          회원가입하고
          <br />
          분석 이어가기
        </h1>
        <p
          className="mt-2.5 text-[13.5px]"
          style={{ color: 'var(--muted)', lineHeight: 1.65 }}
        >
          가입하면 우리 아이 맞춤 분석을 이어갈 수 있어요. 몇 가지 설문만 더
          답하면 끝이에요.
        </p>

        {/* 카카오·애플 — 원탭·이름 자동. 복귀 착지 = /start/onboard(강아지 생성→설문). */}
        <div className="mt-6 space-y-3">
          <KakaoLoginButton variant="signup" next="/start/onboard" />
          <AppleLoginButton variant="signup" next="/start/onboard" />
        </div>

        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px" style={{ background: 'var(--rule)' }} />
          <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 600 }}>
            또는 이메일로 가입
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--rule)' }} />
        </div>

        {/* 이메일 회원가입 — 수집 항목·조건이 한 화면에(카카오 심사 근거). */}
        <div className="space-y-4">
          <div>
            <label className={labelCls} style={{ color: 'var(--ink)' }}>
              보호자 이름
            </label>
            <input
              type="text"
              value={guardianName}
              maxLength={20}
              placeholder="예: 홍길동"
              autoComplete="name"
              enterKeyHint="next"
              onChange={(e) => setGuardianName(e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--ink)' }}>
              이메일
            </label>
            <input
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
              className={inputCls}
              style={inputStyle}
            />
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--ink)' }}>
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              placeholder="영문·숫자·특수문자 포함 8자 이상"
              autoComplete="new-password"
              enterKeyHint="next"
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              style={{
                ...inputStyle,
                borderColor:
                  password && !passwordStrong(password)
                    ? 'var(--sale)'
                    : 'var(--rule)',
              }}
            />
            {password && !passwordStrong(password) && (
              <p
                className="mt-1 flex items-center gap-1"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--fd-coral-text)',
                }}
              >
                <AlertCircle className="w-3 h-3" strokeWidth={2.5} />
                영문·숫자·특수문자를 포함해 8자 이상이어야 해요
              </p>
            )}
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--ink)' }}>
              비밀번호 확인
            </label>
            <input
              type="password"
              value={confirmPassword}
              placeholder="비밀번호를 한 번 더 입력"
              autoComplete="new-password"
              enterKeyHint="next"
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputCls}
              style={{
                ...inputStyle,
                borderColor: passwordMismatch ? 'var(--sale)' : 'var(--rule)',
              }}
            />
            {passwordMismatch && (
              <p
                className="mt-1 flex items-center gap-1"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--fd-coral-text)',
                }}
              >
                <AlertCircle className="w-3 h-3" strokeWidth={2.5} />
                비밀번호가 일치하지 않아요
              </p>
            )}
          </div>
          <div>
            <label className={labelCls} style={{ color: 'var(--ink)' }}>
              보호자 출생연도{' '}
              <span style={{ color: 'var(--muted)' }}>(만 14세 이상)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={birthYear}
              placeholder={`예: ${currentYear - 30}`}
              enterKeyHint="done"
              onChange={(e) =>
                setBirthYear(e.target.value.replace(/[^0-9]/g, ''))
              }
              className={inputCls}
              style={{
                ...inputStyle,
                borderColor:
                  birthYear && !birthYearValid ? 'var(--sale)' : 'var(--rule)',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
            {birthYear && !birthYearValid && (
              <p
                className="mt-1 flex items-center gap-1"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--fd-coral-text)',
                }}
              >
                <AlertCircle className="w-3 h-3" strokeWidth={2.5} />만 14세
                이상만 가입할 수 있어요
              </p>
            )}
          </div>

          <div
            className="rounded-lg px-4 py-3.5 space-y-2.5"
            style={{
              background: 'var(--paper-hi, #FCFBF7)',
              boxShadow: 'inset 0 0 0 1px var(--rule)',
            }}
          >
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeRequired}
                onChange={(e) => setAgreeRequired(e.target.checked)}
                className="mt-0.5 w-4 h-4"
                style={{ accentColor: 'var(--fd-coral)' }}
              />
              <span
                style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--ink)' }}
              >
                <b style={{ color: 'var(--fd-coral)' }}>[필수]</b> 만 14세
                이상이며,{' '}
                <Link
                  href="/legal/terms"
                  target="_blank"
                  className="underline underline-offset-2 font-bold"
                  style={{ color: 'var(--ink)' }}
                >
                  이용약관
                </Link>
                ·
                <Link
                  href="/legal/privacy"
                  target="_blank"
                  className="underline underline-offset-2 font-bold"
                  style={{ color: 'var(--ink)' }}
                >
                  개인정보처리방침
                </Link>
                에 동의합니다
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeMarketing}
                onChange={(e) => setAgreeMarketing(e.target.checked)}
                className="mt-0.5 w-4 h-4"
                style={{ accentColor: 'var(--muted)' }}
              />
              <span
                style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--muted)' }}
              >
                <span className="font-bold">[선택]</span> 혜택·이벤트 소식 수신에
                동의합니다
              </span>
            </label>
          </div>

          {signupError && (
            <div
              role="alert"
              className="flex items-start gap-2"
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--fd-coral-text)',
              }}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2.5} />
              <span>{signupError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleEmailSignup}
            disabled={!emailFormValid || saving}
            className="w-full font-bold text-[14px] active:translate-y-[1px] transition-all"
            style={{
              height: 54,
              borderRadius: 9999,
              background: 'var(--fd-coral)',
              color: '#fff',
              opacity: emailFormValid && !saving ? 1 : 0.5,
            }}
          >
            {saving ? '가입 중...' : '이메일로 가입하기'}
          </button>
        </div>
      </main>
    </StartAppShell>
  )
}
