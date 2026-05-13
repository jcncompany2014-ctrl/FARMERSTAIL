'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, EyeOff } from 'lucide-react'
import type { NextAction } from '@/lib/dashboard/next-action'

/**
 * Dashboard "오늘 할 일" 카드 — computeNextAction 의 결과 1개를 시각화.
 *
 * # 디자인
 * - tone 별 다른 accent 색 (terracotta=강조, gold=권유, moss=리마인더)
 * - 단일 CTA — 과한 선택지 X. 사용자가 매일 들어와 한 번에 흐름 진입.
 * - 카드 자체가 Link — 모바일 탭 영역 보장.
 *
 * # 견주 자율성 — "이 안내 숨기기"
 * docs/voice-guidelines.md §5 정책. dismiss 는 카드 외곽이 아닌 카드
 * 아래의 별도 텍스트 링크. 카드 안 absolute X 버튼은 CTA pill 과 위치
 * 충돌이 발생해서 footer 패턴으로 변경.
 *
 * type 별 24h dismiss (localStorage). 동일 type 의 안내는 다음 day 부터
 * 다시 표시.
 */
export default function NextActionCard({ action }: { action: NextAction }) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const key = `ft:next-action:dismiss:${action.type}`
    const value = localStorage.getItem(key)
    if (!value) return
    const ts = Number(value)
    if (Number.isFinite(ts) && Date.now() - ts < 24 * 60 * 60 * 1000) {
      setDismissed(true)
    }
  }, [action.type])

  function handleDismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(
        `ft:next-action:dismiss:${action.type}`,
        String(Date.now()),
      )
    } catch {
      /* localStorage 차단 환경은 세션 동안만 숨김 */
    }
  }

  if (dismissed) return null

  const toneColor: Record<NextAction['tone'], string> = {
    terracotta: 'var(--terracotta)',
    gold: 'var(--gold)',
    moss: 'var(--moss)',
  }
  const accent = toneColor[action.tone]

  return (
    <div className="mx-5 mt-3">
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
          <div className="flex-1 min-w-0">
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
      {/* dismiss — 카드 아래 별도 line. 카드 위 absolute X 는 CTA pill 과
          충돌. 작은 텍스트 링크로 시각적 부담 ↓. */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="이 안내 24시간 동안 숨기기"
        className="mt-1.5 ml-1 inline-flex items-center gap-1 px-2 py-1 text-[10.5px] font-semibold text-muted/70 hover:text-muted transition"
      >
        <EyeOff className="w-3 h-3" strokeWidth={2} />이 안내 숨기기
      </button>
    </div>
  )
}
