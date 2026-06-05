'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dog, BarChart3, Repeat, Check, ArrowRight, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useModalA11y } from '@/lib/ui/useModalA11y'

/**
 * 가입 후 첫 dashboard 진입 시 노출되는 3단계 튜토리얼.
 *
 * # 흐름
 *  1. 환영 + 강아지 등록 권유 (terracotta tone)
 *  2. AI 영양 분석 안내 (gold tone)
 *  3. 정기배송 안내 (moss tone)
 *
 * "건너뛰기" 와 "다음" 둘 다 가능. 마지막 단계의 "시작하기" 클릭 시 강아지
 * 등록 페이지로 이동 (가장 강한 첫 액션 = retention 직결).
 *
 * # 노출 조건
 * profile.onboarded_at IS NULL 일 때만 1회. dismiss / 완료 시 onboarded_at
 * 을 NOW() 로 업데이트 → 이후 자동 hide.
 *
 * # 디자인
 * 풀스크린 takeover modal. 단순한 일러스트 + 한 문장 + CTA 만.
 * 사용자가 5초 안에 읽고 다음 단계로 갈 수 있게.
 */

const STEPS = [
  {
    Icon: Dog,
    accent: 'var(--terracotta)',
    kicker: 'Step 1 · 시작',
    title: '첫 아이를 등록해주세요',
    body: '체중·BCS·식이 정보를 입력하면\n맞춤 영양 분석을 무료로 보내드려요.',
  },
  {
    Icon: BarChart3,
    accent: 'var(--gold)',
    kicker: 'Step 2 · 분석',
    title: '5분이면 충분해요',
    body: 'NRC2006 기준 정밀 영양 처방 + AI 영양사 코멘터리.\n수의영양학 가이드라인 기반.',
  },
  {
    Icon: Repeat,
    accent: 'var(--moss)',
    kicker: 'Step 3 · 정기배송',
    title: '매주 또는 매월 자동 도착',
    body: '맞춤 처방을 정기적으로 받아보세요.\n언제든 일시정지·해지 가능해요.',
  },
] as const

export default function OnboardingTutorial() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [hidden, setHidden] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  // 첫 진입 튜토리얼 — Esc 로 건너뛰기 + focus trap + body scroll lock.
  // markOnboarded() 가 비동기지만 hidden state 가 즉시 true 가 되므로 unmount.
  useModalA11y({
    open: !hidden,
    onClose: () => {
      void handleSkip()
    },
    containerRef: dialogRef,
  })

  async function markOnboarded() {
    setHidden(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('profiles')
          .update({ onboarded_at: new Date().toISOString() })
          .eq('id', user.id)
      }
    } catch {
      // best-effort — 실패해도 hidden state 가 이번 세션엔 다시 안 뜨게
    }
  }

  async function handleNext() {
    if (step === STEPS.length - 1) {
      await markOnboarded()
      router.push('/dogs/new')
      return
    }
    setStep((s) => s + 1)
  }

  async function handleSkip() {
    await markOnboarded()
  }

  if (hidden) return null

  const current = STEPS[step]
  if (!current) return null
  const Icon = current.Icon

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[80] bg-bg flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      {/* skip */}
      <div className="px-5 pt-[calc(20px+env(safe-area-inset-top))] flex justify-end">
        <button
          type="button"
          onClick={handleSkip}
          className="text-[12px] text-muted hover:text-text inline-flex items-center gap-1"
          aria-label="튜토리얼 건너뛰기"
        >
          건너뛰기
          <X className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{
            background: `color-mix(in srgb, ${current.accent} 12%, var(--bg))`,
            border: `1px solid ${current.accent}`,
          }}
        >
          <Icon
            className="w-9 h-9"
            style={{ color: current.accent }}
            strokeWidth={1.6}
          />
        </div>

        <span className="kicker" style={{ color: current.accent }}>
          {current.kicker}
        </span>
        <h1
          id="onboarding-title"
          className="font-sans mt-2 leading-tight"
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          {current.title}
        </h1>
        <p
          className="mt-4 text-[14px] leading-relaxed whitespace-pre-line"
          style={{ color: 'var(--muted)' }}
        >
          {current.body}
        </p>
      </div>

      {/* progress + next */}
      <div className="px-8 pb-[calc(32px+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === step ? 'w-8' : 'w-1.5'
              }`}
              style={{
                background:
                  i === step ? current.accent : 'var(--rule)',
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={handleNext}
          className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full text-[14px] font-bold transition active:scale-[0.98]"
          style={{
            background: 'var(--ink)',
            color: 'var(--bg)',
          }}
        >
          {step === STEPS.length - 1 ? (
            <>
              <Check className="w-4 h-4" strokeWidth={2.5} />
              시작하기
            </>
          ) : (
            <>
              다음
              <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
