'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AuthHero from '@/components/auth/AuthHero'

/**
 * /forgot-password — 비밀번호 재설정 메일 발송 (R89-E D7).
 *
 * # 흐름
 *  1. 사용자가 이메일 입력 → supabase.auth.resetPasswordForEmail 호출
 *  2. Supabase 가 reset 메일 발송 (Recovery 템플릿)
 *  3. 메일의 링크 클릭 → /reset-password (PKCE code 포함)
 *  4. /reset-password 가 새 비밀번호 입력 폼 + updateUser 호출
 *
 * # enumeration 방어
 *
 * 에러 여부와 무관하게 "메일을 보냈어요" 일관 카피. supabase 의
 * resetPasswordForEmail 은 가입 안 된 이메일에 대해 silently no-op
 * (성공 응답) — 우리도 같은 톤으로 노출.
 *
 * # rate limit
 *
 * Supabase 가 IP+이메일 기준 자동 throttling (분당 ~5회). 추가
 * 클라이언트 가드 — 같은 세션에서 30초 내 재발송 차단.
 */
export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [lastSentAt, setLastSentAt] = useState<number | null>(null)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // 30초 throttle — Supabase 자체 throttle 위에 UX 가드.
    if (lastSentAt && Date.now() - lastSentAt < 30_000) {
      setError(
        '같은 이메일로 30초 안에 재발송할 수 없어요. 메일함을 먼저 확인해 주세요.',
      )
      return
    }

    if (!email.trim() || !email.includes('@')) {
      setError('올바른 이메일 주소를 입력해 주세요.')
      return
    }

    setLoading(true)

    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://www.farmerstail.kr'

    // resetPasswordForEmail 자체는 가입 안 된 이메일에도 silent 성공 응답 —
    // enumeration 방어. 단, 네트워크/서버 오류 (status 5xx) 만 에러로 노출.
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${origin}/reset-password` },
    )

    setLoading(false)

    if (resetErr && resetErr.status && resetErr.status >= 500) {
      // 서버 오류만 에러로 노출 (enumeration 우려 없음).
      setError('일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.')
      return
    }

    // 그 외는 항상 성공 화면으로 — 가입 여부 노출 X.
    setSubmitted(true)
    setLastSentAt(Date.now())
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-10 md:py-16"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm md:max-w-md">
        <AuthHero
          kicker="Reset · 비밀번호 재설정"
          title={<>비밀번호 찾기</>}
          subtitle="가입한 이메일을 입력하시면 재설정 링크를 보내드려요."
        />

        {submitted ? (
          <div
            className="rounded-xl px-4 py-5 mb-5"
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
                  className="text-[12.5px] font-bold leading-relaxed"
                  style={{ color: 'var(--text)' }}
                >
                  메일을 보냈어요
                </p>
                <p
                  className="text-[11.5px] mt-2 leading-relaxed"
                  style={{ color: 'var(--muted)' }}
                >
                  {email} 로 재설정 링크를 보냈어요. 메일이 안 보이면
                  스팸함도 확인해 주세요. 링크는 1시간 동안 유효해요.
                </p>
                <p
                  className="text-[11px] mt-3 leading-relaxed"
                  style={{ color: 'var(--muted)' }}
                >
                  (가입하지 않은 이메일은 메일이 발송되지 않아요.)
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block text-[11px] font-bold mb-1.5"
                htmlFor="forgot-email"
                style={{ color: 'var(--text)' }}
              >
                이메일
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border text-[16px] focus:outline-none transition"
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

            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="text-[12px] font-bold rounded-lg px-3.5 py-2.5 flex items-start gap-2"
                style={{
                  color: 'var(--sale)',
                  background:
                    'color-mix(in srgb, var(--sale) 6%, transparent)',
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
              {loading ? '발송 중...' : '재설정 메일 보내기'}
            </button>
          </form>
        )}

        <div
          className="text-center mt-8 text-[12.5px]"
          style={{ color: 'var(--muted)' }}
        >
          비밀번호가 기억나셨나요?{' '}
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
