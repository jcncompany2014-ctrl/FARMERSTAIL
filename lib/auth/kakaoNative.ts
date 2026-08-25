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
 * 이벤트로 따로 온다. 그래서 await 로 결과를 받을 수 없다.
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
 *    Kakao 콘솔 키 해시 등록)을 하지 않았으므로 시도하면 실패한다.
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

/**
 * 사용자가 카카오톡에서 승인/취소할 때까지 기다리는 시간.
 * 넘기면 `failed` — `cancelled` 가 아니다. 아래 주석 참조.
 */
const TIMEOUT_MS = 3 * 60 * 1000

export async function loginWithKakaoNative(): Promise<NativeKakaoResult> {
  const { CapacitorKakaoLogin } = await import(
    '@farmerstail/capacitor-kakao-login'
  )

  let settle: (r: NativeKakaoResult) => void = () => {}
  const done = new Promise<NativeKakaoResult>((resolve) => {
    settle = resolve
  })

  // ⚠️ 순서 — prompt() 보다 리스너를 **먼저, 등록이 끝날 때까지 await 해서** 건다.
  //    Capacitor 는 리스너가 없을 때 온 이벤트를 버린다. 그리고 handle 을 나중에
  //    받는 방식이면 먼저 끝나버렸을 때 리스너가 안 떨어져 누수가 난다.
  const handle = await CapacitorKakaoLogin.addListener('callback', (data) => {
    if (!data?.success) {
      // 실패와 '사용자가 취소' 를 구분한다. 둘 다 취소로 뭉뚱그리면 진짜 실패했을 때
      // **눌러도 아무 일 안 일어나는 화면**이 된다(폴백을 안 타서).
      // 확실히 취소일 때만 조용히 멈추고, 애매하면 웹 로그인으로 흘려보낸다.
      // ⚠️ 이 판정은 플러그인이 넘기는 Swift `localizedDescription` 문자열에 기대므로
      //    **실기기에서 실제 문구를 확인하기 전까지는 미검증**이다. 틀려도 안전한
      //    방향으로 틀린다(취소가 failed 로 분류 → 웹 로그인이 열릴 뿐).
      const msg = (data?.error ?? '').toLowerCase()
      const userCancelled = /cancel|취소/.test(msg)
      settle({ ok: false, reason: userCancelled ? 'cancelled' : 'failed' })
      return
    }
    const idToken = (data.id_token ?? '').trim()
    if (!idToken) {
      // OIDC 가 꺼져 있거나 카카오가 토큰을 안 준 경우. 여기서 막지 않으면
      // 로그인한 것처럼 보이는데 세션이 안 생긴다.
      settle({ ok: false, reason: 'no_id_token' })
      return
    }
    settle({ ok: true, idToken })
  })

  const timer = setTimeout(() => {
    // ⚠️ 시간 초과는 **'failed'** 다. 'cancelled' 로 두면 폴백을 안 타서
    //    3분간 '연결 중…' 이다가 아무 일 없이 끝난다 — 이 파일이 막겠다고 적어둔
    //    바로 그 증상이다. 이벤트가 영영 안 오는 실제 경로가 있다(URL 스킴 어긋남,
    //    플러그인이 토큰·에러 둘 다 nil 일 때 아무것도 안 보내는 분기 등).
    settle({ ok: false, reason: 'failed' })
  }, TIMEOUT_MS)

  try {
    // 이건 로그인 완료를 기다리지 않고 곧바로 반환된다(위 docstring 참조).
    void CapacitorKakaoLogin.prompt({ scopes: ['openid'] }).catch(() => {
      settle({ ok: false, reason: 'failed' })
    })
    return await done
  } finally {
    clearTimeout(timer)
    try {
      await handle.remove()
    } catch {
      /* 리스너 해제 실패가 로그인 결과를 덮으면 안 된다 */
    }
  }
}
