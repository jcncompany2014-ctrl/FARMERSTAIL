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
 * 한 번만 set 하고 끝. 이미 정확한 값이면 no-op.
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

    if (isApp && current === COOKIE_VALUE_APP) return // 이미 정확
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
