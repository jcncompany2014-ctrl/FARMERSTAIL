import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { NextAction } from '@/lib/dashboard/next-action'

/**
 * Dashboard "오늘 할 일" 카드 — computeNextAction 의 결과 1개를 시각화.
 *
 * # 디자인
 * - tone 별 다른 accent 색 (terracotta=강조, gold=권유, moss=리마인더)
 * - 단일 CTA — 과한 선택지 X. 사용자가 매일 들어와 한 번에 흐름 진입.
 * - 카드 자체가 Link — 모바일 탭 영역 보장 (CTA 버튼만 작아도 카드 어디든 탭).
 * - kicker "오늘의 한 가지" — 매일 들러도 자기 위치 알 수 있게.
 */
export default function NextActionCard({ action }: { action: NextAction }) {
  // tone 별 색 매핑. CSS variable 로 디자인 토큰 일관성.
  const toneColor: Record<NextAction['tone'], string> = {
    terracotta: 'var(--terracotta)',
    gold: 'var(--gold)',
    moss: 'var(--moss)',
  }
  const accent = toneColor[action.tone]

  return (
    <Link
      href={action.href}
      className="group block px-5 py-4 rounded-2xl border bg-white active:scale-[0.99] transition mx-5 mt-3"
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
  )
}
