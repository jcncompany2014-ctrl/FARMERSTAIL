'use client'

// 앱 Phase B — 강아지정보 → 가입(카카오/애플) 복귀 후 착지점.
//
// /start/claim(웹: 설문 완료 후 가입 → dog+survey+analysis 일괄 이관)과 달리,
// 앱 흐름(사장님 2026-07-20)은 "강아지정보 → 가입 → [여기서 dog 만 생성] →
// 앱내 설문(/dogs/[id]/survey)" 이다. 그래서 여기선 createDogFromDraft 로 강아지만
// 만들고 설문으로 보낸다. 설문 완료 시 survey/analysis 는 SurveyClient 가 만든다.
//
// 진입: /start/join 의 카카오/애플 버튼 next=/start/onboard → /auth/callback →
//   (출생연도 없으면) /onboarding/age-gate → 여기. ★카카오는 인증 후 세션 live.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  loadAutosignupDraft,
  isDogDraftComplete,
  clearAutosignupDraft,
} from '@/lib/autosignup-draft'
import { createDogFromDraft } from '@/lib/auth/createDogFromDraft'
import { claimPromotionOnSignup } from '@/lib/auth/claimPromotionOnSignup'

export default function StartOnboardPage() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      // 세션 없음(직접 진입/콜백 실패) → 로그인으로.
      if (!user) {
        if (!cancelled) router.replace('/login')
        return
      }

      // 프로모션 박기 — 이관/분기보다 먼저(계정당 1회는 DB 강제).
      await claimPromotionOnSignup()

      // 이미 강아지 보유(기존 회원·중복 진입) → 그 강아지 설문으로(멱등).
      const { data: dogs } = await supabase
        .from('dogs')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
      const existingId = (dogs ?? [])[0]?.id as string | undefined
      if (existingId) {
        clearAutosignupDraft()
        if (!cancelled) router.replace(`/dogs/${existingId}/survey`)
        return
      }

      // 초안 강아지정보 → 강아지만 생성 → 앱내 설문.
      const draft = loadAutosignupDraft()
      if (draft && isDogDraftComplete(draft.dog)) {
        try {
          const dogId = await createDogFromDraft(user.id, draft)
          if (cancelled) return
          if (dogId) {
            clearAutosignupDraft()
            router.replace(`/dogs/${dogId}/survey`)
            return
          }
        } catch {
          /* 생성 실패 → 아래 fallback(초안 보존, 수동 등록 가능) */
        }
      }

      // 초안 없음/생성 실패 → 강아지 등록 화면으로(설문 없이 진입 불가 보장).
      if (!cancelled) router.replace('/dogs/new')
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
      <div
        className="w-10 h-10 border-2 rounded-full animate-spin"
        style={{ borderColor: 'var(--fd-coral)', borderTopColor: 'transparent' }}
        aria-hidden="true"
      />
      <p className="text-[13px]" style={{ color: 'var(--fd-muted)' }}>
        잠시만요, 준비하고 있어요…
      </p>
    </main>
  )
}
