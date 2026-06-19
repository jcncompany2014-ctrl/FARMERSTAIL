/**
 * XL-4 (#13) — Intervention Window Card (출원서 모듈 G).
 *
 * 체중 추세 기반 위험 도달 ETA 경보. 'urgent' 일 때만 빨간 카드,
 * 'watch' 일 때 노란, 'safe'/'insufficient_data'/'noisy' 는 미렌더.
 *
 * # R55 perf 정리
 *  - server component fetch 제거 → 부모 (dogs/[id]/page.tsx) 가 데이터
 *    Promise.all 안에서 fetch 후 props 로 전달.
 *  - 이전: 강아지 상세 진입 시 dog + weight_logs + surveys 3건 추가
 *    fetch (부모와 중복).
 *  - 이후: window evaluate 만 — 순수 함수 컴포넌트.
 */
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import type { InterventionWindow } from '@/lib/intervention-window'

interface Props {
  dogId: string
  window: InterventionWindow
}

export default function InterventionWindowCard({ window }: Props) {
  // safe / insufficient_data / noisy → 미렌더 (잡음 방지)
  if (
    window.verdict === 'safe' ||
    window.verdict === 'insufficient_data' ||
    window.verdict === 'noisy'
  ) {
    return null
  }

  const isUrgent = window.verdict === 'urgent'
  const isObesity =
    window.obesityEtaDays != null &&
    (window.underweightEtaDays == null ||
      window.obesityEtaDays < window.underweightEtaDays)
  const Icon = isUrgent
    ? AlertTriangle
    : isObesity
      ? TrendingUp
      : TrendingDown

  return (
    <section
      role={isUrgent ? 'alert' : 'region'}
      aria-live={isUrgent ? 'assertive' : 'polite'}
      aria-label="체중 추세 분석"
      className={`mx-5 mt-3 rounded border p-4 ${
        isUrgent ? 'border-sale bg-sale/8' : 'border-gold bg-gold/15'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            isUrgent ? 'bg-sale/15 text-sale' : 'bg-gold/30 text-ink'
          }`}
        >
          <Icon className="w-4 h-4" strokeWidth={2.4} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-mute">
            {isUrgent ? '개입 권장' : '관찰 권장'}
            <span className="ml-2 font-normal text-mute/70">
              (체중 추세 분석)
            </span>
          </div>
          <p className="text-[13.5px] font-semibold text-ink mt-1.5 leading-snug">
            {window.userMessage}
          </p>
          <div className="text-[10.5px] text-mute mt-1.5">
            추세: {window.weightSlopeKgPerDay > 0 ? '+' : ''}
            {(window.weightSlopeKgPerDay * 30).toFixed(2)} kg/월 · 정밀도{' '}
            {(window.rSquared * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    </section>
  )
}
