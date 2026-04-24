'use client'

import { useEffect } from 'react'
import { applyConsentToTrackers, readConsent } from '@/lib/cookies'

/**
 * 한 번 마운트 돼서 "이전에 저장된 동의 상태" 를 gtag / fbq 로 다시 흘려준다.
 * 새로고침마다 AnalyticsScripts 의 consent default=denied 가 먼저 깔리기 때문에,
 * 이 컴포넌트가 있어야 이미 동의한 유저의 분석/광고가 다시 켜진다.
 */
export default function ConsentBootstrap() {
  useEffect(() => {
    const c = readConsent()
    if (c) applyConsentToTrackers(c)
  }, [])
  return null
}
