'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useResetLoadingOnRestore } from '@/lib/useResetLoadingOnRestore'
import {
  isNativeKakaoAvailable,
  loginWithKakaoNative,
} from '@/lib/auth/kakaoNative'

type Props = {
  /** Where to land after the OAuth dance finishes. Default: /dashboard */
  next?: string
  /** "로그인" vs "회원가입" context — only affects button text. */
  variant?: 'login' | 'signup'
  /** 리다이렉트 직전 1회 — GA 계측 등. 예외는 삼켜진다. */
  onBeforeRedirect?: () => void
  /**
   * 겉모양만 — 'app' = 앱 새 디자인('A 포스터', 2026-10-09 캔버스 W06·W27): 모서리 4 · 높이 56 · 17px 800.
   * 기본(웹)은 예전 알약 모양 그대로. 로그인 동작은 같다.
   */
  look?: 'web' | 'app' | 'flow'
  /** 버튼 글자 바꾸기 — 새 첫 화면 '카카오로 가입하고 시작'(시안 Y6). 없으면 variant 글자. */
  label?: string
}

/**
 * Kakao OAuth entry point. Triggers Supabase OAuth and redirects the browser
 * to Kakao. On return, `/auth/callback` exchanges the code for a session.
 */
export default function KakaoLoginButton({
  next = '/dashboard',
  variant = 'login',
  onBeforeRedirect,
  look = 'web',
  label: labelOverride,
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

    // ★네이티브(앱)에서는 카카오톡 앱 전환 로그인. 웹 방식은 iOS 에서 카카오톡을
    //   못 열기 때문이다 — 근거·함정은 lib/auth/kakaoNative.ts docstring 참조.
    //   실패하면 아래 웹 OAuth 로 **그대로 흘려보낸다**(카카오톡 미설치·플러그인
    //   이상 등에서 로그인 자체가 막히면 안 된다).
    // ⚠️ 전체를 try 로 감싼다. 여기서 예외가 새면 loading 이 true 로 남아
    //    **버튼이 영영 비활성('연결 중…')** 이 되고 오류 문구도 안 뜬다.
    //    화면 이동이 없으니 pageshow 복구도 안 걸린다. 실제 발생 경로가 있다:
    //    플러그인 import 는 **클릭 시점에 네트워크로 청크를 받아오는 동적 import**라
    //    (원격 URL WebView) 통신이 끊기면 그대로 throw 한다.
    if (isNativeKakaoAvailable()) {
      try {
        const native = await loginWithKakaoNative()
        if (native.ok) {
          const { error: idErr } = await supabase.auth.signInWithIdToken({
            provider: 'kakao',
            token: native.idToken,
          })
          if (!idErr) {
            // 세션은 만들어졌다. 로그인 후 공통 처리(탈퇴가드·출생연도·만14세)는
            // /auth/callback 정본이 담당하므로 그리로 넘긴다.
            window.location.href = redirectTo
            return
          }
          console.error('[kakao-login] id_token 교환 실패', idErr.message)
        } else if (native.reason === 'cancelled') {
          // 사용자가 카카오톡에서 취소 — 조용히 원상복귀(오류 문구 없음).
          setLoading(false)
          return
        } else {
          console.error('[kakao-login] 네이티브 실패', native.reason)
        }
      } catch (e) {
        // 폴백이 있으므로 사용자에게 알리지 않고 웹 방식으로 넘어간다.
        console.error('[kakao-login] 네이티브 예외', e)
      }
      // 여기까지 왔으면 네이티브가 안 된 것 — 웹 방식으로 폴백.
    }

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
    labelOverride ?? (variant === 'signup' ? '카카오로 가입하기' : '카카오로 시작하기')

  // 'flow' = 새 첫 화면(시안 Y6) — 같은 노랑, 둥근 알약(높이 58 · 모서리 29). 'app' = 로그인·가입(모서리 4 · 높이 56).
  if (look === 'app' || look === 'flow') {
    const flow = look === 'flow'
    return (
      <div>
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="active:opacity-80 disabled:opacity-60"
          style={{
            width: '100%',
            height: flow ? 58 : 56,
            border: 0,
            borderRadius: flow ? 29 : 4,
            background: '#FEE500',
            color: flow ? '#191600' : '#191919',
            fontFamily: 'inherit',
            fontSize: 17,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
          }}
        >
          <KakaoMark size={20} />
          {loading ? '연결 중...' : label}
        </button>
        {error && (
          <p role="alert" style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 700, lineHeight: 1.5, color: '#B23624' }}>
            {error}
          </p>
        )}
      </div>
    )
  }

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

function KakaoMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.81 1.82 5.27 4.59 6.73-.2.74-.72 2.68-.82 3.09-.13.51.19.5.39.36.16-.11 2.52-1.7 3.55-2.39.74.11 1.51.17 2.29.17 5.52 0 10-3.48 10-7.76S17.52 3 12 3z" />
    </svg>
  )
}
