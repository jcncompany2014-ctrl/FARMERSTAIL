'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
      setError('저장에 실패했어요: ' + updErr.message)
      return
    }
    // 성공 → next 로
    const safe =
      next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
    router.replace(safe)
  }

  // 거부: 14세 미만이 본인 출생연도 골랐을 때 → signOut + 안내
  async function handleUnder14Acknowledge() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{ background: 'var(--bg)' }}
    >
      <div className="max-w-sm w-full">
        <span className="kicker">Age Verification · 만 14세 확인</span>
        <h1
          className="font-serif mt-2 text-[24px]"
          style={{
            color: 'var(--ink)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
          }}
        >
          출생 연도를 알려주세요
        </h1>
        <p
          className="text-[12.5px] mt-3 leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          파머스테일은 만 14세 이상만 이용할 수 있어요. 개인정보보호법에 따라
          한 번만 확인할게요. 입력하신 연도는 이후 가입 흐름에서 다시 묻지
          않아요.
        </p>

        <label
          className="block text-[11px] font-bold mt-6 mb-1.5"
          style={{ color: 'var(--text)' }}
        >
          출생 연도
        </label>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          disabled={saving}
          className="w-full px-4 py-3 rounded-lg border text-sm"
          style={{
            borderColor: isUnder14 ? 'var(--sale)' : 'var(--rule-2)',
            background: '#FDFDFD',
            color: 'var(--text)',
          }}
        >
          <option value="">선택해 주세요</option>
          {Array.from({ length: currentYear - MIN_YEAR + 1 }).map((_, i) => {
            const y = currentYear - i
            return (
              <option key={y} value={y}>
                {y}년
              </option>
            )
          })}
        </select>

        {isUnder14 && (
          <p
            className="text-[11px] mt-2 font-semibold leading-relaxed"
            style={{ color: 'var(--sale)' }}
          >
            만 14세 미만은 가입할 수 없어요. 보호자와 상의해 주세요.
          </p>
        )}

        {error && !isUnder14 && (
          <p
            className="text-[11px] mt-2 font-semibold leading-relaxed"
            style={{ color: 'var(--sale)' }}
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={isUnder14 ? handleUnder14Acknowledge : handleSubmit}
          disabled={saving || !year || (!isUnder14 && !isValid)}
          className="mt-5 w-full py-3.5 rounded-full text-[13px] font-bold disabled:opacity-50 transition active:scale-[0.98]"
          style={{
            background: isUnder14 ? 'var(--sale)' : 'var(--ink)',
            color: 'var(--bg)',
            letterSpacing: '-0.01em',
          }}
        >
          {saving
            ? '저장 중...'
            : isUnder14
              ? '확인 — 가입을 종료할게요'
              : '계속하기'}
        </button>

        <p
          className="text-[10.5px] mt-4 leading-relaxed text-center"
          style={{ color: 'var(--muted)' }}
        >
          개인정보보호법 제22조의2에 따라 만 14세 이상 사용자만 이용할 수 있어요.
        </p>
      </div>
    </main>
  )
}

export default function AgeGatePage() {
  return (
    <Suspense
      fallback={
        <main
          className="min-h-screen flex items-center justify-center"
          style={{ background: 'var(--bg)' }}
        >
          <div
            className="w-10 h-10 border-2 rounded-full animate-spin"
            style={{
              borderColor: 'var(--terracotta)',
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
