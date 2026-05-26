/**
 * XL-4 (#13) — Intervention Window Card (출원서 모듈 G).
 *
 * 체중 추세 기반 위험 도달 ETA 경보. 'urgent' 일 때만 빨간 카드,
 * 'watch' 일 때 노란, 'safe'/'insufficient_data'/'noisy' 는 미렌더.
 *
 * Server component — Supabase fetch + 평가 후 결과만 클라이언트로.
 */
import Link from 'next/link'
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { evaluateInterventionWindow } from '@/lib/intervention-window'

interface Props {
  dogId: string
}

// React 19 purity rule — Date.now() 를 컴포넌트 body 밖 helper 로.
function sixMonthsAgoIso(): string {
  return new Date(Date.now() - 180 * 86_400_000).toISOString()
}

export default async function InterventionWindowCard({ dogId }: Props) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: dog } = await supabase
    .from('dogs')
    .select('id, name, weight')
    .eq('id', dogId)
    .maybeSingle()
  if (!dog || !dog.weight) return null

  // 최근 6개월 체중 추이 (12개월은 너무 길어 추세 흐려질 수 있음)
  const sinceIso = sixMonthsAgoIso()
  const { data: logs } = await supabase
    .from('weight_logs')
    .select('measured_at, weight')
    .eq('dog_id', dogId)
    .eq('user_id', user.id)
    .gte('measured_at', sinceIso)
    .order('measured_at', { ascending: true })
    .limit(40)

  // 최근 survey 의 BCS
  const { data: survey } = await supabase
    .from('surveys')
    .select('answers')
    .eq('dog_id', dogId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const surveyAnswers =
    ((survey?.answers as unknown) ?? {}) as { bcsExact?: number }

  const window = evaluateInterventionWindow({
    weightLogs: (logs ?? []).map((l) => ({
      date: l.measured_at,
      weightKg: l.weight,
    })),
    currentBcs: surveyAnswers.bcsExact ?? 5,
    currentWeightKg: dog.weight,
    idealWeightKg: null,
  })

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
      className={`mx-5 mt-3 rounded border p-4 ${
        isUrgent
          ? 'border-sale bg-sale/8'
          : 'border-amber-500/60 bg-amber-500/8'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            isUrgent ? 'bg-sale/15 text-sale' : 'bg-amber-500/15 text-amber-700'
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
          <p className="text-[13px] font-semibold text-ink mt-1 leading-snug">
            {window.userMessage}
          </p>
          <div className="text-[10.5px] text-mute mt-1.5">
            추세: {window.weightSlopeKgPerDay > 0 ? '+' : ''}
            {(window.weightSlopeKgPerDay * 30).toFixed(2)} kg/월 · 신뢰도{' '}
            {(window.rSquared * 100).toFixed(0)}%
          </div>
          <Link
            href={`/dogs/${dog.id}/simulate`}
            className="inline-block mt-2.5 text-[11px] font-semibold text-ink underline decoration-1 underline-offset-2"
          >
            식단 시뮬레이션으로 시나리오 비교 →
          </Link>
        </div>
      </div>
    </section>
  )
}
