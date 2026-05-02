'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  /** OAuth dance 완료 후 이동할 경로. 기본: /dashboard */
  next?: string
  /** "로그인" vs "회원가입" 컨텍스트 — 버튼 카피만 변경. */
  variant?: 'login' | 'signup'
}

/**
 * Sign in with Apple — Supabase OAuth 의 'apple' provider 트리거.
 *
 * # 왜 필요한가
 *
 * Apple App Store **Guideline 4.8**: 서드파티 소셜 로그인(우리는 Kakao)을
 * 제공하면 iOS 앱은 Sign in with Apple 을 동등 비중으로 제공해야 함. 누락 시
 * **거의 100% 거부 사유**. 웹/Android 에선 표시 의무 없지만, native iOS 빌드
 * 에서 같은 화면을 공유하므로 항상 노출하되 카카오와 동등한 시각 비중.
 *
 * # 사전 준비 (사용자 작업)
 * 1. Apple Developer → Certificates, Identifiers & Profiles → Services IDs 에
 *    `com.farmerstail.app.signin` 같은 식별자 생성, "Sign In with Apple"
 *    capability 활성.
 * 2. Domain & subdomain: `farmerstail.kr` (또는 master 도메인) 등록.
 * 3. Return URL: `https://[supabase-project].supabase.co/auth/v1/callback`.
 * 4. Apple Developer → Keys → Sign in with Apple Key 생성, .p8 파일 다운로드.
 * 5. Supabase Auth → Providers → Apple 활성:
 *    - Services ID
 *    - Team ID (10자)
 *    - Key ID + .p8 파일 내용
 * 6. iOS native 빌드 시 Xcode "Signing & Capabilities" 에 Sign in with Apple
 *    capability 추가.
 *
 * # 동작 분기
 * - 웹/Android: Supabase OAuth → Apple 로그인 페이지 → callback.
 * - iOS native (Capacitor): 시스템 Sign in with Apple sheet 가 권장이지만
 *   Capacitor 8 + Supabase 조합에선 OAuth web flow 도 정상 동작. 추후
 *   `@capacitor-community/apple-sign-in` 으로 native sheet 전환 검토.
 */
export default function AppleLoginButton({
  next = '/dashboard',
  variant = 'login',
}: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // NEXT_PUBLIC_* 는 build-time 에 inline 되므로 useState lazy initializer 로
  // 1회만 평가하면 충분. 이전엔 useEffect 안에서 setState 하다가 React 19
  // `react-hooks/set-state-in-effect` 룰에 걸려 추가 render 가 끼었다.
  const [shouldRender] = useState(
    () => process.env.NEXT_PUBLIC_DISABLE_SIWA !== '1',
  )

  async function handleClick() {
    setError('')
    setLoading(true)
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
      next,
    )}`

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo },
    })

    if (oauthError) {
      setLoading(false)
      // Apple Provider 미설정 시 supabase 가 'Provider not enabled' 메시지 반환.
      // 운영자에게 설정 안내, 사용자에겐 단순 안내로.
      const msg = oauthError.message?.includes('not enabled')
        ? 'Apple 로그인을 준비 중이에요. 잠시 후 다시 시도해 주세요.'
        : 'Apple 로그인에 실패했어요: ' + oauthError.message
      setError(msg)
    }
  }

  if (!shouldRender) return null

  const label = variant === 'signup' ? 'Apple 로 가입하기' : 'Apple 로 시작하기'

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        // Apple HIG 색상: 시스템 black on white 또는 white on black. 라이트
        // 톤 사이트라 black 박스가 가장 클래식. 카카오 노랑과 시각적 균형.
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-black text-white font-bold text-[14px] active:scale-[0.98] transition-all disabled:opacity-60"
        aria-label={label}
      >
        <AppleMark />
        {loading ? '연결 중...' : label}
      </button>
      {error && (
        <div className="mt-2 text-[11px] text-sale font-semibold">{error}</div>
      )}
    </div>
  )
}

/**
 * Apple 로고 SVG — Apple HIG 가이드라인 변형 사용 (단순 black/white outline).
 * 정식 Apple 로고는 라이선스가 있으므로 시스템 SF Symbol 'apple.logo' 와 시각
 * 적으로 유사한 일반 사과 모양 outline. App Store 심사 시 시스템 native sheet
 * (apple-sign-in plugin) 로 전환하면 자동으로 정확한 로고 사용.
 */
function AppleMark() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M17.05 12.04c-.03-2.93 2.4-4.34 2.5-4.4-1.36-1.99-3.48-2.27-4.24-2.3-1.81-.18-3.53 1.07-4.45 1.07-.93 0-2.34-1.04-3.85-1.01-1.98.03-3.81 1.15-4.83 2.92-2.06 3.57-.53 8.85 1.49 11.75.98 1.42 2.15 3.02 3.69 2.96 1.48-.06 2.04-.96 3.83-.96 1.79 0 2.29.96 3.86.93 1.59-.03 2.6-1.45 3.57-2.88 1.13-1.65 1.6-3.25 1.62-3.34-.03-.01-3.11-1.19-3.14-4.74zM14.16 3.6c.81-.99 1.36-2.36 1.21-3.72-1.17.05-2.59.78-3.43 1.77-.75.87-1.41 2.27-1.23 3.6 1.31.1 2.65-.66 3.45-1.65z" />
    </svg>
  )
}
