import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { PersonaCardSpec } from '@/lib/persona'

/**
 * PersonaCard — 페르소나 기반 권유 카드.
 *
 * dashboard 에서 NextActionCard 와는 별개로 1개 노출. 사용자 행동 패턴에
 * 맞춰 "이거 한 번 더 해보실래요?" 톤 가벼운 추천.
 *
 * # voice-guidelines §10
 * 페르소나는 분류가 아닌 가이드 — 카드에 "당신은 △△ 타입" 표기 X.
 * 그냥 행동 권유만.
 */
export default function PersonaCard({ spec }: { spec: PersonaCardSpec }) {
  const toneColor: Record<PersonaCardSpec['tone'], string> = {
    terracotta: 'var(--terracotta)',
    gold: 'var(--gold)',
    moss: 'var(--moss)',
  }
  const accent = toneColor[spec.tone]

  return (
    <div className="mx-5 mt-3">
      <Link
        href={spec.href}
        className="group block px-5 py-4 rounded-2xl border bg-white active:scale-[0.99] transition"
        style={{
          borderColor: 'var(--rule)',
          boxShadow: `inset 4px 0 0 ${accent}`,
        }}
        aria-label={`${spec.title} — ${spec.cta}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className="kicker" style={{ color: accent }}>
              {spec.kicker}
            </span>
            <div
              className="font-serif mt-1.5 leading-tight"
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              {spec.title}
            </div>
            <p
              className="mt-1 text-[12px] leading-relaxed"
              style={{ color: 'var(--muted)' }}
            >
              {spec.subtitle}
            </p>
          </div>
          <span
            className="shrink-0 mt-0.5 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold transition group-hover:translate-x-0.5"
            style={{ background: accent, color: 'white' }}
          >
            {spec.cta}
            <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
          </span>
        </div>
      </Link>
    </div>
  )
}
