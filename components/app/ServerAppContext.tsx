'use client'

/**
 * ServerAppContext — 서버가 판정한 '앱 컨텍스트' 여부를 클라이언트 화면에 첫 그림부터 넘긴다(2026-10-09).
 *
 * # 왜
 * 카드 등록(/subscribe/*)처럼 AppChrome 밖의 최상위 화면은 클라이언트 훅(useIsAppContext)으로만 앱인지 알았다.
 * 그 훅은 마운트 뒤에야 true 가 되어, 앱 새 디자인('A 포스터')을 입히면 웹 모양 → 앱 모양으로 **깜빡인다**.
 * 서버 레이아웃이 같은 두 신호(ft_app 쿠키 · 앱 UA 표식 — lib/app-context isAppContextServer)로 판정해 이
 * 제공자에 실어 주면, 클라이언트 화면은 첫 그림부터 맞는 모양을 그린다.
 *
 * 화면 동작(돌아갈 주소 등)은 예전처럼 useIsAppContext 를 쓰고, 모양만 이 값을 본다.
 */

import { createContext, useContext, type ReactNode } from 'react'

const Ctx = createContext(false)

export function ServerAppContextProvider({ isApp, children }: { isApp: boolean; children: ReactNode }) {
  return <Ctx.Provider value={isApp}>{children}</Ctx.Provider>
}

/** 서버가 본 앱 컨텍스트 여부. 제공자 밖이면 false(웹). */
export function useServerAppContext(): boolean {
  return useContext(Ctx)
}
