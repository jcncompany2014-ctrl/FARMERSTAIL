'use client'

// 트랙B — OAuth(카카오/Apple) 인증 복귀 후 **만능 착지점**(라우팅 허브).
//
// 사장님 결정(2026-06-16): "설문 없이 가입 불가" → 로그인/가입 후 행선지를
// 강아지(=설문 완료) 보유 여부로 분기:
//   ① 강아지 보유(기존 회원) → 홈(app=/dashboard, web=/mypage/orders)
//   ② 강아지 無 + 설문 초안 완성 → applyAutosignupDraft 이관 → /dogs/{id}/analysis
//   ③ 강아지 無 + 초안 無 → /start(설문). 카카오로 그냥 로그인한 신규도 설문으로.
//
// 진입 경로: /start 결과 "카카오로 시작하기"(next=/start/claim) AND /login 의
//   카카오/Apple(next=/start/claim) 둘 다 → /auth/callback → (출생연도 없으면)
//   /onboarding/age-gate → 여기. 콜백·age-gate·(auth) 무수정(next 만 지정).
// ★카카오는 인증 후 세션 live → RLS insert/조회 즉시 통과.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  loadAutosignupDraft,
  isDogDraftComplete,
  clearAutosignupDraft,
} from '@/lib/autosignup-draft'
import { applyAutosignupDraft } from '@/lib/auth/applyAutosignupDraft'
import { claimPromotionOnSignup } from '@/lib/auth/claimPromotionOnSignup'

// PWA/Capacitor(앱) 여부 — 행선지(app=/dashboard vs web=/mypage/orders) 분기용.
// useIsAppContext 훅은 SSR/하이드레이션 시 null 이라 이 전환 페이지(effect 1회)
// 에선 직접 신호를 읽는다.
function readIsApp(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const w = window as typeof window & {
      Capacitor?: { isNativePlatform?: () => boolean }
    }
    if (w.Capacitor?.isNativePlatform?.() === true) return true
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone
    return Boolean(standalone || ios)
  } catch {
    return false
  }
}

export default function StartClaimPage() {
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

      const isApp = readIsApp()
      const home = isApp ? '/dashboard' : '/mypage/orders'

      // 프로모션 박기 — **이관 분기보다 먼저.** ①(강아지 이미 보유 → 이관 스킵)로
      // 빠지는 사람도 링크를 타고 왔다면 할인은 받아야 한다. 계정당 1회는 DB 가 강제.
      await claimPromotionOnSignup()

      // ① 이미 강아지 보유(기존 회원·이관 완료) → 이관 스킵, 홈으로.
      //    잔여 초안이 있으면 정리(다른 익명 설문 흔적).
      const { count } = await supabase
        .from('dogs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
      if (count && count > 0) {
        clearAutosignupDraft()
        if (!cancelled) router.replace(home)
        return
      }

      // ② 강아지 無 + 설문 초안 완성 → 계정으로 이관 → 분석 화면.
      const draft = loadAutosignupDraft()
      if (draft && isDogDraftComplete(draft.dog)) {
        const dogName = (draft.dog.name || '').trim()
        try {
          const dogId = await applyAutosignupDraft(user.id, draft)
          if (cancelled) return
          if (dogId) {
            clearAutosignupDraft()
            // 앱=정밀 분석 종착점, 웹=가입 완료 핸드오프(/dogs app-only 벽 우회).
            router.replace(
              isApp
                ? `/dogs/${dogId}/analysis?fromSurvey=1`
                : `/start/done?name=${encodeURIComponent(dogName)}`,
            )
            return
          }
        } catch {
          /* 이관 실패 → 아래 /start 로(초안 보존, 재시도 가능) */
        }
      }

      // ③ 강아지 無 + 초안 無/이관 실패 → 설문으로(설문 없이 진입 불가).
      //    ★앱은 웹 퍼널(/start=WebChrome) 대신 **앱 온보딩(/dogs/new → 앱
      //    강아지 분석 설문)** — 카카오로 앱에서 가입했는데 웹으로 튕기던 것
      //    차단(사장님 2026-07-19). 웹/앱 절대 분리.
      if (!cancelled) router.replace(isApp ? '/dogs/new' : '/start')
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
