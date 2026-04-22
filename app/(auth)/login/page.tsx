'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import KakaoLoginButton from '@/components/KakaoLoginButton'
import AuthHero from '@/components/auth/AuthHero'

/**
 * /login — 기존 계정 로그인.
 *
 * 톤: /signup과 같은 editorial hero + sans 폼. 색은 모두 토큰
 * (--ink, --bg, --terracotta, --muted, --rule, --rule-2, --moss, --sale,
 *  --text) 경유 — 하드코딩 hex 제거.
 */

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
  const urlErrorParam = searchParams.get('error')
  const urlError = urlErrorParam ? decodeURIComponent(urlErrorParam) : ''
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

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-10"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm">
        <AuthHero
          kicker="Welcome Back · 다시 만나요"
          title={<>다시 오셨군요</>}
          subtitle="계정으로 로그인하고 이어서 진행해 주세요."
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

        {/* "또는" 디바이더 */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px" style={{ background: 'var(--rule-2)' }} />
          <span className="kicker" style={{ color: 'var(--muted)' }}>
            Or
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--rule-2)' }} />
        </div>

        <KakaoLoginButton variant="login" />

        {/* 하단 링크 */}
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
