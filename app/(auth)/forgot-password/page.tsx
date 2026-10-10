'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useServerAppContext } from '@/components/app/ServerAppContext'
import ForgotPasswordAppView from '@/components/v3/auth/ForgotPasswordAppView'
import ForgotPasswordWebView from '@/components/store/ForgotPasswordWebView'

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
  const appLook = useServerAppContext()
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

  // 앱 새 디자인('A 포스터', 2026-10-09 캔버스 W07·W08) — 앱이면 앱 화면 부품으로 그린다(판정 = (auth)/layout 의 서버 값).
  //   메일 보내기·재발송 막기·가입 여부 숨기기는 위 handleSubmit 그대로.
  if (appLook) {
    return (
      <ForgotPasswordAppView
        submitted={submitted}
        email={email}
        onEmailChange={setEmail}
        loading={loading}
        error={error}
        onSubmit={handleSubmit}
      />
    )
  }

  // 웹 = 웹 시안 WEB-A03·A04(2026-10-10 웹 리뉴얼) — 새 웹 가게 틀. 예전 웹 판(AuthHero)은 git 이력.
  return (
    <ForgotPasswordWebView
      submitted={submitted}
      email={email}
      onEmailChange={setEmail}
      loading={loading}
      error={error}
      onSubmit={handleSubmit}
    />
  )
}
