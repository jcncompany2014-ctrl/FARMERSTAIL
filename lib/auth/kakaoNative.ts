'use client'

import { Capacitor } from '@capacitor/core'

/**
 * 카카오톡 앱 전환 로그인 (iOS 네이티브).
 *
 * # 왜 이게 필요한가
 * 웹 방식(Supabase OAuth → kauth.kakao.com)은 **iOS 에서 카카오톡을 못 연다.**
 * 카카오가 로그인 페이지에 `showWebTalkLogin:false` 를 내려보내고, 카카오 문서상
 * 모바일 웹의 카카오톡 간편로그인은 **안드로이드 전용**이다(2026-08-25 실측:
 * UA 를 모바일 사파리로 바꿔 요청해도 응답 동일). 한국 사용자는 카카오 비밀번호를
 * 기억하지 못해 이 지점에서 이탈하므로 가입 전환율 문제다.
 *
 * # 흐름
 * 카카오톡 앱에서 승인 → 플러그인이 `id_token` 전달 → Supabase
 * `signInWithIdToken` 으로 세션 생성 → `/auth/callback` 으로 이동해 **로그인 후
 * 공통 처리**(탈퇴 계정 차단·출생연도·만 14세 게이트)를 그대로 태운다.
 *
 * # 플러그인 API 의 함정 (원본 그대로라 여기서 감싼다)
 * `prompt()` 는 **로그인이 끝나기 전에 즉시 resolve** 하고, 결과는 `callback`
 * 이벤트로 따로 온다. 그래서 await 로 결과를 받을 수 없다 — 아래처럼
 * **리스너를 먼저 걸고** 이벤트를 기다리는 promise 로 감싼다.
 * 또 `id_token` 이 없으면 **빈 문자열**이 오므로(nil → "") 반드시 걸러야 한다.
 * 안 그러면 "로그인은 됐는데 회원 처리가 조용히 안 되는" 상태가 된다.
 */

/** 카카오 플러그인이 실제로 붙어 있는 네이티브 환경인가. */
export function isNativeKakaoAvailable(): boolean {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.isPluginAvailable('CapacitorKakaoLogin')
  )
}

export type NativeKakaoResult =
  | { ok: true; idToken: string }
  | { ok: false; reason: 'cancelled' | 'no_id_token' | 'failed' }

/** 사용자가 카카오톡에서 승인/취소할 때까지 기다리는 시간. */
const TIMEOUT_MS = 3 * 60 * 1000

export async function loginWithKakaoNative(): Promise<NativeKakaoResult> {
  const { CapacitorKakaoLogin } = await import(
    '@farmerstail/capacitor-kakao-login'
  )

  // ⚠️ 순서 중요 — prompt() 보다 리스너를 **먼저** 건다.
  let handle: { remove: () => Promise<void> } | undefined
  try {
    const result = await new Promise<NativeKakaoResult>((resolve) => {
      const timer = setTimeout(
        () => resolve({ ok: false, reason: 'cancelled' }),
        TIMEOUT_MS,
      )

      void CapacitorKakaoLogin.addListener('callback', (data) => {
        clearTimeout(timer)
        if (!data?.success) {
          // 사용자가 카카오톡에서 취소한 경우가 대부분 — 오류로 시끄럽게 굴지 않는다.
          resolve({ ok: false, reason: 'cancelled' })
          return
        }
        const idToken = (data.id_token ?? '').trim()
        if (!idToken) {
          // OIDC 가 꺼져 있거나 카카오가 토큰을 안 준 경우. 여기서 막지 않으면
          // 로그인한 것처럼 보이는데 세션이 안 생긴다.
          resolve({ ok: false, reason: 'no_id_token' })
          return
        }
        resolve({ ok: true, idToken })
      }).then((h) => {
        handle = h
      })

      // 이건 로그인 완료를 기다리지 않고 곧바로 반환된다(위 docstring 참조).
      void CapacitorKakaoLogin.prompt({ scopes: ['openid'] }).catch(() => {
        clearTimeout(timer)
        resolve({ ok: false, reason: 'failed' })
      })
    })
    return result
  } finally {
    await handle?.remove().catch(() => {})
  }
}
