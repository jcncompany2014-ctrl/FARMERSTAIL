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

/**
 * 네이티브 카카오 로그인을 **써야 하는** 환경인가.
 *
 * ⚠️ **iOS 로 한정한다. `isNativePlatform()` 만 보면 안드로이드도 참이다.**
 *  · 안드로이드는 **웹 방식으로도 카카오톡 앱 전환이 된다**(카카오가 안드로이드
 *    모바일 웹만 지원하는 기능 — 애초에 이 작업이 iOS 전용인 이유). 즉 네이티브가
 *    필요 없다.
 *  · 그리고 안드로이드 네이티브 설정(AndroidManifest 의 AuthCodeHandlerActivity,
 *    Kakao 콘솔 키 해시 등록)을 하지 않았으므로 시도하면 실패한다. 실패는
 *    `cancelled` 로 취급돼 **아무 일도 일어나지 않는 화면**이 된다 — 이미 스토어에
 *    올라간 안드로이드 앱에 회귀를 내는 셈이다.
 *  나중에 안드로이드도 네이티브로 가려면 위 설정을 먼저 하고 이 조건을 넓힌다.
 */
export function isNativeKakaoAvailable(): boolean {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'ios' &&
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
          // ⚠️ 실패와 '사용자가 취소' 를 구분한다. 둘 다 취소로 뭉뚱그리면 진짜
          //    실패했을 때 **눌러도 아무 일 안 일어나는 화면**이 된다(폴백을 안 타서).
          //    확실히 취소일 때만 조용히 멈추고, 애매하면 웹 로그인으로 흘려보낸다
          //    — 로그인이 아예 막히는 것보다 낫다(되돌아오기는 가장자리 스와이프로 가능).
          const msg = (data?.error ?? '').toLowerCase()
          const userCancelled = /cancel|취소/.test(msg)
          resolve({ ok: false, reason: userCancelled ? 'cancelled' : 'failed' })
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
