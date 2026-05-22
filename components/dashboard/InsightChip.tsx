import Link from 'next/link'
import { TrendingUp, ArrowRight } from 'lucide-react'

/**
 * InsightChip — sensitivity snapshot 의 가장 영향 큰 변수 안내.
 *
 * pastSnapshot.top_variable (weightKg / bcs / activityFactor) 를 사용자
 * 친화 라벨로 변환해 "이번 주 가장 영향 큰 신호" 1줄 표시.
 *
 * voice-guidelines §1 — "신뢰도" 단어 X. 변수 자체를 그대로 노출하지
 * 않고 사용자 친화 표현.
 *
 * 가치: 보호자가 어떤 변수가 식단에 가장 영향 주는지 인식 → 그 변수의
 * 측정 도구 점검 동기 부여.
 */

const VAR_LABEL: Record<string, { label: string; href?: string }> = {
  weightKg: { label: '체중', href: '/dogs' },
  bcs: { label: '체형 (BCS)' },
  activityFactor: { label: '활동량' },
  lifeStage: { label: '라이프 스테이지' },
  neutered: { label: '중성화 여부' },
}

export default function InsightChip({
  topVariable,
  topDelta,
  dogId,
}: {
  topVariable: string
  topDelta: number
  dogId: string | null
}) {
  const meta = VAR_LABEL[topVariable]
  if (!meta) return null

  const href = dogId ? `/dogs/${dogId}` : '/dogs'
  const sign = topDelta >= 0 ? '+' : '-'
  const absDelta = Math.abs(topDelta)

  return (
    <section className="px-5 mt-3">
      <Link
        href={href}
        className="group flex items-center gap-3 rounded border bg-bg-3 px-4 py-3 active:scale-[0.99] transition"
        style={{ borderColor: 'var(--rule)' }}
        aria-label={`이번 주 가장 영향 큰 변수: ${meta.label}`}
      >
        <span
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
          style={{
            background: 'color-mix(in srgb, var(--moss) 14%, white)',
            color: 'var(--moss)',
          }}
          aria-hidden
        >
          <TrendingUp className="w-3.5 h-3.5" strokeWidth={2.2} />
        </span>
        <div className="flex-1 min-w-0">
          <span
            className="kicker block"
            style={{ color: 'var(--muted)' }}
          >
            이번 주 가장 영향 큰 신호
          </span>
          <p
            className="text-[12.5px] font-bold mt-0.5"
            style={{ color: 'var(--ink)' }}
          >
            {meta.label} ({sign}1 변화 시 ~{absDelta} g/일)
          </p>
        </div>
        <ArrowRight
          className="w-3.5 h-3.5 text-muted transition group-hover:translate-x-0.5"
          strokeWidth={2.2}
        />
      </Link>
    </section>
  )
}
