'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AuthHero from '@/components/auth/AuthHero'

/**
 * /reset-password — Supabase recovery 세션에서 새 비밀번호 설정 (R89-E D7).
 *
 * # 흐름
 *  1. /forgot-password 에서 resetPasswordForEmail({ redirectTo: '/reset-password' })
 *  2. Supabase 가 메일 발송 → 사용자가 링크 클릭
 *  3. PKCE flow: URL 에 `?code=...` 가 붙어 이 페이지 진입
 *  4. mount 시 supabase.auth.exchangeCodeForSession(code) 으로 세션 교환
 *  5. 사용자가 새 비밀번호 입력 → supabase.auth.updateUser({ password })
 *  6. 성공 → /login 으로 redirect ("재설정 완료" 안내)
 *
 * # 보안
 *
 * recovery 세션은 password 변경 직후 무효화되지 않으므로 변경 직후
 * signOut() 호출. 다음 로그인은 새 비밀번호로.
 *
 * # 에러
 *
 * - 만료된 링크 (코드 만료): "링크가 만료됐어요" → /forgot-password 로 유도
 * - 이미 사용된 링크 (재사용 차단): 같은 카피
 * - 약한 비밀번호: 인라인 메시지
 */
export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [exchanging, setExchanging] = useState(true)
  const [exchangeError, setExchangeError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState('')
  const [done, setDone] = useState(false)

  // Mount 시 URL 의 code 를 세션으로 교환.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      if (!code) {
        if (!cancelled) {
          setExchangeError(
            '재설정 링크가 유효하지 않아요. 다시 메일을 받아 주세요.',
          )
          setExchanging(false)
        }
        return
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (cancelled) return
      if (error) {
        // 만료 / 재사용 / 변조 — 공통 메시지 (raw 노출 X)
        setExchangeError(
          '재설정 링크가 만료됐거나 이미 사용됐어요. 메일을 다시 받아 주세요.',
        )
      }
      setExchanging(false)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const mismatch = confirm.length > 0 && password !== confirm

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setUpdateError('')

    if (password.length < 6) {
      setUpdateError('비밀번호는 6자 이상이어야 해요.')
      return
    }
    if (password !== confirm) {
      setUpdateError('비밀번호가 일치하지 않아요.')
      return
    }

    setUpdating(true)
    const { error } = await supabase.auth.updateUser({ password })
    setUpdating(false)

    if (error) {
      const raw = (error.message ?? '').toLowerCase()
      if (raw.includes('weak') || raw.includes('password')) {
        setUpdateError(
          '비밀번호 정책에 맞지 않아요. 영문·숫자 포함 6자 이상으로 다시 입력해 주세요.',
        )
      } else {
        setUpdateError('비밀번호를 변경하지 못했어요. 잠시 후 다시 시도해 주세요.')
      }
      return
    }

    // 변경 직후 recovery 세션 종료 → 새 비밀번호로 다시 로그인하도록.
    // R101: scope:'global' 로 전 디바이스 refresh token 폐기. 기본 signOut() 은
    // 현재 디바이스 세션만 종료해서, 계정 탈취 후 "비번 변경으로 차단" 을 시도해도
    // 공격자의 다른 기기 세션이 그대로 살아남는다(Supabase 는 비번 변경 시 다른
    // 세션을 자동 폐기하지 않음). 비밀번호 재설정의 핵심 목적이 계정 복구이므로 global.
    await supabase.auth.signOut({ scope: 'global' })
    setDone(true)

    // 3초 후 자동 이동
    setTimeout(() => {
      router.push('/login?reset=1')
    }, 3000)
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-10 md:py-16"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm md:max-w-md">
        <AuthHero
          kicker="Reset · 비밀번호 재설정"
          title={<>새 비밀번호</>}
          subtitle="새로운 비밀번호를 입력하시면 즉시 적용됩니다."
        />

        {exchanging ? (
          <div className="flex items-center justify-center py-10">
            <div
              className="w-8 h-8 border-2 rounded-full animate-spin"
              style={{
                borderColor: 'var(--terracotta)',
                borderTopColor: 'transparent',
              }}
            />
          </div>
        ) : exchangeError ? (
          <div
            className="rounded-xl px-4 py-4 mb-5"
            style={{
              background: 'color-mix(in srgb, var(--sale) 6%, transparent)',
              boxShadow:
                'inset 0 0 0 1px color-mix(in srgb, var(--sale) 25%, transparent)',
            }}
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle
                className="w-4 h-4 shrink-0 mt-0.5"
                strokeWidth={2.5}
                color="var(--sale)"
              />
              <div className="min-w-0">
                <p
                  className="text-[12.5px] font-bold leading-relaxed"
                  style={{ color: 'var(--sale)' }}
                >
                  {exchangeError}
                </p>
                <Link
                  href="/forgot-password"
                  className="inline-block mt-3 text-[12px] font-bold underline underline-offset-2"
                  style={{ color: 'var(--terracotta)' }}
                >
                  메일 다시 받기
                </Link>
              </div>
            </div>
          </div>
        ) : done ? (
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
                  className="text-[12.5px] font-bold"
                  style={{ color: 'var(--text)' }}
                >
                  비밀번호가 변경됐어요
                </p>
                <p
                  className="text-[11.5px] mt-1.5 leading-relaxed"
                  style={{ color: 'var(--muted)' }}
                >
                  잠시 후 로그인 페이지로 이동해요. 새 비밀번호로 다시
                  로그인해 주세요.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label
                className="block text-[11px] font-bold mb-1.5"
                htmlFor="new-password"
                style={{ color: 'var(--text)' }}
              >
                새 비밀번호
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-11 rounded-lg border text-[16px] focus:outline-none transition"
                  style={{
                    borderColor: 'var(--rule-2)',
                    background: '#FDFDFD',
                    color: 'var(--text)',
                  }}
                  placeholder="6자 이상"
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

            <div>
              <label
                className="block text-[11px] font-bold mb-1.5"
                htmlFor="confirm-password"
                style={{ color: 'var(--text)' }}
              >
                새 비밀번호 확인
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showPw2 ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full px-4 py-3 pr-11 rounded-lg border text-[16px] focus:outline-none transition"
                  style={{
                    borderColor: mismatch ? 'var(--sale)' : 'var(--rule-2)',
                    background: '#FDFDFD',
                    color: 'var(--text)',
                  }}
                  placeholder="비밀번호 다시 입력"
                />
                <button
                  type="button"
                  onClick={() => setShowPw2((v) => !v)}
                  aria-label={showPw2 ? '비밀번호 숨기기' : '비밀번호 표시'}
                  className="absolute inset-y-0 right-1 my-auto h-10 w-10 flex items-center justify-center rounded-md hover:bg-black/5 transition"
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
              {mismatch && (
                <p
                  className="text-[11px] mt-1 flex items-center gap-1 font-semibold"
                  style={{ color: 'var(--sale)' }}
                >
                  <AlertCircle className="w-3 h-3" strokeWidth={2.5} />
                  비밀번호가 일치하지 않아요
                </p>
              )}
            </div>

            {updateError && (
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
                <span>{updateError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={updating || mismatch || password.length < 6}
              className="w-full py-4 rounded-full font-bold text-[13.5px] active:scale-[0.98] transition-all disabled:opacity-50"
              style={{
                background: 'var(--ink)',
                color: 'var(--bg)',
                letterSpacing: '-0.01em',
                boxShadow: '0 4px 14px rgba(30,26,20,0.25)',
              }}
            >
              {updating ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
