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

  /**
   * ★URL 의 재설정 증표를 **첫 렌더에서 스냅샷**한다 (2026-08-14 4라운드 감사).
   *
   * @supabase/ssr 의 createBrowserClient 는 `detectSessionInUrl` 이 기본 켜짐
   * 이라, 메일 링크로 이 페이지가 **새로 로드되면** 클라이언트가 스스로 `?code`
   * 를 교환하고 **URL 에서 code 를 지운다**(GoTrueClient: searchParams.delete
   * ('code') + history.replaceState). 그리고 PKCE 경로는 redirectType 이 null
   * 이라 'PASSWORD_RECOVERY' 도 안 쏜다 — 'SIGNED_IN' 이 나간다.
   *
   * 그런데 이 페이지는 effect 에서 `?code` 를 **다시 읽어** 직접 교환했다.
   * 이미 지워졌으면 code 가 없어 '재설정 링크가 유효하지 않아요', 아직 남아
   * 있으면 **두 번째 교환**이라 '만료됐거나 이미 사용됐어요' 가 뜬다.
   * 어느 쪽이든 정상 사용자가 실패 문구를 보고 메일을 다시 받는 무한 반복이다.
   *
   * 스냅샷을 **첫 렌더**에서 뜨는 이유: code 삭제는 토큰 교환 **네트워크 왕복
   * 뒤**에 일어나므로, 동기 렌더가 반드시 그보다 먼저다. (effect 시점은
   * 아슬아슬하다.) 증표 유무를 확실히 붙잡아 두면 "세션이 있으면 통과" 를
   * 안전하게 쓸 수 있다 — 증표 없이 그냥 들른 로그인 사용자에게 비밀번호
   * 변경 폼을 열어 주지 않는다.
   */
  const [urlProof] = useState<{ code: string | null; tokenHash: string | null }>(
    () => {
      if (typeof window === 'undefined') return { code: null, tokenHash: null }
      const q = new URL(window.location.href).searchParams
      return { code: q.get('code'), tokenHash: q.get('token_hash') }
    },
  )

  const [exchanging, setExchanging] = useState(true)
  const [exchangeError, setExchangeError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState('')
  const [done, setDone] = useState(false)

  // Mount 시 재설정 세션 확보 — 증표 종류에 따라 세 갈래.
  useEffect(() => {
    let cancelled = false
    const EXPIRED = '재설정 링크가 만료됐거나 이미 사용됐어요. 메일을 다시 받아 주세요.'
    ;(async () => {
      const { code, tokenHash } = urlProof

      if (!code && !tokenHash) {
        if (!cancelled) {
          setExchangeError(
            '재설정 링크가 유효하지 않아요. 다시 메일을 받아 주세요.',
          )
          setExchanging(false)
        }
        return
      }

      /**
       * ① token_hash — **브라우저 독립** 경로.
       *
       * PKCE 의 code_verifier 는 메일을 **요청한 그 브라우저**에만 있다. 그래서
       * 앱에서 재설정을 요청하고 메일앱 인앱브라우저나 Safari 에서 링크를 열면
       * code 교환이 100% 실패한다 — 그런데 문구는 '만료/사용됨' 이라, 고객은
       * 원인을 모른 채 메일을 계속 다시 받는다(가장 흔한 복구 동선이 막힌다).
       * verifyOtp 는 verifier 가 필요 없어 어느 브라우저에서 열어도 통한다.
       *
       * ⚠️ 이 갈래는 메일 템플릿이 `{{ .TokenHash }}` 링크를 보낼 때만 발화한다
       *    — supabase/email-templates/reset-password.html 을 Supabase 대시보드
       *    (Authentication → Email Templates)에 **붙여 넣어야** 적용된다.
       *    안 해도 아래 ②가 그대로 동작하므로 회귀는 없다.
       */
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash: tokenHash,
        })
        if (cancelled) return
        if (error) setExchangeError(EXPIRED)
        setExchanging(false)
        return
      }

      /**
       * ② code — 이미 교환됐는지 **먼저 확인**한다.
       *
       * getSession() 은 클라이언트 내부 초기화(=URL 자동 감지)가 끝나기를
       * 기다린 뒤 답하므로, 자동 교환이 이겼든 아직이든 여기서 판정이 갈린다.
       * 증표(code)가 URL 에 있었던 경우에만 여기 오므로, 그냥 들른 로그인
       * 사용자에게 폼이 열리지 않는다.
       */
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      if (session) {
        setExchanging(false)
        return
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code!)
      if (cancelled) return
      // 만료 / 재사용 / 변조 / 다른 브라우저 — 공통 메시지 (raw 노출 X)
      if (error) setExchangeError(EXPIRED)
      setExchanging(false)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, urlProof])

  const mismatch = confirm.length > 0 && password !== confirm

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setUpdateError('')

    if (password.length < 8) {
      setUpdateError('비밀번호는 영문·숫자 포함 8자 이상이어야 해요.')
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
      if (raw.includes('weak') || raw.includes('easy to guess') || raw.includes('pwned')) {
        setUpdateError('많이 알려져 유출된 적 있는 비밀번호예요. 다른 비밀번호로 바꿔 주세요.')
      } else if (raw.includes('password')) {
        setUpdateError('비밀번호는 영문·숫자·특수문자를 포함해 8자 이상이어야 해요.')
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
      style={{ background: 'var(--fd-offwhite)' }}
    >
      <div className="w-full max-w-sm md:max-w-md">
        <AuthHero
          kicker="Reset · 비밀번호 재설정"
          title={<>새 비밀번호</>}
          subtitle="새 비밀번호를 입력하면 바로 적용돼요."
        />

        {exchanging ? (
          <div className="flex items-center justify-center py-10">
            <div
              className="w-8 h-8 border-2 rounded-full animate-spin"
              style={{
                borderColor: 'var(--fd-coral)',
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
                  style={{ color: 'var(--fd-coral-text)' }}
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
                  className="text-[12.5px] font-bold"
                  style={{ color: 'var(--fd-pine)' }}
                >
                  비밀번호가 변경됐어요
                </p>
                <p
                  className="text-[11.5px] mt-1.5 leading-relaxed"
                  style={{ color: 'var(--fd-muted)' }}
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
                style={{ color: 'var(--fd-pine)' }}
              >
                새 비밀번호
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-11 rounded-lg border text-[16px] focus:outline-none transition"
                  style={{
                    borderColor: 'var(--fd-line)',
                    background: '#FFFFFF',
                    color: 'var(--fd-pine)',
                  }}
                  placeholder="영문·숫자 포함 8자 이상"
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

            <div>
              <label
                className="block text-[11px] font-bold mb-1.5"
                htmlFor="confirm-password"
                style={{ color: 'var(--fd-pine)' }}
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
                    borderColor: mismatch ? 'var(--sale)' : 'var(--fd-line)',
                    background: '#FFFFFF',
                    color: 'var(--fd-pine)',
                  }}
                  placeholder="비밀번호 다시 입력"
                />
                <button
                  type="button"
                  onClick={() => setShowPw2((v) => !v)}
                  aria-label={showPw2 ? '비밀번호 숨기기' : '비밀번호 표시'}
                  className="absolute inset-y-0 right-1 my-auto h-10 w-10 flex items-center justify-center rounded-md hover:bg-black/5 transition"
                  style={{ color: 'var(--fd-muted)' }}
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
              disabled={updating || mismatch || password.length < 8}
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
              {updating ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
