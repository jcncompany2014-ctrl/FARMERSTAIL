'use client'

import { useEffect } from 'react'
import { useIsAppContext } from '@/hooks/useIsAppContext'

const COOKIE_NAME = 'ft_app'
const COOKIE_VALUE_APP = '1'
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365 // 1년

/**
 * 클라이언트가 감지한 app/web 컨텍스트를 cookie 로 동기화.
 *
 * 왜 쿠키냐:
 *   - middleware (server-side) 에서 라우트 가드 판정에 쓰려면 server 가 읽을
 *     수 있어야 함. localStorage 는 server 가 못 봄. 쿠키는 자동 전송.
 *   - PWA / Capacitor 로 처음 부팅된 직후 첫 요청은 쿠키가 아직 없을 수 있다.
 *     이 컴포넌트가 마운트되면서 쿠키 set → 다음 navigation 부터 middleware
 *     가 정상 통과시킴. 첫 요청은 client-side hook 로도 한 번 더 보장.
 *
 * ★앱이면 **마운트마다 다시 쓴다** (2026-08-16 4라운드 감사 — 이전엔 "이미
 * 정확한 값이면 no-op"). iOS(ITP)는 document.cookie 로 심은 쿠키의 수명을
 * max-age 와 무관하게 **7일로 깎는다.** no-op 최적화 때문에 만료가 갱신되지
 * 않아, PWA 를 일주일 안 열면 ft_app 이 사라지고 다음 실행의 첫 요청
 * (start_url=/dashboard)이 proxy 에서 /app-required "앱 설치하세요" 벽으로
 * 튕겼다 — **앱 안에서 앱을 설치하라는 화면**이다. 매 마운트 재기록이면 앱을
 * 쓰는 한 만료가 계속 미뤄진다. 비용은 document.cookie 대입 1회뿐.
 * (벽에 이미 떨어진 경우의 복구는 AppRequiredAutoRecover 가 맡는다 — 두 겹.)
 *
 * SameSite=Lax — OAuth callback redirect 같은 cross-site 진입에도 보존.
 * Secure — production https 만. 개발 localhost 도 secure 미설정으로 safe.
 */
export default function AppContextCookieSync() {
  const isApp = useIsAppContext()

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (isApp === null) return // SSR / hydration 직전 — 미정

    // 현재 쿠키 값 파싱.
    const current = document.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE_NAME}=`))
      ?.split('=')[1]

    // 앱이면 값이 이미 맞아도 재기록(만료 갱신 — 위 docstring). 웹은 no-op 유지.
    if (!isApp && !current) return // 이미 정확

    // Set or clear
    const secure =
      typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? '; Secure'
        : ''

    if (isApp) {
      document.cookie =
        `${COOKIE_NAME}=${COOKIE_VALUE_APP}; path=/; max-age=${COOKIE_MAX_AGE_S}; ` +
        `SameSite=Lax${secure}`
    } else {
      // 웹 컨텍스트로 돌아온 경우 (앱 사용자가 같은 브라우저로 사이트 방문 등 — 드물다)
      // 명시적으로 만료. 만일 동일 디바이스에서 PWA + 일반 브라우저 둘 다 쓰면
      // 분리된 쿠키 jar 라 영향 없음. 같은 jar 인 경우만 cleanup.
      document.cookie =
        `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax${secure}`
    }
  }, [isApp])

  return null
}
