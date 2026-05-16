'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

/**
 * audit #107: Supabase auth state 변경 시 Sentry.setUser({ id }) 동기화.
 *
 * 이전엔 Sentry 가 user.id 를 모르고 익명 이벤트로만 받아 — 같은 사용자의
 * 여러 세션 묶기 어려움 + 결제 fail 시 "어느 사용자" 추적 불가.
 *
 * # PII
 * - id (UUID) 만 박음. email / username 안 박음 (sendDefaultPii=false 와 일치).
 *
 * # 사용
 * (main)/layout.tsx 또는 app/layout.tsx 에 client component 로 한 번만 mount.
 */
export default function SentryUserSync() {
  useEffect(() => {
    const supabase = createClient()
    // 1) 첫 마운트 — getSession 으로 현재 user 즉시 동기화.
    void supabase.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
        if (session?.user?.id) {
          Sentry.setUser({ id: session.user.id })
        } else {
          Sentry.setUser(null)
        }
      })

    // 2) auth state 변경 (로그인/로그아웃/토큰 refresh) 시 자동 갱신.
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (session?.user?.id) {
          Sentry.setUser({ id: session.user.id })
        } else {
          Sentry.setUser(null)
        }
      },
    )

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  return null
}
