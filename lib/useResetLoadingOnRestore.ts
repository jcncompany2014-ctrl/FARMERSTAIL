'use client'

import { useEffect } from 'react'

/**
 * 뒤로가기로 **되살아난 페이지**의 로딩 상태를 되돌린다.
 *
 * # 왜 필요한가 (2026-08-25, iOS 실기기)
 * 소셜 로그인 버튼은 누르는 순간 `loading=true` 로 바꾸고 브라우저를 카카오·애플로
 * **떠나보낸다**. 떠난 뒤엔 이 컴포넌트가 정리될 일이 없으니 그대로 둬도 됐다.
 *
 * 그런데 iOS 앱에서 외부 페이지 탈출용 가장자리 스와이프를 켜면서
 * (`ios/App/App/AppDelegate.swift`) **돌아오는 길이 생겼다.** WebView 는 이전
 * 페이지를 통째로 캐시해뒀다가 복원하므로 JS 상태가 살아 있고, 버튼이
 * **"연결 중…"에 영원히 멈춘 채**로 보인다 — 다시 누를 수도 없다.
 * 뒤로 올 수는 있는데 도착지가 못 쓰는 화면이면 고치기 전보다 나쁘다.
 *
 * `pageshow` 의 `persisted` 가 캐시 복원을 뜻한다. 새로 그려진 경우엔 애초에
 * 초기값이라 아무 일도 하지 않는다(불필요한 상태 변경 없음).
 *
 * 안드로이드 하드웨어 뒤로가기·웹 브라우저 뒤로가기에도 똑같이 적용된다.
 */
export function useResetLoadingOnRestore(reset: () => void) {
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) reset()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [reset])
}
