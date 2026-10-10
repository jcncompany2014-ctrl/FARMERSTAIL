'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trackSignUp } from '@/lib/analytics'
import { safeNextPath } from '@/lib/auth/safe-next'
import { useServerAppContext } from '@/components/app/ServerAppContext'
import AgeGateAppView from '@/components/v3/auth/AgeGateAppView'
import AgeGateWebView from '@/components/store/AgeGateWebView'

/**
 * /onboarding/age-gate
 *
 * 카카오/Apple 등 OAuth 가입자가 birth_year 를 입력하지 않은 상태로 dashboard
 * 진입 시도하면 auth/callback 이 이 페이지로 redirect 한다.
 *
 * # 왜 필요한가
 * - 개인정보보호법 제22조의2: 만 14세 미만은 법정대리인 동의 없이 가입 불가.
 *   서비스 운영자는 14세 미만이 가입하지 않도록 합리적인 조치를 취해야 함.
 * - 이메일 회원가입은 폼 자체가 birth_year 를 강제 — OAuth 만 우회 가능.
 *
 * # 동작
 * - 출생연도 select (현재 - 14 ~ 현재 - 100)
 * - 14세 미만 선택 → 자동 차단 메시지 + 14세 미만은 가입 불가
 * - 입력 후 profiles.birth_year update → next 로 이동
 * - DB 트리거 (round 1 의 manage_under_14_block) 가 14세 미만이면 UNDER_14
 *   메시지로 reject — 클라이언트 가드를 우회해도 차단됨.
 */

function AgeGateInner() {
  const appLook = useServerAppContext()
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') ?? '/dashboard'
  const supabase = createClient()

  const currentYear = new Date().getFullYear()
  const MIN_YEAR = currentYear - 100
  const MAX_YEAR = currentYear - 14

  const [year, setYear] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 페이지 진입 시 user 가 없으면 /login 으로.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!cancelled && !user) router.replace('/login')
    })()
    return () => {
      cancelled = true
    }
  }, [router, supabase])

  const yearNum = year ? Number(year) : NaN
  const isUnder14 =
    Number.isInteger(yearNum) && yearNum > MAX_YEAR && yearNum <= currentYear
  const isValid =
    Number.isInteger(yearNum) && yearNum >= MIN_YEAR && yearNum <= MAX_YEAR

  async function handleSubmit() {
    setError('')
    if (isUnder14) {
      setError('만 14세 미만은 가입할 수 없어요. 보호자와 상의해 주세요.')
      return
    }
    if (!isValid) {
      setError('출생 연도를 선택해 주세요.')
      return
    }
    setSaving(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/login')
      return
    }
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ birth_year: yearNum })
      .eq('id', user.id)

    if (updErr) {
      // DB 트리거가 14세 미만 직접 차단하면 UNDER_14 메시지가 옴.
      if (updErr.message?.includes('UNDER_14')) {
        await supabase.auth.signOut()
        setSaving(false)
        setError(
          '만 14세 미만은 가입할 수 없어요. 가입은 보호자 동의 후 다시 시도해 주세요.',
        )
        return
      }
      setSaving(false)
      // 원본 DB 오류를 고객에게 그대로 보여주지 않는다 — 가입 첫 화면이다
      // (2026-08-07 문구 감사). 무엇을 하면 되는지까지 말한다.
      setError(
        '저장하지 못했어요. 잠시 후 다시 시도해 주세요. 계속 안 되면 story@farmerstail.kr 로 알려주시면 바로 도와드릴게요.',
      )
      console.error('[age-gate] 저장 실패', updErr.message)
      return
    }
    // GA4/Meta sign_up 전환 — OAuth(카카오/Apple) 신규 가입자만 이 화면에
    // 온다(birth_year 없음 = 첫 진입). 저장 성공 = 가입 확정 시점, 정확히
    // 1회(다음부터는 birth_year 있어 callback 이 이리로 안 보냄).
    const provider =
      (user.app_metadata?.provider as string | undefined) ?? 'kakao'
    trackSignUp(provider === 'apple' ? 'apple' : provider === 'email' ? 'email' : 'kakao')

    // 성공 → next 로
    // 정본 검사(lib/auth/safe-next) — 예전 자체 검사는 `/\evil.com`·탭 변형을 못 막았다.
    const safe = safeNextPath(next) ?? '/dashboard'
    router.replace(safe)
  }

  // 거부: 14세 미만이 본인 출생연도 골랐을 때 → signOut + 안내
  async function handleUnder14Acknowledge() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  // 앱 새 디자인('A 포스터', 2026-10-09 캔버스 W13·W26) — 앱이면 앱 화면 부품으로(판정 = onboarding/layout 의 서버 값).
  //   저장·차단·이동은 위 그대로 — 상태만 넘긴다.
  if (appLook) {
    return (
      <AgeGateAppView
        year={year}
        years={Array.from({ length: currentYear - MIN_YEAR + 1 }, (_, i) => currentYear - i)}
        onYearChange={setYear}
        isUnder14={isUnder14}
        error={error}
        saving={saving}
        canSubmit={!(saving || !year || (!isUnder14 && !isValid))}
        onPrimary={isUnder14 ? handleUnder14Acknowledge : handleSubmit}
      />
    )
  }

  // 웹 = 웹 시안 WEB-A09·A10(2026-10-10 웹 리뉴얼) — 새 웹 가게 틀, 앱과 같은 상태. 예전 웹 판은 git 이력.
  return (
    <AgeGateWebView
      year={year}
      years={Array.from({ length: currentYear - MIN_YEAR + 1 }, (_, i) => currentYear - i)}
      onYearChange={setYear}
      isUnder14={isUnder14}
      error={error}
      saving={saving}
      canSubmit={!(saving || !year || (!isUnder14 && !isValid))}
      onPrimary={isUnder14 ? handleUnder14Acknowledge : handleSubmit}
    />
  )
}

export default function AgeGatePage() {
  // 기다리는 동안 흰 바탕·먹색 원 — 앱 새 디자인·웹 리뉴얼(2026-10-10) 둘 다.
  return (
    <Suspense
      fallback={
        <main
          className="min-h-screen flex items-center justify-center"
          style={{ background: '#FFFFFF' }}
        >
          <div
            className="w-10 h-10 border-2 rounded-full animate-spin"
            style={{
              borderColor: '#141414',
              borderTopColor: 'transparent',
            }}
          />
        </main>
      }
    >
      <AgeGateInner />
    </Suspense>
  )
}
