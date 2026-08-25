'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useResetLoadingOnRestore } from '@/lib/useResetLoadingOnRestore'

type Props = {
  /** Where to land after the OAuth dance finishes. Default: /dashboard */
  next?: string
  /** "로그인" vs "회원가입" context — only affects button text. */
  variant?: 'login' | 'signup'
  /** 리다이렉트 직전 1회 — GA 계측 등. 예외는 삼켜진다. */
  onBeforeRedirect?: () => void
}

/**
 * Kakao OAuth entry point. Triggers Supabase OAuth and redirects the browser
 * to Kakao. On return, `/auth/callback` exchanges the code for a session.
 */
export default function KakaoLoginButton({
  next = '/dashboard',
  variant = 'login',
  onBeforeRedirect,
}: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 카카오 화면에서 뒤로(iOS 가장자리 스와이프 등) 돌아오면 '연결 중…'이 굳는다.
  useResetLoadingOnRestore(useCallback(() => setLoading(false), []))

  async function handleClick() {
    // 계측 등 부수 훅 — 실패해도 로그인 흐름을 막지 않는다(최종감사 #16).
    try {
      onBeforeRedirect?.()
    } catch {
      /* noop */
    }
    setError('')
    setLoading(true)
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
      next
    )}`

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo },
    })

    if (oauthError) {
      setLoading(false)
      // 영문 OAuth 원문을 서비스 첫 관문에 노출하지 않는다(2026-08-07 감사).
      setError(
        '카카오 로그인이 되지 않았어요. 잠시 후 다시 시도하거나 이메일로 로그인해 주세요.',
      )
      console.error('[kakao-login] 실패', oauthError.message)
      return
    }
    // Browser will navigate to Kakao — no further UI update needed.
  }

  const label =
    variant === 'signup' ? '카카오로 가입하기' : '카카오로 시작하기'

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 h-[58px] rounded-full bg-[#FEE500] text-[#191919] font-bold text-[15px] active:scale-[0.98] transition-all disabled:opacity-60"
      >
        <KakaoMark />
        {loading ? '연결 중...' : label}
      </button>
      {error && (
        <div className="mt-2 text-[11px] text-sale font-semibold">
          {error}
        </div>
      )}
    </div>
  )
}

function KakaoMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.81 1.82 5.27 4.59 6.73-.2.74-.72 2.68-.82 3.09-.13.51.19.5.39.36.16-.11 2.52-1.7 3.55-2.39.74.11 1.51.17 2.29.17 5.52 0 10-3.48 10-7.76S17.52 3 12 3z" />
    </svg>
  )
}
