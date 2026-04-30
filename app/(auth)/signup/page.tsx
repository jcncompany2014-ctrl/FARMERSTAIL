'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Eye,
  EyeOff,
  Gift,
  Sparkles,
  Repeat,
  Check,
  AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import KakaoLoginButton from '@/components/KakaoLoginButton'
import AuthHero from '@/components/auth/AuthHero'
import AddressSearch from '@/components/AddressSearch'
import { trackSignUp } from '@/lib/analytics'
import { MARKETING_POLICY_VERSION } from '@/lib/consent'
import { formatPhone, stripHyphens } from '@/lib/formatters'

/**
 * /signup — 신규 계정 생성.
 *
 * 톤: landing / onboarding의 editorial 언어를 그대로 이어받는다.
 *   • AuthHero (로고 + kicker + serif h1 + 서브카피)
 *   • Benefits strip / Welcome reward card
 *   • 01/02/03/04 번호 kicker로 폼을 섹션 단위로 조판
 *
 * 수집 필드:
 *   - name (이름)            → profiles.name
 *   - email / password       → auth.users
 *   - phone (휴대폰)         → profiles.phone          (010-XXXX-XXXX 포매팅)
 *   - zip / address / detail → profiles.{zip,address,address_detail}
 *     (다음/카카오 우편번호 API — AddressSearch 컴포넌트 재사용)
 *   - referralCode (선택)    → redeem_referral_code RPC
 *   - agreeRequired          → 약관 / 개인정보처리방침 + 만 14세 확인
 *   - agreeMarketingEmail/Sms → profiles.agree_email/sms (opt-in 기본값 false)
 *
 * 트리거가 signup 직후 profiles 기본 row를 만들어 두므로,
 * 클라이언트는 그 row에 update로 필드를 채워 넣는다.
 */

/**
 * 대한민국 휴대폰 — 010/011/016/017/018/019 로 시작, 총 10~11자리.
 * lib/formatters 의 isValidMobilePhone 은 010 만 허용 (현재 표준).
 * 가입에선 011/016/017/018/019 도 허용 (구형 번호 보유자가 있음).
 */
function isValidKoreanMobile(value: string): boolean {
  return /^01[016789]\d{7,8}$/.test(stripHyphens(value))
}

function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()

  // Hydrate the referral field from the `?ref=CODE` shared link the
  // invite flow builds. Read it lazily in the useState initializer so
  // we don't trigger react-hooks/set-state-in-effect.
  const initialCode = (() => {
    const fromUrl = params.get('ref')
    return fromUrl ? fromUrl.trim().toUpperCase().slice(0, 16) : ''
  })()

  // ── 01 계정
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [phone, setPhone] = useState('')
  // birth_year — 만 14세 미만 가입 차단 근거. 문자열로 보관했다가 제출 시 숫자로.
  const [birthYear, setBirthYear] = useState('')
  // birth_month/day — 생일 쿠폰 자동 발송 대상 식별용. 선택. 둘 다 채우거나 둘 다 비우거나.
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay] = useState('')

  // ── 02 배송지
  const [zip, setZip] = useState('')
  const [address, setAddress] = useState('')
  const [addressDetail, setAddressDetail] = useState('')

  // ── 03 초대
  const [referralCode, setReferralCode] = useState(initialCode)

  // ── 04 동의
  // 필수: 만 14세 이상 + 이용약관 + 개인정보 수집·이용
  // 선택: 이메일/SMS 마케팅 (정보통신망법 §50 — 기본 미체크)
  const [agreeRequired, setAgreeRequired] = useState(false)
  const [agreeMarketingEmail, setAgreeMarketingEmail] = useState(false)
  const [agreeMarketingSms, setAgreeMarketingSms] = useState(false)
  const allChecked =
    agreeRequired && agreeMarketingEmail && agreeMarketingSms
  function toggleAll(next: boolean) {
    setAgreeRequired(next)
    setAgreeMarketingEmail(next)
    setAgreeMarketingSms(next)
  }

  // ── UI 상태
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  // ── Derived 검증 (제출 버튼 활성화 조건 + 인라인 피드백)
  const passwordMismatch =
    passwordConfirm.length > 0 && password !== passwordConfirm
  const phoneValid = phone === '' || isValidKoreanMobile(phone)
  const hasReferral = referralCode.trim().length > 0

  // 나이 게이트 — 연도만 입력받고 "해당 연도 생이면 올해 기준 최대 나이" 로 계산.
  // 엄밀한 만 나이는 아니지만 PIPA 14세 기준에서 충분히 보수적. (14살 생일 직전인
  // 사람은 사실상 13세라 막힐 수 있는데, 이는 의도된 안전 마진.)
  const currentYear = new Date().getFullYear()
  const MIN_BIRTH_YEAR = currentYear - 100
  const MAX_BIRTH_YEAR = currentYear - 14
  const birthYearNum = birthYear ? Number(birthYear) : NaN
  const birthYearValid =
    Number.isInteger(birthYearNum) &&
    birthYearNum >= MIN_BIRTH_YEAR &&
    birthYearNum <= MAX_BIRTH_YEAR
  // 사용자가 "올해 - 13 ~ 올해" 사이 연도를 골랐을 때만 under-14 경고를 띄운다.
  const birthYearUnder14 =
    Number.isInteger(birthYearNum) &&
    birthYearNum > MAX_BIRTH_YEAR &&
    birthYearNum <= currentYear

  const canSubmit = useMemo(() => {
    if (loading) return false
    if (!agreeRequired) return false
    if (name.trim().length < 2) return false
    if (!email.trim()) return false
    if (password.length < 6) return false
    if (password !== passwordConfirm) return false
    if (!isValidKoreanMobile(phone)) return false
    if (!zip.trim() || !address.trim()) return false
    if (!birthYearValid) return false
    return true
  }, [
    loading,
    agreeRequired,
    name,
    email,
    password,
    passwordConfirm,
    phone,
    zip,
    address,
    birthYearValid,
  ])

  // Mirror the URL-provided code to sessionStorage so it survives the
  // Kakao OAuth roundtrip (we pick it up on /dashboard on return).
  useEffect(() => {
    if (!initialCode) return
    try {
      sessionStorage.setItem('pending_referral', initialCode)
    } catch {
      /* noop */
    }
  }, [initialCode])

  function handleAddressComplete(data: {
    zip: string
    address: string
    buildingName: string
  }) {
    setZip(data.zip)
    setAddress(data.address)
    if (data.buildingName) {
      setAddressDetail(data.buildingName)
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')

    // 버튼 disabled로 막고 있지만 키보드/스크립트 우회를 방지하기 위한
    // 한번 더 검증. 각 필드별로 구체적인 메시지를 낸다.
    if (!agreeRequired) {
      setError('이용약관과 개인정보처리방침에 동의해 주세요')
      return
    }
    if (name.trim().length < 2) {
      setError('이름을 2자 이상 입력해 주세요')
      return
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요')
      return
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않아요')
      return
    }
    if (!isValidKoreanMobile(phone)) {
      setError('올바른 휴대폰 번호를 입력해 주세요')
      return
    }
    if (!zip.trim() || !address.trim()) {
      setError('기본 배송지 주소를 입력해 주세요')
      return
    }
    if (!birthYearValid) {
      if (birthYearUnder14) {
        setError(
          '만 14세 미만은 가입할 수 없어요. 보호자와 함께 다시 확인해 주세요.',
        )
      } else {
        setError('출생 연도를 선택해 주세요')
      }
      return
    }

    setLoading(true)

    const { data, error: authErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    })

    if (authErr) {
      setLoading(false)
      setError(authErr.message)
      return
    }

    if (data.user) {
      // 전환 이벤트 — GA4 + Meta Pixel. 이메일 가입 완료 시점에만.
      // (카카오 로그인은 callback이 서버라 여기서 추적 못 함.)
      trackSignUp('email')

      // profiles 업데이트 — 트리거가 만들어 둔 row에 사용자 입력을
      // 채워 넣는다. 주소/전화번호 저장 실패는 가입 자체를 되돌리지
      // 않는다 (다음 단계에서 수정 가능). 다만 에러는 info 노트로 노출.
      // 마케팅 동의는 timestamp + policy version 감사를 위해 RPC 사용.
      // profile 본체(주소·이름 등) 와 분리해 호출. 에러는 나중에 info 로만 노출.
      const now = new Date().toISOString()
      // 생일 (월/일) — 둘 다 채워야 의미 있음. 한쪽만이면 NULL 로.
      const birthMonthNum =
        birthMonth && birthDay ? Number(birthMonth) : null
      const birthDayNum = birthMonth && birthDay ? Number(birthDay) : null

      const { error: profErr } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          phone,
          zip,
          address,
          address_detail: addressDetail,
          birth_year: birthYearNum,
          birth_month: birthMonthNum,
          birth_day: birthDayNum,
          agree_email: agreeMarketingEmail,
          agree_sms: agreeMarketingSms,
          // timestamp — 감사 로그용. opt-in 이면 현재 시각, opt-out 이면 null.
          agree_email_at: agreeMarketingEmail ? now : null,
          agree_sms_at: agreeMarketingSms ? now : null,
          marketing_policy_version:
            agreeMarketingEmail || agreeMarketingSms
              ? MARKETING_POLICY_VERSION
              : null,
        })
        .eq('id', data.user.id)

      // consent_log 에 증적. RPC 를 써도 되고 직접 insert 해도 되지만, 가입
      // 직후라 RPC (auth.uid() 기준) 가 가장 깔끔. 실패해도 무시 — profiles
      // 플래그가 truth source 이고 로그는 부가적.
      if (agreeMarketingEmail) {
        await supabase
          .from('consent_log')
          .insert({
            user_id: data.user.id,
            channel: 'email',
            granted: true,
            policy_version: MARKETING_POLICY_VERSION,
            source: 'signup',
          })
      }
      if (agreeMarketingSms) {
        await supabase
          .from('consent_log')
          .insert({
            user_id: data.user.id,
            channel: 'sms',
            granted: true,
            policy_version: MARKETING_POLICY_VERSION,
            source: 'signup',
          })
      }

      if (profErr) {
        // 트리거가 14세 미만을 거부하면 UNDER_14 메시지로 돌아옴.
        // 혹시 클라이언트 가드를 우회하더라도 가입 자체가 실패로 보이도록
        // 에러로 띄우고 리다이렉트를 막는다.
        if (profErr.message?.includes('UNDER_14')) {
          await supabase.auth.signOut()
          setLoading(false)
          setError('만 14세 미만은 가입할 수 없어요.')
          return
        }
        setInfo(
          '프로필 저장 중 일부 오류가 있었어요. 마이페이지에서 확인해 주세요.'
        )
      }

      const code = referralCode.trim().toUpperCase()
      if (code) {
        // Fire-and-forget: 잘못된 코드가 대시보드 진입을 막지 않도록
        // 가입 자체는 성공 처리. 에러는 info 노트로만.
        const { error: refErr } = await supabase.rpc('redeem_referral_code', {
          input_code: code,
        })
        if (refErr) {
          const raw = refErr.message || ''
          const friendly = raw.includes('invalid code')
            ? '초대 코드가 유효하지 않아 적립은 적용되지 않았어요. 가입은 완료됐어요.'
            : raw.includes('cannot redeem own code')
              ? '본인 코드는 사용할 수 없어요.'
              : raw.includes('already redeemed')
                ? '이미 등록된 초대 코드예요.'
                : null
          if (friendly) {
            setInfo(friendly)
          }
        } else {
          try {
            sessionStorage.removeItem('pending_referral')
          } catch {
            /* noop */
          }
        }
      }
      // 환영 메일 fire-and-forget — 서버 라우트가 본인 세션으로 검증 후
      // Resend 로 발송. 실패해도 가입 플로우엔 영향 없음 (idempotencyKey
      // 덕분에 중복 호출도 안전).
      fetch('/api/auth/welcome-email', { method: 'POST' }).catch(() => {})

      setLoading(false)
      router.push('/dashboard')
    }
  }

  // Shared input visual — 코드 중복 제거. border/focus는 inline style
  // (var(--terracotta)) 로 분기하기 위해 className에선 padding/radius만.
  const baseInputCls =
    'w-full px-4 py-3 rounded-lg border text-sm focus:outline-none transition'
  const baseInputStyle = {
    borderColor: 'var(--rule-2)' as const,
    background: '#FDFDFD',
    color: 'var(--text)',
  }
  function onFocusBorder(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = 'var(--terracotta)'
  }
  function onBlurBorder(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = 'var(--rule-2)'
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center px-6 pt-7 md:pt-12 pb-16 md:pb-20"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm md:max-w-md">
        <AuthHero
          kicker="Begin · 시작하기"
          title={<>3분 만에 시작</>}
          subtitle="이메일 또는 카카오로 계정을 만들 수 있어요."
        />

        {/* Benefits strip */}
        <div
          className="grid grid-cols-3 gap-2 mb-5 rounded-2xl px-3 py-4"
          style={{
            background: 'var(--bg-2)',
            boxShadow: 'inset 0 0 0 1px var(--rule)',
          }}
        >
          {[
            {
              icon: Gift,
              tone: 'var(--terracotta)',
              kicker: '+3,000P',
              label: '가입 혜택',
            },
            {
              icon: Sparkles,
              tone: 'var(--moss)',
              kicker: 'AI',
              label: '맞춤 영양 분석',
            },
            {
              icon: Repeat,
              tone: 'var(--ink)',
              kicker: 'Auto',
              label: '정기배송',
            },
          ].map(({ icon: Icon, tone, kicker, label }) => (
            <div
              key={label}
              className="flex flex-col items-center text-center gap-1.5"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'var(--bg)' }}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={2} color={tone} />
              </div>
              <span
                className="kicker"
                style={{ color: tone, fontSize: 9.5 }}
              >
                {kicker}
              </span>
              <span
                className="text-[10.5px] font-bold leading-tight"
                style={{ color: 'var(--text)' }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Welcome reward */}
        <div
          className="mb-6 rounded-2xl px-5 py-5 text-white"
          style={{ background: 'var(--ink)' }}
        >
          <div className="flex items-center gap-2">
            <Sparkles
              className="w-3.5 h-3.5"
              strokeWidth={2}
              color="var(--gold)"
            />
            <span className="kicker kicker-gold">Welcome · 가입 혜택</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className="font-serif leading-none"
              style={{
                fontSize: 34,
                fontWeight: 800,
                letterSpacing: '-0.02em',
              }}
            >
              3,000P
            </span>
            <span className="text-[11px] text-white/70 font-semibold">
              즉시 적립
            </span>
            {hasReferral && (
              <span
                className="ml-auto text-[10px] font-black rounded-full px-2 py-0.5"
                style={{
                  background: 'var(--gold)',
                  color: 'var(--ink)',
                  letterSpacing: '0.02em',
                }}
              >
                +3,000P
              </span>
            )}
          </div>
          <p className="mt-2 text-[11.5px] text-white/70 leading-relaxed">
            {hasReferral
              ? '초대 코드 확인됨 — 가입 즉시 총 6,000P가 적립돼요.'
              : '가입만 해도 3,000P. 초대 코드가 있다면 3,000P 더.'}
          </p>
        </div>

        {/*
          카카오 가입 — 프라이머리 CTA 위치로 승격.
          한국 유저 대다수가 소셜 로그인으로 훨씬 빠르게 가입하는데,
          이전엔 긴 이메일 폼 하단에 묻혀 있어서 존재감이 낮았다.
          웰컴 보상 카드 바로 아래로 끌어올려서 "3,000P 약속 → 즉시
          카카오 한 번에 가입" 이라는 단축 경로를 열어준다.
          이메일 폼은 카카오를 쓰지 않는 소수 유저를 위한 fallback 으로
          아래로 내리고, 그 사이에 "또는 이메일로 가입" 디바이더 배치.
        */}
        <div className="mb-3">
          <KakaoLoginButton variant="signup" />
        </div>

        {/* 카카오 로그인은 별도 동의 UI 없이 진행되므로 묵시적 동의 근거 제공. */}
        <p
          className="mb-6 text-[10.5px] text-center leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          카카오로 계속하면{' '}
          <Link
            href="/legal/terms"
            target="_blank"
            className="underline underline-offset-2 font-bold"
            style={{ color: 'var(--text)' }}
          >
            이용약관
          </Link>
          과{' '}
          <Link
            href="/legal/privacy"
            target="_blank"
            className="underline underline-offset-2 font-bold"
            style={{ color: 'var(--text)' }}
          >
            개인정보처리방침
          </Link>
          에 동의하는 것으로 간주됩니다.
          <br />
          (배송지는 가입 후 마이페이지에서 등록할 수 있어요.)
        </p>

        {/* "또는 이메일로 가입" 디바이더 — 이전엔 폼 뒤에 "Or" 로 카카오를
            선택지로 제시했는데, 이제 카카오가 primary 라 방향을 뒤집어
            "소셜이 안 맞으면 이메일로" 라는 의미로 라벨도 구체화한다. */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px" style={{ background: 'var(--rule-2)' }} />
          <span
            className="kicker"
            style={{ color: 'var(--muted)', fontSize: 9 }}
          >
            Or Email · 이메일로 가입
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--rule-2)' }} />
        </div>

        <form onSubmit={handleSignup} className="space-y-6">
          {/* ── 01 · Account · 계정 정보 ─────────────────────────── */}
          <section>
            <div className="flex items-baseline gap-2.5 mb-3">
              <span
                className="font-serif leading-none tnum"
                style={{
                  color: 'var(--terracotta)',
                  fontSize: 16,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  fontVariantNumeric: 'lining-nums tabular-nums',
                }}
              >
                01
              </span>
              <span className="kicker">Account · 계정 정보</span>
            </div>

            <div className="space-y-3">
              {/* 이름 */}
              <div>
                <label
                  className="block text-[11px] font-bold mb-1.5"
                  style={{ color: 'var(--text)' }}
                >
                  이름
                </label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  enterKeyHint="next"
                  maxLength={20}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={baseInputCls}
                  style={baseInputStyle}
                  onFocus={onFocusBorder}
                  onBlur={onBlurBorder}
                  placeholder="홍길동"
                />
                <p
                  className="text-[10px] mt-1"
                  style={{ color: 'var(--muted)' }}
                >
                  배송 시 받는 분 이름의 기본값으로 사용돼요
                </p>
              </div>

              {/* 이메일 */}
              <div>
                <label
                  className="block text-[11px] font-bold mb-1.5"
                  style={{ color: 'var(--text)' }}
                >
                  이메일
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={baseInputCls}
                  style={baseInputStyle}
                  onFocus={onFocusBorder}
                  onBlur={onBlurBorder}
                  placeholder="example@email.com"
                />
              </div>

              {/* 비밀번호 */}
              <div>
                <label
                  className="block text-[11px] font-bold mb-1.5"
                  style={{ color: 'var(--text)' }}
                >
                  비밀번호
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${baseInputCls} pr-11`}
                    style={baseInputStyle}
                    onFocus={onFocusBorder}
                    onBlur={onBlurBorder}
                    placeholder="6자 이상"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 표시'}
                    className="absolute inset-y-0 right-2 my-auto h-8 w-8 flex items-center justify-center rounded-md hover:bg-black/5 transition"
                    style={{ color: 'var(--muted)' }}
                    tabIndex={-1}
                  >
                    {showPw ? (
                      <EyeOff className="w-4 h-4" strokeWidth={2} />
                    ) : (
                      <Eye className="w-4 h-4" strokeWidth={2} />
                    )}
                  </button>
                </div>
                <p
                  className="text-[10px] mt-1"
                  style={{ color: 'var(--muted)' }}
                >
                  영문, 숫자 포함 6자 이상 권장
                </p>
              </div>

              {/* 비밀번호 확인 */}
              <div>
                <label
                  className="block text-[11px] font-bold mb-1.5"
                  style={{ color: 'var(--text)' }}
                >
                  비밀번호 확인
                </label>
                <div className="relative">
                  <input
                    type={showPw2 ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className={`${baseInputCls} pr-11`}
                    style={{
                      ...baseInputStyle,
                      borderColor: passwordMismatch
                        ? 'var(--sale)'
                        : 'var(--rule-2)',
                    }}
                    onFocus={(e) => {
                      if (!passwordMismatch)
                        e.currentTarget.style.borderColor = 'var(--terracotta)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = passwordMismatch
                        ? 'var(--sale)'
                        : 'var(--rule-2)'
                    }}
                    placeholder="비밀번호 다시 입력"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw2((v) => !v)}
                    aria-label={showPw2 ? '비밀번호 숨기기' : '비밀번호 표시'}
                    className="absolute inset-y-0 right-2 my-auto h-8 w-8 flex items-center justify-center rounded-md hover:bg-black/5 transition"
                    style={{ color: 'var(--muted)' }}
                    tabIndex={-1}
                  >
                    {showPw2 ? (
                      <EyeOff className="w-4 h-4" strokeWidth={2} />
                    ) : (
                      <Eye className="w-4 h-4" strokeWidth={2} />
                    )}
                  </button>
                </div>
                {passwordMismatch && (
                  <p
                    className="text-[10.5px] mt-1 flex items-center gap-1 font-semibold"
                    style={{ color: 'var(--sale)' }}
                  >
                    <AlertCircle className="w-3 h-3" strokeWidth={2.5} />
                    비밀번호가 일치하지 않아요
                  </p>
                )}
                {!passwordMismatch &&
                  passwordConfirm.length > 0 &&
                  password.length >= 6 && (
                    <p
                      className="text-[10.5px] mt-1 flex items-center gap-1 font-semibold"
                      style={{ color: 'var(--moss)' }}
                    >
                      <Check className="w-3 h-3" strokeWidth={3} />
                      비밀번호가 일치해요
                    </p>
                  )}
              </div>

              {/* 휴대폰 번호 */}
              <div>
                <label
                  className="block text-[11px] font-bold mb-1.5"
                  style={{ color: 'var(--text)' }}
                >
                  휴대폰 번호
                </label>
                <input
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  enterKeyHint="next"
                  maxLength={13}
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  className={baseInputCls}
                  style={{
                    ...baseInputStyle,
                    borderColor: !phoneValid
                      ? 'var(--sale)'
                      : 'var(--rule-2)',
                  }}
                  onFocus={(e) => {
                    if (phoneValid)
                      e.currentTarget.style.borderColor = 'var(--terracotta)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = !phoneValid
                      ? 'var(--sale)'
                      : 'var(--rule-2)'
                  }}
                  placeholder="010-1234-5678"
                />
                {!phoneValid && (
                  <p
                    className="text-[10.5px] mt-1 flex items-center gap-1 font-semibold"
                    style={{ color: 'var(--sale)' }}
                  >
                    <AlertCircle className="w-3 h-3" strokeWidth={2.5} />
                    010으로 시작하는 10~11자리 숫자를 입력해 주세요
                  </p>
                )}
              </div>

              {/* 출생 연도 — 만 14세 미만 가입 차단 목적. 연도만 수집. */}
              <div>
                <label
                  className="block text-[11px] font-bold mb-1.5"
                  style={{ color: 'var(--text)' }}
                >
                  출생 연도
                </label>
                <select
                  required
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  className={baseInputCls}
                  style={{
                    ...baseInputStyle,
                    borderColor: birthYearUnder14
                      ? 'var(--sale)'
                      : 'var(--rule-2)',
                  }}
                >
                  <option value="">선택해 주세요</option>
                  {Array.from({ length: currentYear - MIN_BIRTH_YEAR + 1 }).map(
                    (_, i) => {
                      // 최근 해부터 과거로 (사용 빈도 가장 높은 성인 연령대가 상단)
                      const y = currentYear - i
                      return (
                        <option key={y} value={y}>
                          {y}년
                        </option>
                      )
                    },
                  )}
                </select>
                {birthYearUnder14 ? (
                  <p
                    className="text-[10.5px] mt-1 flex items-start gap-1 font-semibold leading-relaxed"
                    style={{ color: 'var(--sale)' }}
                  >
                    <AlertCircle
                      className="w-3 h-3 shrink-0 mt-0.5"
                      strokeWidth={2.5}
                    />
                    만 14세 미만은 가입할 수 없어요. 보호자와 상의해 주세요.
                  </p>
                ) : (
                  <p
                    className="text-[10px] mt-1"
                    style={{ color: 'var(--muted)' }}
                  >
                    만 14세 이상만 가입할 수 있어요 (개인정보보호법)
                  </p>
                )}
              </div>

              {/* 생일 (월/일) — 선택. 채우면 매년 생일 당일 쿠폰 자동 발송. */}
              <div>
                <label
                  className="flex items-center gap-1 text-[11px] font-bold mb-1.5"
                  style={{ color: 'var(--text)' }}
                >
                  생일 <span style={{ color: 'var(--muted)' }}>(선택)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={birthMonth}
                    onChange={(e) => setBirthMonth(e.target.value)}
                    className={baseInputCls}
                    style={baseInputStyle}
                  >
                    <option value="">월</option>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}월
                      </option>
                    ))}
                  </select>
                  <select
                    value={birthDay}
                    onChange={(e) => setBirthDay(e.target.value)}
                    className={baseInputCls}
                    style={baseInputStyle}
                  >
                    <option value="">일</option>
                    {Array.from({
                      length: birthMonth
                        ? new Date(
                            Number(birthYear) || 2000,
                            Number(birthMonth),
                            0,
                          ).getDate()
                        : 31,
                    }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}일
                      </option>
                    ))}
                  </select>
                </div>
                <p
                  className="text-[10px] mt-1"
                  style={{ color: 'var(--muted)' }}
                >
                  채우시면 생일 당일 쿠폰을 자동으로 보내드려요 (마케팅 수신
                  동의 필요)
                </p>
              </div>
            </div>
          </section>

          {/* ── 02 · Shipping · 기본 배송지 ───────────────────── */}
          <section>
            <div className="flex items-baseline gap-2.5 mb-3">
              <span
                className="font-serif leading-none tnum"
                style={{
                  color: 'var(--terracotta)',
                  fontSize: 16,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  fontVariantNumeric: 'lining-nums tabular-nums',
                }}
              >
                02
              </span>
              <span className="kicker">Shipping · 기본 배송지</span>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={zip}
                  readOnly
                  placeholder="우편번호"
                  className="flex-1 px-4 py-3 rounded-lg border text-sm"
                  style={{
                    borderColor: 'var(--rule-2)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                  }}
                />
                <AddressSearch
                  onComplete={handleAddressComplete}
                  className="shrink-0"
                />
              </div>
              <input
                type="text"
                required
                value={address}
                readOnly
                placeholder="주소 (검색 버튼으로 입력)"
                className="w-full px-4 py-3 rounded-lg border text-sm"
                style={{
                  borderColor: 'var(--rule-2)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                }}
              />
              <input
                type="text"
                autoComplete="address-line2"
                value={addressDetail}
                onChange={(e) => setAddressDetail(e.target.value)}
                placeholder="상세 주소 (동/호수 등)"
                className={baseInputCls}
                style={baseInputStyle}
                onFocus={onFocusBorder}
                onBlur={onBlurBorder}
              />
            </div>
            <p
              className="text-[10px] mt-1.5"
              style={{ color: 'var(--muted)' }}
            >
              체크아웃 시 기본 배송지로 자동 입력돼요
            </p>
          </section>

          {/* ── 03 · Invite · 초대 코드 ──────────────────────── */}
          <section>
            <div className="flex items-baseline gap-2.5 mb-3">
              <span
                className="font-serif leading-none tnum"
                style={{
                  color: 'var(--terracotta)',
                  fontSize: 16,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  fontVariantNumeric: 'lining-nums tabular-nums',
                }}
              >
                03
              </span>
              <span className="kicker">Invite · 초대 코드</span>
              <span
                className="ml-auto text-[10px] font-semibold"
                style={{ color: 'var(--muted)' }}
              >
                선택
              </span>
            </div>

            <div className="relative">
              <input
                type="text"
                value={referralCode}
                onChange={(e) =>
                  setReferralCode(e.target.value.toUpperCase().slice(0, 16))
                }
                className="w-full px-4 py-3 rounded-lg border text-sm font-mono tracking-widest focus:outline-none transition"
                style={{
                  borderColor: hasReferral
                    ? 'var(--terracotta)'
                    : 'var(--rule-2)',
                  background: '#FDFDFD',
                  color: 'var(--text)',
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = 'var(--terracotta)')
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = hasReferral
                    ? 'var(--terracotta)'
                    : 'var(--rule-2)')
                }
                placeholder="친구에게 받은 코드"
              />
              {hasReferral && (
                <div
                  className="absolute inset-y-0 right-3 my-auto h-6 flex items-center gap-1 px-2 rounded-full text-[9.5px] font-black"
                  style={{
                    background: 'var(--terracotta)',
                    color: 'var(--bg)',
                    letterSpacing: '0.04em',
                  }}
                >
                  <Check className="w-3 h-3" strokeWidth={3} />
                  +3,000P
                </div>
              )}
            </div>
            <p
              className="text-[10.5px] mt-1.5 font-semibold"
              style={{ color: 'var(--terracotta)' }}
            >
              코드를 입력하면 가입 시 3,000P를 추가로 드려요
            </p>
          </section>

          {error && (
            <div
              className="text-[12px] font-bold rounded-lg px-3.5 py-2.5 flex items-start gap-2"
              style={{
                color: 'var(--sale)',
                background: 'color-mix(in srgb, var(--sale) 6%, transparent)',
                boxShadow:
                  'inset 0 0 0 1px color-mix(in srgb, var(--sale) 25%, transparent)',
              }}
            >
              <AlertCircle
                className="w-4 h-4 shrink-0 mt-0.5"
                strokeWidth={2.5}
              />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div
              className="text-[12px] font-semibold rounded-lg px-3.5 py-2.5"
              style={{
                color: 'var(--muted)',
                background: 'var(--bg-2)',
              }}
            >
              {info}
            </div>
          )}

          {/* ── 04 · Consent · 약관 동의 ──────────────────── */}
          <section>
            <div className="flex items-baseline gap-2.5 mb-3">
              <span
                className="font-serif leading-none tnum"
                style={{
                  color: 'var(--terracotta)',
                  fontSize: 16,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  fontVariantNumeric: 'lining-nums tabular-nums',
                }}
              >
                04
              </span>
              <span className="kicker">Consent · 약관 동의</span>
            </div>

            <div
              className="rounded-2xl px-4 py-4 space-y-3"
              style={{
                background: 'var(--bg-2)',
                boxShadow: 'inset 0 0 0 1px var(--rule)',
              }}
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="w-4 h-4"
                  style={{ accentColor: 'var(--ink)' }}
                />
                <span
                  className="text-[12px] font-black"
                  style={{ color: 'var(--text)' }}
                >
                  전체 동의
                </span>
              </label>

              <div
                className="pt-3 space-y-2.5"
                style={{ borderTop: '1px solid var(--rule-2)' }}
              >
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeRequired}
                    onChange={(e) => setAgreeRequired(e.target.checked)}
                    className="mt-0.5 w-4 h-4"
                    style={{ accentColor: 'var(--ink)' }}
                  />
                  <span
                    className="text-[11.5px] leading-relaxed"
                    style={{ color: 'var(--text)' }}
                  >
                    <b style={{ color: 'var(--terracotta)' }}>[필수]</b> 만
                    14세 이상이며,{' '}
                    <Link
                      href="/legal/terms"
                      target="_blank"
                      className="underline underline-offset-2 font-bold"
                      style={{ color: 'var(--text)' }}
                    >
                      이용약관
                    </Link>
                    과{' '}
                    <Link
                      href="/legal/privacy"
                      target="_blank"
                      className="underline underline-offset-2 font-bold"
                      style={{ color: 'var(--text)' }}
                    >
                      개인정보처리방침
                    </Link>
                    에 동의합니다
                  </span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeMarketingEmail}
                    onChange={(e) =>
                      setAgreeMarketingEmail(e.target.checked)
                    }
                    className="mt-0.5 w-4 h-4"
                    style={{ accentColor: 'var(--muted)' }}
                  />
                  <span
                    className="text-[11.5px] leading-relaxed"
                    style={{ color: 'var(--muted)' }}
                  >
                    <span className="font-bold">[선택]</span> 혜택·이벤트
                    이메일 수신에 동의합니다
                  </span>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeMarketingSms}
                    onChange={(e) => setAgreeMarketingSms(e.target.checked)}
                    className="mt-0.5 w-4 h-4"
                    style={{ accentColor: 'var(--muted)' }}
                  />
                  <span
                    className="text-[11.5px] leading-relaxed"
                    style={{ color: 'var(--muted)' }}
                  >
                    <span className="font-bold">[선택]</span> 혜택·이벤트
                    SMS/카카오톡 수신에 동의합니다
                  </span>
                </label>
              </div>
            </div>
          </section>

          {/* Ink 계열 CTA */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-4 rounded-full font-bold text-[13.5px] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'var(--ink)',
              color: 'var(--bg)',
              letterSpacing: '-0.01em',
              boxShadow: '0 4px 14px rgba(30,26,20,0.25)',
            }}
          >
            {loading ? '가입 중...' : '회원가입 완료'}
          </button>
        </form>

        {/* 하단 링크 — 이미 카카오 가입 블록은 상단으로 이동했으므로
            여기엔 기존 사용자 로그인 유도 링크만 남는다. */}
        <div
          className="text-center mt-8 text-[12.5px]"
          style={{ color: 'var(--muted)' }}
        >
          이미 계정이 있으신가요?{' '}
          <Link
            href="/login"
            className="font-bold underline underline-offset-2"
            style={{ color: 'var(--terracotta)' }}
          >
            로그인
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function SignupPage() {
  // useSearchParams requires a Suspense boundary in Next 16.
  return (
    <Suspense
      fallback={
        <main
          className="min-h-screen flex items-center justify-center"
          style={{ background: 'var(--bg)' }}
        >
          <div
            className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{
              borderColor: 'var(--terracotta)',
              borderTopColor: 'transparent',
            }}
          />
        </main>
      }
    >
      <SignupForm />
    </Suspense>
  )
}
