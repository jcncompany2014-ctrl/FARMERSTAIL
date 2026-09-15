'use client'

import { useEffect } from 'react'
import { autoRegisterNativePush } from '@/lib/capacitor'

/**
 * 홈 진입 시 네이티브 푸시 토큰을 자동 등록한다. 화면엔 아무것도 그리지 않는다.
 *
 * 왜 홈인가 — 온보딩을 마치면 홈으로 오고, 온보딩을 이미 본 기존 사용자도
 * 로그인하면 홈이 첫 화면이다. 두 경우를 한 지점에서 잡는다.
 * 동작 원칙(이미 등록·opt-out·권한 거부 처리)은 autoRegisterNativePush 주석에.
 */
export default function PushAutoRegister() {
  useEffect(() => {
    void autoRegisterNativePush()
  }, [])
  return null
}
