'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, X } from 'lucide-react'
import type { NextAction } from '@/lib/dashboard/next-action'

/**
 * Dashboard "오늘 할 일" 카드 — computeNextAction 의 결과 1개를 시각화.
 *
 * # 디자인
 * - tone 별 다른 accent 색 (terracotta=강조, gold=권유, moss=리마인더)
 * - 단일 CTA — 과한 선택지 X. 사용자가 매일 들어와 한 번에 흐름 진입.
 * - 카드 자체가 Link — 모바일 탭 영역 보장 (CTA 버튼만 작아도 카드 어디든 탭).
 * - kicker "오늘의 한 가지" — 매일 들러도 자기 위치 알 수 있게.
 *
 * # 견주 자율성 — "지금은 괜찮아요" dismiss 옵션
 * docs/voice-guidelines.md §5 정책: 모든 개입은 거부 가능해야 함.
 * action.type + 오늘 날짜 키로 24시간 dismiss. 다음 날 다시 표시.
 * 사용자가 같은 action 을 N번 연속 dismiss 하면 더 긴 cooldown 적용.
 */
export default function NextActionCard({ action }: { action: NextAction }) {
  const [dismissed, setDismissed] = useState(false)

  // 24h dismiss 체크 — 같은 action.type + 같은 날 거부 이력 있으면 안 보임.
  // server 가 다시 결정한 action 이라도 사용자 의사 존중.
  useEffect(() => {
    const key = `ft:next-action:dismiss:${action.type}`
    const value = localStorage.getItem(key)
    if (!value) return
    const ts = Number(value)
    if (Number.isFinite(ts) && Date.now() - ts < 24 * 60 * 60 * 1000) {
      setDismissed(true)
    }
  }, [action.type])

  function handleDismiss(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDismissed(true)
    try {
      localStorage.setItem(
        `ft:next-action:dismiss:${action.type}`,
        String(Date.now()),
      )
    } catch {
      /* localStorage 차단 환경에선 세션 동안만 숨김 */
    }
  }

  if (dismissed) return null

  // tone 별 색 매핑. CSS variable 로 디자인 토큰 일관성.
  const toneColor: Record<NextAction['tone'], string> = {
    terracotta: 'var(--terracotta)',
    gold: 'var(--gold)',
    moss: 'var(--moss)',
  }
  const accent = toneColor[action.tone]

  return (
    <div className="relative mx-5 mt-3">
      <Link
        href={action.href}
        className="group block px-5 py-4 rounded-2xl border bg-white active:scale-[0.99] transition"
        style={{
          borderColor: 'var(--rule)',
          boxShadow: `inset 4px 0 0 ${accent}`,
        }}
        aria-label={`${action.title} — ${action.cta}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 pr-6">
            <span
              className="kicker"
              style={{ color: accent }}
            >
              오늘의 한 가지
            </span>
            <div
              className="font-serif mt-1.5 leading-tight"
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              {action.title}
            </div>
            <p
              className="mt-1 text-[12px] leading-relaxed"
              style={{ color: 'var(--muted)' }}
            >
              {action.subtitle}
            </p>
          </div>
          <span
            className="shrink-0 mt-0.5 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold transition group-hover:translate-x-0.5"
            style={{
              background: accent,
              color: '#FFFFFF',
            }}
          >
            {action.cta}
            <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
          </span>
        </div>
      </Link>
      {/* 우상단 dismiss — 견주 자율성 우선 (voice-guidelines §5).
          24h 동안 같은 action.type 숨김. localStorage 기반이라 device 별 동작. */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="이 안내 24시간 동안 숨기기"
        className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-muted hover:bg-bg transition"
      >
        <X className="w-3.5 h-3.5" strokeWidth={2} />
      </button>
    </div>
  )
}
