import Link from 'next/link'
import { Sparkles, ChevronRight } from 'lucide-react'
import { accuracyLabel } from '@/lib/personalization/reliability'

/**
 * AccuracyCard — "맞춤도" 표시 카드.
 *
 * voice-guidelines §1 — "신뢰도" 단어 금지. 라벨은 accuracyLabel():
 * 0.85+ 정밀 케어 가족 / 0.7+ 안정적 / 0.5+ 성장 중 / 그 외 초기.
 *
 * # 노출 조건
 * 호출처가 score 결정. 0.5 미만이면 카드 자체는 보여줘도 톤이
 * 부드러워야 (초기 단계 응원). 0.85+ 도달 시 sparkles + 정밀 케어 라벨.
 *
 * # 정책
 * - 점수 절대값은 작은 글씨 (87%). 라벨이 메인.
 * - "더 정확히" CTA → dog edit 페이지 (측정 도구 설정).
 *
 * # voice-guidelines §6
 * 첫 4주 보호 phase 안에서는 호출처가 이 카드를 비표시 처리할 수 있음.
 * 이 컴포넌트 자체는 조건 분기 X — 호출처 책임.
 */
export default function AccuracyCard({
  score,
  dogId,
  dogName,
}: {
  /** 0~1 종합 신뢰도. overallReliability() 결과. */
  score: number
  /** 측정 도구 설정 페이지 링크용 */
  dogId: string | null
  dogName: string | null
}) {
  const { text, percent } = accuracyLabel(score)
  const isHigh = score >= 0.85
  const accent = isHigh ? 'var(--terracotta)' : 'var(--moss)'
  const headline = dogName
    ? `${dogName}의 ${text}`
    : `${text}`

  const subtitle =
    score >= 0.85
      ? '측정 도구가 잘 갖춰져 있어 분석이 정확해요'
      : score >= 0.7
        ? '거의 다 왔어요. 한두 가지만 더 맞추면 정밀 케어 가족이에요'
        : score >= 0.5
          ? '데이터가 차곡차곡 쌓이고 있어요'
          : '천천히 익숙해지면 돼요. 오늘 한 가지만 측정해도 충분해요'

  const href = dogId ? `/dogs/${dogId}/edit` : '/dogs'

  return (
    <section className="px-5 mt-3">
      <Link
        href={href}
        className="group block rounded border bg-bg-3 px-5 py-4 active:scale-[0.99] transition"
        style={{ borderColor: 'var(--rule)', boxShadow: `inset 4px 0 0 ${accent}` }}
        aria-label={`맞춤도 ${percent}% — ${text}. 측정 도구 점검`}
      >
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              background: `color-mix(in srgb, ${accent} 12%, white)`,
              color: accent,
            }}
            aria-hidden
          >
            <Sparkles className="w-5 h-5" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="kicker" style={{ color: accent }}>
                맞춤도
              </span>
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ color: 'var(--muted)' }}
              >
                {percent}%
              </span>
            </div>
            <p
              className="font-serif mt-1 leading-tight"
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              {headline}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              {subtitle}
            </p>

            {/* 진행 바 */}
            <div
              className="mt-3 h-1.5 rounded-full overflow-hidden"
              style={{
                background: `color-mix(in srgb, ${accent} 12%, white)`,
              }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div
                className="h-full rounded-full transition-[width]"
                style={{ width: `${percent}%`, background: accent }}
              />
            </div>

            <div
              className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-bold transition group-hover:translate-x-0.5"
              style={{ color: accent }}
            >
              측정 도구 점검
              <ChevronRight className="w-3 h-3" strokeWidth={2.2} />
            </div>
          </div>
        </div>
      </Link>
    </section>
  )
}
