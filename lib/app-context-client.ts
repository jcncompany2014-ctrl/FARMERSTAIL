'use client'

import { useEffect, useState } from 'react'

/**
 * useIsAppContext — 클라이언트 컴포넌트에서 앱(PWA / Capacitor) 진입인지 판정.
 *
 * 서버 쪽 짝은 `lib/app-context.ts` 의 `isAppContextServer()`. 판정 근거는 같은
 * `ft_app=1` 쿠키이고, `components/AppContextCookieSync.tsx` 가 마운트 시 set/unset 한다.
 *
 * # 왜 공용 모듈로 뺐나 (2026-07-30)
 * 같은 로직이 `components/CookieConsent.tsx` 안에 사문화된 채로 있었고, 결제
 * 화면들은 아예 판정을 하지 않아 **웹 사용자를 앱 전용 경로로 보냈다**
 * (`/mypage/subscriptions` → `/app-required` 벽). 복제하면 한쪽만 고쳐진다 —
 * 그게 '웹/앱 절대 분리'를 반쪽만 지키게 만드는 경로다.
 *
 * # 첫 렌더는 항상 false
 * 쿠키는 하이드레이션 후에 읽는다(SSR HTML 과 클라이언트 첫 렌더가 달라지면
 * hydration mismatch). 그래서 **웹 기준값으로 먼저 그리고** 앱이면 바꾼다 —
 * 링크·버튼의 목적지처럼 클릭 시점에 확정돼도 되는 곳에 쓴다.
 * 서버 렌더 시점에 확정이 필요하면 `isAppContextServer()` 를 쓸 것.
 */
export function useIsAppContext(): boolean {
  const [isApp, setIsApp] = useState(false)
  useEffect(() => {
    if (typeof document === 'undefined') return
    const flag = document.cookie
      .split(';')
      .map((c) => c.trim())
      .some((c) => c.startsWith('ft_app=1'))
    // 외부 시스템(document.cookie) 의 1회 동기화 — useEffect 의 정상 사용 패턴.
    // React 19 `react-hooks/set-state-in-effect` 룰은 cascading render 를
    // 우려하지만 이 setState 는 deps=[] 라 마운트 직후 1회만 발생한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsApp(flag)
  }, [])
  return isApp
}
