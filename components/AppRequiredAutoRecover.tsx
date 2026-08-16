'use client'

import { useEffect } from 'react'
import { useIsAppContext } from '@/hooks/useIsAppContext'
import { safeNextPath } from '@/lib/auth/safe-next'

/**
 * /app-required 자가복구 — **앱 안에서 이 벽을 만난 경우** 원래 목적지로 되돌린다.
 *
 * # 왜 (2026-08-16 4라운드 감사)
 * proxy 의 앱 전용 경로 가드는 `ft_app=1` 쿠키로 판정하는데, 그 쿠키를 심는
 * 곳은 클라이언트(AppContextCookieSync)뿐이다. 그래서 **첫 실행**(설치 직후
 * start_url=/dashboard 로 부팅 — 쿠키가 아직 없다)과 **쿠키 만료 후 재실행**
 * (iOS ITP 가 JS 쿠키를 7일로 깎는다)의 첫 요청은 반드시 이 벽으로 떨어진다 —
 * 진짜 앱 사용자가 "앱을 설치하세요" 화면을 보는 것이다. 이 화면은 서버
 * 컴포넌트라 스스로 복구할 코드가 한 줄도 없었다.
 *
 * 루트 레이아웃의 AppContextCookieSync 가 이 페이지에서도 마운트되어 쿠키를
 * 다시 심으므로, 여기서는 **확인하고 되돌리기만** 한다. 가드 3개가 필수다:
 *
 *  · **from 검증** — safeNextPath(오픈 리다이렉트 정본)로. 통과 못 하면
 *    /dashboard. (proxy 가 만든 from 이지만, 이 URL 은 밖에서도 조작해 들어올
 *    수 있다.)
 *  · **원샷 가드** — sessionStorage 토큰. 복구 후에도 어떤 이유로 다시 벽에
 *    떨어지면(쿠키 차단 등) 두 번째 시도를 하지 않는다 — 무한 리다이렉트
 *    루프 차단. 토큰을 못 쓰는 환경(스토리지 차단)이면 복구 자체를 포기한다:
 *    벽에 머무는 것(현행)이 루프보다 낫다.
 *  · **쿠키 readback** — document.cookie 에 ft_app=1 이 **실제로 읽힌 뒤에만**
 *    이동한다. 안 그러면 proxy 가 같은 자리로 되돌려 보낸다(원샷 가드가
 *    있어 루프는 아니지만, 헛수고 왕복이 된다). 최대 3초 폴링 후 포기.
 *
 * 이동은 window.location.replace — proxy 가 쿠키를 다시 평가해야 하므로
 * 온전한 네비게이션이어야 하고, replace 라 뒤로가기에 벽이 남지 않는다.
 * 웹 사용자(isApp=false)에게는 아무 일도 일어나지 않는다.
 */
const ONCE_KEY = 'ft_app_recover_once'

export default function AppRequiredAutoRecover() {
  const isApp = useIsAppContext()

  useEffect(() => {
    if (isApp !== true) return

    // 원샷 가드 — 읽기·쓰기 모두 실패하면 복구 포기(루프 방지가 우선).
    try {
      if (sessionStorage.getItem(ONCE_KEY)) return
    } catch {
      return
    }

    const from = safeNextPath(
      new URLSearchParams(window.location.search).get('from'),
    )
    const dest = from ?? '/dashboard'

    let cancelled = false
    const deadline = Date.now() + 3000
    const tick = () => {
      if (cancelled) return
      const hasCookie = document.cookie
        .split(';')
        .some((c) => c.trim() === 'ft_app=1')
      if (hasCookie) {
        try {
          sessionStorage.setItem(ONCE_KEY, '1')
        } catch {
          return // 토큰을 못 남기면 이동하지 않는다 — 루프 가능성 차단
        }
        window.location.replace(dest)
        return
      }
      if (Date.now() < deadline) setTimeout(tick, 100)
    }
    tick()
    return () => {
      cancelled = true
    }
  }, [isApp])

  return null
}
