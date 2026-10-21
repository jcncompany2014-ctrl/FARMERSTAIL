'use client'

/**
 * 앱 안에서 로그인한 손님이 이벤트 QR 을 연 경우(플레이 1.0.10 은 /p/ 까지 앱이 가져간다) — 이 계정에 혜택을 저장하고 홈으로.
 * 웹 안내서·앱 설치 안내는 필요 없다(이미 앱이다). 설문을 아직 안 한 계정이면 설문으로(lib/auth/surveyPendingDog).
 * 저장 결과는 조용히 — 못 받는 계정(이미 받음·결제한 적 있음·마감)은 원래 가던 곳으로 간다.
 */
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { firstDogWithoutSurvey } from '@/lib/auth/surveyPendingDog'
import { surveyStartHref } from '@/lib/survey/welcome'

export default function AppEventClaim({ code }: { code: string }) {
  const router = useRouter()
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return
    ran.current = true
    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace(`/start?p=${code}`)
        return
      }
      try {
        await (supabase as unknown as { rpc: (fn: string, a: Record<string, unknown>) => Promise<unknown> }).rpc('claim_promotion', { p_code: code })
      } catch {
        /* 못 받으면 원래 흐름대로 */
      }
      const pending = await firstDogWithoutSurvey(supabase, user.id)
      router.replace(pending ? surveyStartHref(pending, false) : '/dashboard')
    })()
  }, [code, router])
  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: '#FFFFFF', color: '#141414' }}>
      <span
        aria-hidden
        style={{ width: 28, height: 28, border: '3px solid #E5E5E5', borderTopColor: '#141414', borderRadius: '50%', animation: 'appEvSpin .8s linear infinite' }}
      />
      <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>혜택을 계정에 저장하고 있어요…</p>
      <style>{'@keyframes appEvSpin{to{transform:rotate(360deg)}}'}</style>
    </main>
  )
}
