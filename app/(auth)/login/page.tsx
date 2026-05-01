'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import KakaoLoginButton from '@/components/KakaoLoginButton'
import AppleLoginButton from '@/components/AppleLoginButton'
import AuthHero from '@/components/auth/AuthHero'
import { useIsAppContext } from '@/hooks/useIsAppContext'

/**
 * /login — 기존 계정 로그인.
 *
 * 톤: /signup과 같은 editorial hero + sans 폼. 색은 모두 토큰
 * (--ink, --bg, --terracotta, --muted, --rule, --rule-2, --moss, --sale,
 *  --text) 경유 — 하드코딩 hex 제거.
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
      return '예상치 못한 오류가 발생했어요. 잠시 후 다시 시도해 주세요.'
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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setFormError('이메일 또는 비밀번호가 올바르지 않아요')
      return
    }

    // 분기: 앱 사용자는 /dashboard (케어), 웹 사용자는 /mypage/orders (주문 확인).
    // ?next= 가 명시되어 있으면 그쪽 우선 (예: /checkout 으로 가다가 로그인 통과).
    const nextParam = searchParams.get('next')
    const safeNext =
      nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
        ? nextParam
        : null
    const destination = safeNext ?? (isApp ? '/dashboard' : '/mypage/orders')
    router.push(destination)
    router.refresh()
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-10 md:py-16"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm md:max-w-md">
        {/*
          랜딩 "시작하기" 버튼이 이 페이지로 직접 오기 때문에,
          카피는 returning user 에만 맞춰선 안 된다 ("다시 오셨군요" 금지).
          첫 방문자는 바로 아래 "회원가입" 링크로 갈 수 있도록 가이드하고,
          문구는 재방문/첫방문 모두에 자연스러운 중립 톤으로 둔다.
        */}
        <AuthHero
          kicker="Sign In · 로그인"
          title={<>이메일로 로그인</>}
          subtitle="계정이 있다면 로그인하고, 처음이라면 아래에서 가입해 주세요."
        />

        {/* 탈퇴 완료 안내 — /api/account/delete 후 router.replace('/login?deleted=1') */}
        {justDeleted && (
          <div
            className="mb-5 rounded-xl px-4 py-3.5"
            style={{
              background: 'color-mix(in srgb, var(--moss) 10%, transparent)',
              boxShadow:
                'inset 0 0 0 1px color-mix(in srgb, var(--moss) 30%, transparent)',
            }}
          >
            <div className="flex items-start gap-2.5">
              <CheckCircle2
                className="w-4 h-4 shrink-0 mt-0.5"
                strokeWidth={2.25}
                color="var(--moss)"
              />
              <div className="min-w-0">
                <p
                  className="text-[12px] font-bold"
                  style={{ color: 'var(--text)' }}
                >
                  탈퇴가 완료됐어요
                </p>
                <p
                  className="text-[11px] mt-1 leading-relaxed"
                  style={{ color: 'var(--muted)' }}
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
          <div className="flex-1 h-px" style={{ background: 'var(--rule-2)' }} />
          <span
            className="kicker"
            style={{ color: 'var(--muted)', fontSize: 9 }}
          >
            Or Email · 이메일로 로그인
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--rule-2)' }} />
        </div>

        {/* 폼 — 흰 카드 대신 종이 톤 지면 위에 직접. */}
        <form onSubmit={handleLogin} className="space-y-4">
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
              className="w-full px-4 py-3 rounded-lg border text-sm focus:outline-none transition"
              style={{
                borderColor: 'var(--rule-2)',
                background: '#FDFDFD',
                color: 'var(--text)',
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = 'var(--terracotta)')
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = 'var(--rule-2)')
              }
              placeholder="example@email.com"
            />
          </div>

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
                autoComplete="current-password"
                enterKeyHint="go"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-11 rounded-lg border text-sm focus:outline-none transition"
                style={{
                  borderColor: 'var(--rule-2)',
                  background: '#FDFDFD',
                  color: 'var(--text)',
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = 'var(--terracotta)')
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = 'var(--rule-2)')
                }
                placeholder="비밀번호를 입력하세요"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 표시'}
                className="absolute inset-y-0 right-1 my-auto h-10 w-10 flex items-center justify-center rounded-md hover:bg-black/5 transition"
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
          </div>

          {error && (
            <div
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

          {/* Ink 계열 CTA — 온보딩 '시작하기'와 동일 톤. */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-full font-bold text-[13.5px] active:scale-[0.98] transition-all disabled:opacity-50"
            style={{
              background: 'var(--ink)',
              color: 'var(--bg)',
              letterSpacing: '-0.01em',
              boxShadow: '0 4px 14px rgba(30,26,20,0.25)',
            }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* 하단 링크 — 카카오 블록은 상단으로 승격됐으므로 여기엔
            회원가입 유도 링크만 남는다. */}
        <div
          className="text-center mt-8 text-[12.5px]"
          style={{ color: 'var(--muted)' }}
        >
          아직 계정이 없으신가요?{' '}
          <Link
            href="/signup"
            className="font-bold underline underline-offset-2"
            style={{ color: 'var(--terracotta)' }}
          >
            회원가입
          </Link>
        </div>
      </div>
    </main>
  )
}
