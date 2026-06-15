'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import KakaoLoginButton from '@/components/KakaoLoginButton'
import AppleLoginButton from '@/components/AppleLoginButton'
import { Eyebrow, PhotoSlot } from '@/components/web/fd/ui'
import { useIsAppContext } from '@/hooks/useIsAppContext'
import {
  applySignupProfile,
  normalizeSignupMeta,
} from '@/lib/auth/applySignupProfile'

/**
 * /login — 기존 계정 로그인 (FD 2단 split 재설계, 회차129).
 *
 * 레이아웃: 데스크톱 좌 파인 브랜드 패널(로고 + Eyebrow + 헤드라인 + 혜택
 * 리스트 + PhotoSlot) / 우 폼 컬럼, 모바일은 위→아래로 스택. /signup 과 동일한
 * FD 언어 — components/web/fd 프리미티브(Eyebrow·PhotoSlot) + --fd-* 토큰만
 * 사용(옛 v4 토큰 0). 카카오·애플 OAuth 를 이메일 폼 위로 승격(한국 유저 단축
 * 경로). 에러/검증 상태는 signup 과 공유하는 destructive 토큰 --sale.
 *
 * 인증 로직은 보존(불변): soft-delete 가드 · Confirm-email 후 signup_profile
 * 복원(applySignupProfile) · app/web 분기(/dashboard vs /mypage/orders) ·
 * ?next= safe-redirect.
 */

/**
 * OAuth callback 에서 보낸 안정 에러 코드를 사용자용 한국어 카피로 변환.
 * 모르는 코드는 그대로 반환 — fallback (옛 링크 / 외부 직접 호출 등).
 *
 * SSOT: app/auth/callback/route.ts 의 코드 목록과 1:1 매핑.
 */
function humanizeAuthError(code: string): string {
  switch (code) {
    case 'oauth_provider_denied':
      return '로그인 동의가 취소됐어요. 다시 시도해 주세요.'
    case 'oauth_provider_error':
      return '소셜 로그인 제공자에서 문제가 발생했어요. 잠시 후 다시 시도해 주세요.'
    case 'oauth_missing_code':
      return '로그인 정보가 누락됐어요. 다시 로그인을 시도해 주세요.'
    case 'oauth_exchange_failed':
      return '로그인 세션을 만들지 못했어요. 페이지를 새로고침하고 다시 시도해 주세요.'
    case 'oauth_unexpected':
      return '예상하지 못한 문제가 있었어요. 잠시 후 다시 시도해 주세요.'
    case 'oauth_account_deleted':
      // R90-E H1 (D7): 탈퇴 처리된 계정 OAuth 로그인 시도.
      return '탈퇴 처리된 계정이에요. 새 계정으로 가입해 주세요.'
    default:
      // 옛 링크 호환을 위해 raw 메시지를 그대로. 단 너무 길면 잘라서.
      return code.length > 200 ? code.slice(0, 200) + '…' : code
  }
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  // app/web 분리 모델: 로그인 후 행선지가 다르다.
  //   • App (PWA / Capacitor) → /dashboard (케어 다이어리 home)
  //   • Web (브라우저)         → /mypage/orders (주문 확인 — 웹 접근 가능 surface)
  // useIsAppContext 가 SSR 시 null 이라도 OK — handleLogin 은 client 이벤트.
  const isApp = useIsAppContext()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  // Form-submission errors only — URL-driven errors are a derived value
  // below so we don't need a setState-in-effect round trip.
  const [formError, setFormError] = useState('')

  // Derived from the URL. Deriving avoids the react-hooks/set-state-in-effect
  // lint rule and eliminates the flash where the banner renders empty, then
  // populates.
  //
  // OAuth callback (app/auth/callback/route.ts) 은 안정 에러 코드를 보낸다 —
  // 여기서 한국어 카피로 매핑. 알 수 없는 코드는 그대로 노출 (fallback) —
  // 옛날 링크/외부에서 들어온 직접 호출 케이스 대비.
  const urlErrorParam = searchParams.get('error')
  const rawUrlError = urlErrorParam ? decodeURIComponent(urlErrorParam) : ''
  const urlError = rawUrlError ? humanizeAuthError(rawUrlError) : ''
  const error = formError || urlError
  const justDeleted = searchParams.get('deleted') === '1'
  // R89-E (D7): /reset-password 에서 비밀번호 변경 후 redirect.
  const justReset = searchParams.get('reset') === '1'

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setLoading(false)
      setFormError('이메일 또는 비밀번호가 올바르지 않아요')
      return
    }

    // R101-A: soft-delete 계정 가드. OAuth 콜백(app/auth/callback)은 deleted_at
    // 을 검사하는데 password 로그인엔 없어서, 운영자가 profiles.deleted_at 만 set
    // 한 (account_purge cron 이전) 계정이 이메일 로그인으로 통과했다. 동일 가드.
    const {
      data: { user: signedIn },
    } = await supabase.auth.getUser()
    if (signedIn) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('deleted_at')
        .eq('id', signedIn.id)
        .maybeSingle()
      if (profile?.deleted_at) {
        await supabase.auth.signOut()
        setLoading(false)
        setFormError(
          '탈퇴 처리된 계정이에요. 도움이 필요하면 고객센터로 문의해 주세요.',
        )
        return
      }

      // R-fix(이메일확인 데이터유실 복원): Confirm email 이 ON 이면 signUp 직후
      // 세션이 없어 프로필이 비어 있다. signUp 때 auth 메타데이터(signup_profile)
      // 에 보관해 둔 가입 입력값을 "첫 로그인"에 복원한다(이름·전화·주소·생일·
      // 마케팅동의·추천인보상·환영쿠폰). profiles.name 이 비어 있을 때만 실행(멱등)
      // 하고, 성공 후 메타데이터 PII 를 즉시 비운다(PIPA). 복원 실패는 로그인을
      // 막지 않는다 — 프로필은 마이페이지에서 수정 가능.
      try {
        const pending = normalizeSignupMeta(
          (signedIn.user_metadata as Record<string, unknown> | null)
            ?.signup_profile,
        )
        if (pending) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', signedIn.id)
            .maybeSingle()
          const needsRestore = !prof?.name || prof.name.trim().length === 0
          if (needsRestore) {
            const r = await applySignupProfile(supabase, signedIn.id, pending)
            if (r.underAge) {
              await supabase.auth.signOut()
              setLoading(false)
              setFormError('만 14세 미만은 가입할 수 없어요.')
              return
            }
          }
          // 복원 여부와 무관하게 메타데이터 PII 는 비운다(PIPA, fire-and-forget).
          supabase.auth
            .updateUser({ data: { signup_profile: null } })
            .catch(() => {})
        }
      } catch {
        /* 복원 실패는 로그인 자체를 막지 않는다 */
      }
    }

    setLoading(false)

    // 분기: 앱 사용자는 /dashboard (케어), 웹 사용자는 /mypage/orders (주문 확인).
    // ?next= 가 명시되어 있으면 그쪽 우선 (예: /checkout 으로 가다가 로그인 통과).
    // R101-B: /api 경로는 redirect 금지 (인증 직후 GET 으로 부작용 엔드포인트 유도 방어).
    const nextParam = searchParams.get('next')
    const safeNext =
      nextParam &&
      nextParam.startsWith('/') &&
      !nextParam.startsWith('//') &&
      !nextParam.startsWith('/api')
        ? nextParam
        : null
    const destination = safeNext ?? (isApp ? '/dashboard' : '/mypage/orders')
    router.push(destination)
    router.refresh()
  }

  return (
    <main
      className="min-h-screen grid lg:grid-cols-2"
      style={{ background: 'var(--fd-offwhite)' }}
    >
      {/* ── 좌: 브랜드 패널 (모바일=상단 밴드, 데스크톱=풀하이트 파인) ── */}
      <aside
        className="relative flex flex-col justify-center px-6 py-10 lg:px-14 lg:py-14 lg:min-h-screen"
        style={{ background: 'var(--fd-pine)', color: '#FFFFFF' }}
      >
        <Link href="/" aria-label="파머스테일 홈" className="inline-flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-brush.png"
            alt="Farmer's Tail"
            className="h-10 lg:h-12 w-auto"
            fetchPriority="high"
            style={{ filter: 'none' }}
          />
        </Link>

        <div className="mt-8 lg:mt-12 max-w-md">
          <Eyebrow color="var(--fd-green-soft)">Sign In · 로그인</Eyebrow>
          <h1
            className="mt-3 text-[28px] lg:text-[40px]"
            style={{ fontWeight: 900, letterSpacing: '-0.035em', lineHeight: 1.08 }}
          >
            반가워요,
            <br />
            우리 아이 식단 이어가기
          </h1>
          <p
            className="mt-4 text-[14px] lg:text-[15px]"
            style={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.65, maxWidth: 380 }}
          >
            계정이 있다면 로그인하고, 처음이라면 회원가입으로 시작해 주세요.
            우리 아이의 맞춤 식단과 기록이 그대로 이어집니다.
          </p>

          <ul className="mt-7 grid gap-2.5">
            {['맞춤 영양 분석과 기록 그대로', '정기배송 일정 관리', '언제든 해지 · 구속 없는 구독'].map((t) => (
              <li
                key={t}
                className="flex items-center gap-2.5 text-[13.5px]"
                style={{ color: 'rgba(255,255,255,0.9)' }}
              >
                <span
                  aria-hidden
                  className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: 'var(--fd-green-soft)' }}
                />
                {t}
              </li>
            ))}
          </ul>

          <div className="mt-8 hidden lg:block">
            <PhotoSlot
              label="반려견 / 브랜드 사진"
              sub="브랜드 이미지 자리"
              ratio="16 / 10"
              tone="green"
              rounded={12}
              className="w-full"
            />
          </div>
        </div>
      </aside>

      {/* ── 우: 폼 컬럼 ── */}
      <div className="flex flex-col px-6 py-10 lg:px-14 lg:py-14 lg:min-h-screen lg:justify-center">
        <div className="w-full max-w-md mx-auto">

        {/* R89-E (D7): 비밀번호 재설정 완료 안내 — /reset-password → /login?reset=1 */}
        {justReset && (
          <div
            className="mb-5 rounded-xl px-4 py-3.5"
            style={{
              background: 'color-mix(in srgb, var(--fd-green) 10%, transparent)',
              boxShadow:
                'inset 0 0 0 1px color-mix(in srgb, var(--fd-green) 30%, transparent)',
            }}
          >
            <div className="flex items-start gap-2.5">
              <CheckCircle2
                className="w-4 h-4 shrink-0 mt-0.5"
                strokeWidth={2.25}
                color="var(--fd-green)"
              />
              <div className="min-w-0">
                <p
                  className="text-[12px] font-bold"
                  style={{ color: 'var(--fd-pine)' }}
                >
                  비밀번호가 변경됐어요
                </p>
                <p
                  className="text-[11px] mt-1 leading-relaxed"
                  style={{ color: 'var(--fd-muted)' }}
                >
                  새 비밀번호로 로그인해 주세요.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 탈퇴 완료 안내 — /api/account/delete 후 router.replace('/login?deleted=1') */}
        {justDeleted && (
          <div
            className="mb-5 rounded-xl px-4 py-3.5"
            style={{
              background: 'color-mix(in srgb, var(--fd-green) 10%, transparent)',
              boxShadow:
                'inset 0 0 0 1px color-mix(in srgb, var(--fd-green) 30%, transparent)',
            }}
          >
            <div className="flex items-start gap-2.5">
              <CheckCircle2
                className="w-4 h-4 shrink-0 mt-0.5"
                strokeWidth={2.25}
                color="var(--fd-green)"
              />
              <div className="min-w-0">
                <p
                  className="text-[12px] font-bold"
                  style={{ color: 'var(--fd-pine)' }}
                >
                  탈퇴가 완료됐어요
                </p>
                <p
                  className="text-[11px] mt-1 leading-relaxed"
                  style={{ color: 'var(--fd-muted)' }}
                >
                  그동안 파머스테일을 이용해 주셔서 감사해요. 언제든 다시 찾아
                  주세요.
                </p>
              </div>
            </div>
          </div>
        )}

        {/*
          카카오 로그인 — 프라이머리 위치로 승격. signup 과 동일 원칙:
          한국 유저는 카카오로 훨씬 빠르게 로그인하므로 이메일 폼 위로
          올려 단축 경로로 둔다. 이메일은 카카오를 안 쓰는 유저를 위한
          fallback.
        */}
        <div className="mb-3 space-y-2">
          <KakaoLoginButton variant="login" />
          {/* Apple Guideline 4.8 — Kakao 와 동등 비중. iOS 빌드는 거부 사유
              해소 위해 동일 화면 노출, 웹은 미국/일본 사용자 도움. */}
          <AppleLoginButton variant="login" />
        </div>

        {/* "또는 이메일로" 디바이더 */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px" style={{ background: 'var(--fd-line)' }} />
          <span
            style={{ color: 'var(--fd-muted)', fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}
          >
            Or Email · 이메일로 로그인
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--fd-line)' }} />
        </div>

        {/* 폼 — 흰 카드 대신 종이 톤 지면 위에 직접. */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              className="block text-[11px] font-bold mb-1.5"
              style={{ color: 'var(--fd-pine)' }}
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
              className="w-full px-4 py-3 rounded-lg border text-sm focus:outline-none transition"
              style={{
                borderColor: 'var(--fd-line)',
                background: '#FFFFFF',
                color: 'var(--fd-pine)',
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = 'var(--fd-coral)')
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = 'var(--fd-line)')
              }
              placeholder="example@email.com"
            />
          </div>

          <div>
            <label
              className="block text-[11px] font-bold mb-1.5"
              style={{ color: 'var(--fd-pine)' }}
            >
              비밀번호
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                required
                autoComplete="current-password"
                enterKeyHint="go"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-11 rounded-lg border text-sm focus:outline-none transition"
                style={{
                  borderColor: 'var(--fd-line)',
                  background: '#FFFFFF',
                  color: 'var(--fd-pine)',
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = 'var(--fd-coral)')
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = 'var(--fd-line)')
                }
                placeholder="비밀번호를 입력하세요"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 표시'}
                className="absolute inset-y-0 right-1 my-auto h-10 w-10 flex items-center justify-center rounded-md hover:bg-black/5 transition"
                style={{ color: 'var(--fd-muted)' }}
                tabIndex={-1}
              >
                {showPw ? (
                  <EyeOff className="w-4 h-4" strokeWidth={2} />
                ) : (
                  <Eye className="w-4 h-4" strokeWidth={2} />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="text-[12px] font-bold rounded-lg px-3.5 py-2.5"
              style={{
                color: 'var(--sale)',
                background: 'color-mix(in srgb, var(--sale) 6%, transparent)',
                boxShadow:
                  'inset 0 0 0 1px color-mix(in srgb, var(--sale) 25%, transparent)',
              }}
            >
              {error}
            </div>
          )}

          {/* FD CTA — 파인 그린 pill (흰 텍스트 AA pass, 로그인 신뢰 톤). */}
          <button
            type="submit"
            disabled={loading}
            className="w-full font-bold text-[14px] active:translate-y-[1px] transition-all disabled:opacity-50"
            style={{
              height: 56,
              borderRadius: 9999,
              background: 'var(--fd-pine)',
              color: '#FFFFFF',
              letterSpacing: '-0.01em',
              boxShadow: '0 6px 18px -8px rgba(23,59,51,0.5)',
            }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* 하단 링크 — 회원가입 + 비밀번호 찾기 (R89-E D7). */}
        <div
          className="text-center mt-6 text-[12.5px]"
          style={{ color: 'var(--fd-muted)' }}
        >
          <Link
            href="/forgot-password"
            className="font-semibold underline underline-offset-2"
            style={{ color: 'var(--fd-muted)' }}
          >
            비밀번호를 잊으셨나요?
          </Link>
        </div>
        <div
          className="text-center mt-3 text-[12.5px]"
          style={{ color: 'var(--fd-muted)' }}
        >
          아직 계정이 없으신가요?{' '}
          <Link
            href="/signup"
            className="font-bold underline underline-offset-2"
            style={{ color: 'var(--fd-coral-text)' }}
          >
            회원가입
          </Link>
        </div>
        </div>
      </div>
    </main>
  )
}
