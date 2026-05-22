import Link from 'next/link'
import { PartyPopper, ArrowRight } from 'lucide-react'
import type { Milestone } from '@/lib/dashboard/milestones'
import { renderMilestoneMessage } from '@/lib/dashboard/milestones'

/**
 * MilestoneCard — 마일스톤 축하 카드.
 *
 * voice-guidelines §10. "초롱이의 100일" 같은 시점에 노출. 시스템의
 * 성공이 아닌 견의 성취를 축하 (견 주어 + 칭찬 톤).
 *
 * 마일스톤 도달 후 7일 동안 자동 노출. 같은 마일스톤이 다시 안 보이도록
 * 도달 날짜 기록은 클라이언트 localStorage (server snapshot 부담 ↓).
 *
 * # CTA (옵션)
 * 365일+ 마일스톤은 호출처가 cta { href, label } 을 전달 — "회고 보기"
 * 같은 행동 유도. 미전달 시 카드는 read-only 축하만.
 */
export default function MilestoneCard({
  milestone,
  dogName,
  cta,
}: {
  milestone: Milestone
  dogName: string | null
  cta?: { href: string; label: string } | null
}) {
  const message = renderMilestoneMessage(milestone, dogName)

  const toneColor: Record<Milestone['tone'], string> = {
    gold: 'var(--gold)',
    terracotta: 'var(--terracotta)',
    moss: 'var(--moss)',
  }
  const accent = toneColor[milestone.tone]

  return (
    <section className="px-5 mt-3">
      <div
        className="rounded px-5 py-4"
        style={{
          background: `color-mix(in srgb, ${accent} 8%, white)`,
          border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: accent, color: 'white' }}
          >
            <PartyPopper className="w-5 h-5" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <span
              className="kicker"
              style={{ color: accent }}
            >
              {milestone.kicker} · {milestone.label}
            </span>
            <p
              className="font-serif mt-1.5 leading-snug"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--ink)',
                letterSpacing: '-0.01em',
              }}
            >
              {message}
            </p>
            {cta && (
              <Link
                href={cta.href}
                className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold text-white transition active:scale-[0.99]"
                style={{ background: accent }}
              >
                {cta.label}
                <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
