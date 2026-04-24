'use client'

import { resetConsent } from '@/lib/cookies'

/**
 * 개인정보처리방침 본문 안에 임베드되는 "쿠키 설정 다시 열기" 링크.
 * 서버 컴포넌트 (page.tsx) 안에서 onClick 을 쓸 수 없으므로 분리.
 */
export default function CookieConsentResetLink({
  children = '쿠키 설정 다시 열기',
}: {
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => resetConsent()}
      className="font-bold hover:underline inline"
      style={{ color: 'var(--terracotta)' }}
    >
      {children}
    </button>
  )
}
