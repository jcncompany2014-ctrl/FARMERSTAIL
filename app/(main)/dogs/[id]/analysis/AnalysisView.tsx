'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ShieldCheck,
  AlertTriangle,
  Stethoscope,
  FlaskConical,
  Beef,
  Droplet,
  Wheat,
  Leaf,
  ArrowRight,
  LineChart,
  Scale,
  Minus,
  TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { getAAFCORanges, stageFromKR } from '@/lib/nutrition'
import StructuredAnalysis from '@/components/analysis/StructuredAnalysis'
import RecommendationBox from '@/components/analysis/RecommendationBox'
import { fetchComputedFormula } from '@/lib/personalization/formulaCache'
import { weightReliability } from '@/lib/personalization/reliability'
import FeedingPlanCard from '@/components/analysis/FeedingPlanCard'
import PriceFramingCard from '@/components/analysis/PriceFramingCard'
import NutrientGauges38 from '@/components/analysis/NutrientGauges38'
import { WARM_CREAM } from '@/components/analysis/magazine/palette'
import type { NutrientRow as MagNutrientRow } from '@/components/analysis/magazine/NutrientsCard'
import type { BoxMixItem as MagBoxMixItem } from '@/components/analysis/magazine/BoxMixCard'
import type { SupplementItem as MagSupplementItem } from '@/components/analysis/magazine/SupplementsCard'
import { CornerMark as MagCornerMark } from '@/components/analysis/magazine/ReportCard'
import {
  merConfidenceInterval,
  formatRange,
} from '@/lib/nutrition/confidence-interval'
import {
  riskFlagLabel,
  riskFlagDesc,
  riskFlagSeverity,
} from '@/lib/nutrition/risk-flags'
import { summarizeHistory } from '@/lib/analysis/narrative'
import { FOOD_LINE_META, ALL_LINES } from '@/lib/personalization/lines'
import type { Formula } from '@/lib/personalization/types'
import {
  weightFromRER,
  formatAgeLabel,
  mapSupplements,
  formatDate,
} from '@/lib/v3-helpers/analysis-view'
import AnalysisEmptyState from './_components/AnalysisEmptyState'
import AnalysisStickySummary from './_components/AnalysisStickySummary'
import AnalysisArchiveBanner from './_components/AnalysisArchiveBanner'
import AnalysisMagazineSection from './_components/AnalysisMagazineSection'
import AnalysisCTASection from './_components/AnalysisCTASection'
import TrendRow from './_components/TrendRow'
import Stat from './_components/Stat'
import Bar from './_components/Bar'

type Analysis = {
  id: string
  mer: number
  rer: number
  factor: number
  stage: string
  bcs_label: string
  bcs_score: number
  protein_pct: number
  protein_g: number
  fat_pct: number
  fat_g: number
  carb_pct: number
  carb_g: number
  fiber_pct: number
  fiber_g: number
  feed_g: number
  ca_p_ratio: number
  supplements: string[]
  commentary: string | null
  created_at: string
  // v2 추가
  risk_flags?: string[] | null
  vet_consult_recommended?: boolean | null
  next_review_date?: string | null
  guideline_version?: string | null
}

type HistoryPoint = {
  date: string
  bcs: number
  weight: number
}

type Dog = {
  id: string
  name: string
  breed: string | null
  birth_date: string | null
  age_value: number | null
  age_unit: string | null
  photo_url: string | null
  // 분석 카드에 표시할 실제 등록 체중. RER 역산(weightFromRER)은 70·W^0.75 를
  // 뒤집는데 computeRer 가 토이견(<2kg)에 다른 식을 써서 역산이 부정확하다.
  weight: number | null
  // H5: MER 신뢰구간을 실제 체중 측정 신뢰도로 산정하기 위해 추가.
  weight_method: string | null
  weight_measured_at: string | null
}

export default function AnalysisView({
  dogId,
  analysisId,
  surveyBlockedDays,
}: {
  dogId: string
  /** When set, load this specific historical analysis instead of the latest. */
  analysisId?: string
  /**
   * R80-P1: survey 30일 가드로 redirect 된 경우 남은 일수 (1-30).
   * useEffect 에서 1회 toast 표시 후 URL 정리.
   */
  surveyBlockedDays?: number | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  // R80-P1: 30일 가드 안내 toast — server page 에서 prop 으로 받음.
  // mount 직후 1회만, URL 의 from/days query 제거해 새로고침 시 재발 X.
  // 사장님 2026-06-19: 토스트가 2번 떴음 → ref 가드로 이중 발화(StrictMode·재마운트) 차단.
  const blockedToastShownRef = useRef(false)
  useEffect(() => {
    if (!surveyBlockedDays || surveyBlockedDays <= 0) return
    if (blockedToastShownRef.current) return
    blockedToastShownRef.current = true
    toast.info(
      `지난 분석 후 30일이 안 됐어요 (${surveyBlockedDays}일 남음). 체중이나 건강 정보가 바뀌었다면, 정보를 고친 뒤 다시 분석할 수 있어요.`,
    )
    // URL 정리
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('from')
      url.searchParams.delete('days')
      window.history.replaceState({}, '', url.toString())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [dog, setDog] = useState<Dog | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  // 2026-05-21: Magazine BoxMixCard 를 실제 추천 알고리즘과 연동.
  // RecommendationBox 도 자체 fetch 중이라 중복 호출이지만 첫 박스 시점
  // formula 는 deterministic — 가벼운 작업이라 두 번 호출 허용.
  const [formula, setFormula] = useState<Formula | null>(null)
  // Legacy commentary fetch 는 StructuredAnalysis v2 가 대체. 상태 변수는 제거.

  // 설문 완료 응원 포인트 toast — survey/page.tsx 가 sessionStorage 에
  // R37b — 설문에서 넘어온 직후 (?fromSurvey=1) 스크롤 위치 reset.
  // 라우터 캐시로 인해 이전 페이지의 스크롤 위치가 유지될 수 있음. 결과
  // 페이지는 항상 top 부터 — 사용자 경험상 처음부터 읽도록.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    if (q.get('fromSurvey') === '1') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  }, [])

  // 저장해두면 마운트 시 한 번 표시 후 제거. 멱등성은 ledger RPC 가 보장.
  // 5분 만료 — 새 탭/리프레시 후 한참 뒤 들어오면 노출 X.
  useEffect(() => {
    if (typeof window === 'undefined') return
    let raw: string | null = null
    try {
      raw = sessionStorage.getItem('ft:survey-reward')
      if (!raw) return
      sessionStorage.removeItem('ft:survey-reward')
    } catch {
      return
    }
    try {
      const reward = JSON.parse(raw) as {
        amount?: number
        balanceAfter?: number | null
        ts?: number
      }
      if (!reward.amount || !reward.ts) return
      if (Date.now() - reward.ts > 5 * 60 * 1000) return
      toast.success(
        `정성껏 답변해주셔서 고마워요 — 응원 포인트 ${reward.amount.toLocaleString()}P 적립`,
      )
    } catch {
      /* noop — 파싱 실패는 조용히 무시 */
    }
  }, [toast])

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: dogData } = await supabase
        .from('dogs')
        .select(
          'id, name, breed, birth_date, age_value, age_unit, photo_url, weight, weight_method, weight_measured_at',
        )
        .eq('id', dogId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!dogData) {
        router.push('/dogs')
        return
      }
      setDog(dogData)

      // Load every analysis so we can (a) pick the target, (b) build a rolling
      // history of up to 6 around the target. Volume is tiny — one row per
      // survey completion — so a full select is cheap and simpler than
      // two separate queries.
      const { data: rows } = await supabase
        .from('analyses')
        .select('*')
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        // 무제한 select 가드 — 100건+ 누적 시 memory/network ↑.
        // history 6 개만 보여주는 UI 라 50 으로 충분.
        .limit(50)

      if (!rows || rows.length === 0) {
        setLoading(false)
        return
      }

      setTotalCount(rows.length)

      const target = analysisId
        ? (rows.find((r: { id: string }) => r.id === analysisId) ?? null)
        : rows[0]

      if (!target) {
        setLoading(false)
        return
      }

      // audit #79: generated analyses row 와 도메인 Analysis 타입 nullable 차이
      // — UI 가 null fallback 이미 처리. cast 우회.
      setAnalysis(target as unknown as Analysis)

      // For the trend chart: everything up to and including the target
      // (so older detail views show the timeline state as of that reading).
      const targetTime = new Date(target.created_at!).getTime()
      type AnalysisRow = {
        id: string
        created_at: string
        bcs_score: number | null
        rer: number
      }
      const upToTarget = (rows as AnalysisRow[]).filter(
        (r) => new Date(r.created_at).getTime() <= targetTime
      )
      // Take latest 6 and flip oldest→newest for left-to-right charts.
      const points = upToTarget
        .slice(0, 6)
        .reverse()
        .map((r) => ({
          date: r.created_at,
          bcs: r.bcs_score ?? 5,
          weight: +weightFromRER(Number(r.rer)).toFixed(1),
        }))
      setHistory(points)
      setLoading(false)
    }
    // R97-B (D7): load() 내부 auth/dogs/analyses fetch 중 throw (네트워크
    // 끊김 / Supabase 5xx / RLS 거부) 시 setLoading(false) 미도달 → 무한
    // 스피너 먹통이었음. rejected promise 를 .catch 로 잡아 loading 해제 →
    // AnalysisEmptyState (돌아가기 + 설문 CTA) 로 graceful 후퇴.
    void load().catch(() => setLoading(false))
  }, [dogId, analysisId, router, supabase])

  // formula fetch — Magazine BoxMixCard 가 dog 별 동적 lineRatios 표시 위해.
  useEffect(() => {
    if (!dog || analysisId) return // archive 모드는 skip — 현 시점 formula 의미 X
    let cancelled = false
    ;(async () => {
      try {
        // 공유 fetch — RecommendationBox 와 중복 POST 제거 (audit P0: double-compute).
        const { httpOk, body: json } = await fetchComputedFormula(dogId, 1)
        if (cancelled || !httpOk || json.ok !== true) return
        setFormula(json.formula)
      } catch {
        /* silent — Magazine BoxMix 는 fallback hardcode 로 표시 */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dogId, analysisId, dog])

  // Legacy commentary fetch effect 는 StructuredAnalysis v2 가 대체. 제거.

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="w-8 h-8 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
      </div>
    )

  if (!analysis || !dog) {
    return <AnalysisEmptyState dogId={dogId} />
  }

  const ranges = getAAFCORanges(stageFromKR(analysis.stage))
  const isArchive = !!analysisId
  const analysisDate = new Date(analysis.created_at).toLocaleDateString(
    'ko-KR',
    { year: 'numeric', month: 'short', day: 'numeric' }
  )

  // ────────────────────────────────────────────────────────────────
  // Magazine Edition (2026-05-21) — Claude Design 'SURVEY TIME' handoff.
  // 기존 컴포넌트는 보존하고 페이지 상단에 새 디자인 시각만 prepended.
  // ────────────────────────────────────────────────────────────────
  const createdAt = new Date(analysis.created_at)
  const magDateLabel = `${String(createdAt.getMonth() + 1).padStart(2, '0')}.${String(createdAt.getDate()).padStart(2, '0')}`
  const magAgeLabel = formatAgeLabel(dog)
  // 현재 분석은 등록된 실제 체중을 그대로 표시한다. RER 역산은 토이견(<2kg)
  // 에서 +14~48% 오차 + asymmetric care goal 의 safetyWeightShift 가 섞인
  // "내부 목표체중" 이라 사용자가 입력한 값과 다르다. archive(과거 분석)는
  // 당시 체중을 따로 저장하지 않아 그 분석의 RER 로 역산(차선).
  const magWeightKg =
    !isArchive && dog.weight != null
      ? +dog.weight.toFixed(1)
      : +weightFromRER(analysis.rer).toFixed(1)
  // MER 신뢰구간 — 체중 측정 신뢰도(method+recency)로 폭 결정. MER=RER=70×W^0.75
  // 라 체중 측정 품질이 구간을 지배한다 (H5: 이전엔 null 고정 → 가짜 ±8%).
  const merAccuracy = weightReliability(
    dog.weight_method,
    dog.weight_measured_at,
  )
  const magMerCi = merConfidenceInterval(analysis.mer, merAccuracy)
  const magMerMin = magMerCi.low
  const magMerMax = magMerCi.high
  const magNutrientRows: MagNutrientRow[] = [
    {
      key: 'protein',
      name: '단백질',
      emoji: '🍗',
      value: Math.round(analysis.protein_pct),
      gpd: Math.round(analysis.protein_g),
      min: ranges.protein.min,
      max: ranges.protein.max,
    },
    {
      key: 'fat',
      name: '지방',
      emoji: '🥑',
      value: Math.round(analysis.fat_pct),
      gpd: Math.round(analysis.fat_g),
      min: ranges.fat.min,
      max: ranges.fat.max,
    },
    {
      key: 'carb',
      name: '탄수화물',
      emoji: '🌽',
      value: Math.round(analysis.carb_pct),
      gpd: Math.round(analysis.carb_g),
      min: ranges.carb?.min ?? 0,
      max: ranges.carb?.max ?? 60,
    },
    {
      key: 'fiber',
      name: '식이섬유',
      emoji: '🥕',
      value: Math.round(analysis.fiber_pct),
      gpd: Math.round(analysis.fiber_g),
      min: ranges.fiber?.min ?? 1,
      max: ranges.fiber?.max ?? 8,
    },
  ]
  // 5종 박스 — 실제 추천 알고리즘 (formula.lineRatios) 결과로 동적 생성.
  // formula fetch 실패 시 FOOD_LINE_META 기반 균등 분포 default.
  // FOOD_LINE_META 매핑: basic=닭 / weight=오리 / skin=연어 / premium=소 / joint=돼지.
  const MAG_LINE_SUB: Record<string, string> = {
    basic: '단일 단백원 · 소화 부담 낮음',
    weight: '저칼로리 · 단호박 · BCS 6+',
    skin: 'Omega-3 · 피부·털',
    premium: '헴 철분 · 아연 · 활동량 多',
    joint: 'B1·콜린 · 관절·시니어',
  }
  const magBoxItems: MagBoxMixItem[] = (
    formula
      ? ALL_LINES.filter((line) => (formula.lineRatios[line] ?? 0) > 0)
      : ALL_LINES
  ).map((line) => {
    const meta = FOOD_LINE_META[line]
    const ratio = formula
      ? (formula.lineRatios[line] ?? 0)
      : line === 'basic' || line === 'premium'
        ? 0.3
        : line === 'skin'
          ? 0.2
          : 0.1
    const pct = Math.round(ratio * 100)
    return {
      key: line,
      name: meta.name,
      ko: meta.subtitle,
      pct,
      kcal: Math.round(analysis.mer * ratio),
      g: Math.round(analysis.feed_g * ratio),
      sub: MAG_LINE_SUB[line] ?? meta.benefit,
    }
  })
  const magSupplementItems: MagSupplementItem[] = mapSupplements(analysis.supplements ?? [])

  return (
    <div className="pb-10 pt-1">
      <AnalysisStickySummary
        dogName={dog.name}
        merKcal={analysis.mer}
        feedG={analysis.feed_g}
        bcsLabel={analysis.bcs_label}
        analysisDate={analysisDate}
      />

      {/* 참고할 점(안전·주의 신호) — 결과 최상단이 아니라 페이지 최하단으로 이동
          (사장님 지시 2026-06-19, 긍정 결과 먼저·참고는 마지막). 렌더는 하단
          AnalysisCTASection 뒤. */}

      {/* 히스토리 뷰: 이 분석이 언제 것인지 명시 */}
      {isArchive && (
        <AnalysisArchiveBanner dogId={dogId} analysisDate={analysisDate} />
      )}

      {/* ─────────────────────────────────────────────────────────────
          Magazine Edition (2026-05-21) — 새 분석 결과 카드 묶음.
          archive 모드에서는 숨김 (역사적 데이터 컨텍스트와 충돌 방지).
          기존 컴포넌트 (FeedingPlanCard / RecommendationBox /
          StructuredAnalysis) 는 아래 그대로 보존.
          ───────────────────────────────────────────────────────────── */}
      {!isArchive && (
        <AnalysisMagazineSection
          dogId={dogId}
          dogName={dog.name}
          dogBreed={dog.breed}
          dogPhotoUrl={dog.photo_url}
          isArchive={isArchive}
          ageLabel={magAgeLabel}
          weightKg={magWeightKg}
          dateLabel={magDateLabel}
          stage={analysis.stage}
          bcsScore={analysis.bcs_score}
          bcsLabel={analysis.bcs_label}
          proteinPct={analysis.protein_pct}
          analysisDate={analysisDate}
          guidelineVersion={analysis.guideline_version}
          merKcal={analysis.mer}
          merMin={magMerMin}
          merMax={magMerMax}
          rer={analysis.rer}
          factor={analysis.factor}
          feedG={analysis.feed_g}
          nutrientRows={magNutrientRows}
          boxItems={magBoxItems}
          supplementItems={magSupplementItems}
          history={history}
          totalCount={totalCount}
        />
      )}

      {/* 옛 Hero 폐기 (2026-05-21) — Magazine HeroSection + DiagnosisCard 가 대체. */}
      <section className="px-5 mt-4 text-center" style={{ display: 'none' }}>
        <span className="kicker inline-block">Nutrition Report</span>
        <h1
          className="font-sans mt-1.5"
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          {dog.name} 맞춤 영양 분석
        </h1>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-moss/10 text-moss text-[10.5px] font-bold tracking-[0.15em] uppercase mt-3">
          <ShieldCheck className="w-3 h-3" strokeWidth={2.5} />
          AAFCO 2024 충족
        </div>
      </section>

      {/* 옛 Energy card 폐기 (2026-05-21) — Magazine DailyEnergy + AtAGlance 가 대체. */}
      <section className="px-5 mt-5" style={{ display: 'none' }}>
        <div className="bg-bg-3 rounded border border-rule p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10.5px] font-semibold text-muted uppercase tracking-[0.2em]">
                Daily Energy · MER
              </div>
              <div className="font-sans text-[36px] font-black text-terracotta tracking-tight leading-none mt-1.5">
                {analysis.mer.toLocaleString()}
                <span className="text-[13.5px] text-muted ml-1 font-sans">
                  kcal
                </span>
              </div>
              {/* 신뢰구간 — P2 / B-49. 단일 값이 아닌 범위로 표시해 데이터
                  정밀도의 실재감 전달. 체중 측정 신뢰도(merAccuracy)로 폭 결정. */}
              <div className="mt-1 text-[10.5px] font-bold text-muted">
                범위 {formatRange(merConfidenceInterval(analysis.mer, merAccuracy))}
              </div>
            </div>
            {/* UI audit #5: 우측 mini-meta — RER / factor 자릿수 정렬 + 분기마다 block.
                <br> 줄바뀜 대신 block span 으로 자연 줄, tabular-nums 로 우측 edge 통일. */}
            <div className="text-right text-[9.5px] text-moss font-semibold leading-tight tabular-nums">
              <span className="block">RER {analysis.rer}</span>
              <span className="block">× {analysis.factor}</span>
              <span className="block text-[9px] text-muted mt-0.5">NRC 2006</span>
            </div>
          </div>
          <hr className="my-4 border-t border-dashed border-rule-2" />
          <div className="grid grid-cols-2 gap-3">
            <Stat label="급여량/일" value={`${analysis.feed_g}g`} />
            <Stat
              label="끼니당"
              value={`${Math.round(analysis.mer / 2)} kcal`}
            />
            <Stat label="체형" value={analysis.bcs_label} />
            <Stat label="생애주기" value={analysis.stage} />
          </div>
        </div>
      </section>

      {/* 레거시 AI 코멘트 (3-4문장) 는 StructuredAnalysis v2 가 대체. 제거. */}

      {/* 옛 추이 카드 폐기 (2026-05-21) — AnalysisTrendsCard 컴포넌트로 추출,
          Magazine 컨테이너 안 NutrientsCard 다음 위치에서 렌더. */}
      <section className="px-5 mt-3" style={{ display: 'none' }}>
        <div
          className="rounded p-5 relative overflow-hidden"
          style={{
            background: WARM_CREAM.card,
            border: `1px solid ${WARM_CREAM.line}`,
            boxShadow: `0 1px 0 ${WARM_CREAM.line}55, 0 12px 28px ${WARM_CREAM.ink}10`,
          }}
        >
          <MagCornerMark p={WARM_CREAM} corner="tl" />
          <MagCornerMark p={WARM_CREAM} corner="bl" />
          <MagCornerMark p={WARM_CREAM} corner="br" />
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <LineChart
                className="w-4 h-4 text-moss"
                strokeWidth={1.8}
              />
              <div className="text-[13.5px] font-black text-text">
                최근 추이
              </div>
            </div>
            {totalCount > 1 && (
              <Link
                href={`/dogs/${dogId}/analyses`}
                className="text-[10.5px] font-bold text-terracotta inline-flex items-center gap-0.5"
              >
                전체 기록 {totalCount}회
                <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
              </Link>
            )}
          </div>
          <div className="text-[10.5px] text-muted font-semibold mb-4">
            설문 기록 {history.length}회 · 최신{' '}
            {formatDate(history[history.length - 1]?.date)}
          </div>
          {history.length < 2 ? (
            <div className="flex items-center gap-2 text-[10.5px] text-muted bg-bg rounded px-4 py-3">
              <Minus className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
              <span>
                설문을 2회 이상 완료하면 {dog.name}의 체형·체중 변화가 여기
                표시돼요.
              </span>
            </div>
          ) : (
            <div className="space-y-5">
              {/* 자연어 narrative — P9 (A-31). 차트 위 한 줄 요약. */}
              {(() => {
                const n = summarizeHistory(
                  history.map((h) => ({
                    date: h.date,
                    bcs: h.bcs,
                    weight: h.weight,
                  })),
                  dog?.name ?? null,
                )
                if (!n) return null
                const accent =
                  n.tone === 'positive'
                    ? 'var(--moss)'
                    : n.tone === 'cautious'
                      ? 'var(--gold)'
                      : 'var(--muted)'
                return (
                  <div
                    className="rounded px-4 py-3 text-[12px] leading-relaxed font-bold"
                    style={{
                      background: `color-mix(in srgb, ${accent} 8%, white)`,
                      border: `1px solid color-mix(in srgb, ${accent} 28%, transparent)`,
                      color: 'var(--ink)',
                    }}
                  >
                    {n.text}
                  </div>
                )
              })()}
              <TrendRow
                Icon={Scale}
                label="체형 (BCS)"
                values={history.map((h) => h.bcs)}
                labels={history.map((h) => `BCS ${h.bcs}`)}
                format={(v) => `BCS ${v.toFixed(0)}`}
                color="var(--terracotta)"
              />
              <TrendRow
                Icon={TrendingUp}
                label="체중 (추정)"
                values={history.map((h) => h.weight)}
                labels={history.map((h) => `${h.weight}kg`)}
                format={(v) => `${v.toFixed(1)}kg`}
                color="var(--moss)"
              />
            </div>
          )}
        </div>
      </section>

      {/* 옛 영양소 구성 · 권장치 비교 폐기 (2026-05-21) — Magazine NutrientsCard 가 대체. */}
      <section className="px-5 mt-3" style={{ display: 'none' }}>
        <div className="bg-bg-3 rounded border border-rule p-5">
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical
              className="w-4 h-4 text-moss"
              strokeWidth={1.8}
            />
            <div className="text-[13.5px] font-black text-text">
              영양소 구성 · 권장치 비교
            </div>
          </div>
          <div className="text-[10.5px] text-muted font-semibold mb-4">
            AAFCO 2024 프로파일 기준 ·{' '}
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm bg-text/15 align-middle" />
              권장 범위
            </span>
          </div>
          <Bar
            Icon={Beef}
            label="단백질"
            pct={analysis.protein_pct}
            g={analysis.protein_g}
            color="from-terracotta to-[#C0654E]"
            range={ranges.protein}
          />
          <Bar
            Icon={Droplet}
            label="지방"
            pct={analysis.fat_pct}
            g={analysis.fat_g}
            color="from-gold to-[#E0C88A]"
            range={ranges.fat}
          />
          <Bar
            Icon={Wheat}
            label="탄수화물"
            pct={analysis.carb_pct}
            g={analysis.carb_g}
            color="from-moss to-[#8BA05A]"
            range={ranges.carb}
          />
          <Bar
            Icon={Leaf}
            label="식이섬유"
            pct={analysis.fiber_pct}
            g={analysis.fiber_g}
            color="from-muted to-[#A89888]"
            range={ranges.fiber}
          />
        </div>
      </section>

      {/* 보충제 카드 — Magazine Edition 의 MagSupplements (위쪽) 가 대체.
          기존 작은 moss 카드는 중복이라 제거 (2026-05-21). */}

      {/* 옛 위치 RecommendationBox 폐기 (2026-05-21) — Magazine 컨테이너 안
          BoxMix 다음 위치로 이동. */}
      {false && !isArchive && (
        <RecommendationBox dogId={dogId} dogName={dog!.name} />
      )}

      {/* FeedingPlanCard / StructuredAnalysis / NutrientGauges38 모두 폐기
          (2026-05-21) — 사용자 요청 "맞춤영양분석" 카드들 정리.
          Magazine BoxMix + NutrientsCard + AtAGlance 가 시각 + 정보 일원화.
          `false &&` dead-code 가드 안에서는 TS narrowing 이 풀려 dog/analysis
          가 nullable 로 추론되므로 non-null assertion (`!`) 사용. */}
      {false && !isArchive && (
        <section className="px-5 mt-5">
          <FeedingPlanCard
            dogId={dogId}
            dogName={dog!.name}
            dailyMerKcal={analysis!.mer}
          />
        </section>
      )}
      {false && (
        <StructuredAnalysis
          analysisId={analysis!.id}
          vetConsultFromCalc={analysis!.vet_consult_recommended ?? false}
          riskFlagsFromCalc={analysis!.risk_flags ?? []}
          nextReviewDate={analysis!.next_review_date ?? null}
        />
      )}
      {false && !isArchive && <NutrientGauges38 dogName={dog!.name} />}

      {/* Round C1 (2026-05-20): 5종 SKU 비교 페이지로 CTA. */}
      {!isArchive && (
        <section className="px-5 mt-5">
          <Link
            href="/compare"
            className="block rounded border border-rule bg-bg-3 p-4 hover:border-text transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted">
                  5종 라인 비교
                </p>
                <p className="text-[13.5px] font-bold text-ink mt-1">
                  닭·오리·연어·돼지·한우 영양 한눈에 보기
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted" strokeWidth={2.5} />
            </div>
          </Link>
        </section>
      )}

      {/* 주문 CTA 바로 위 "가격 안심" — 개인화 분석 직후 = 구매 의향 peak.
          한 끼 단가 + 첫 박스 50%. 가격 숫자 편집점은 단 한 곳:
          lib/feeding-plan.ts 의 HWASIK_KRW_PER_100G (거기 주석 참고). */}
      {!isArchive && (analysis.mer ?? 0) > 0 && (
        <PriceFramingCard
          dogId={dogId}
          dogName={dog.name}
          dailyMerKcal={analysis.mer ?? 0}
        />
      )}

      <AnalysisCTASection
        dogId={dogId}
        dogName={dog.name}
        isArchive={isArchive}
        totalCount={totalCount}
      />

      {/* 참고할 점(안전·주의 신호) — 페이지 최하단(사장님 지시 2026-06-19,
          긍정 결과 먼저·참고는 마지막). 심각도순 정렬·없으면 비표시. 참고(info)만
          이면 차분한 톤, 위험/주의·수의상담은 경고 톤. */}
      {(() => {
        const flags = (analysis.risk_flags ?? []).filter(Boolean)
        const vet = analysis.vet_consult_recommended ?? false
        // 췌장염 급성/중증 하드 게이트 (formula reasoning priority 0) — 최상위.
        const gateChip = formula?.reasoning.find(
          (r) => r.ruleId === 'pancreatitis-severe-unsuitable',
        )
        if (flags.length === 0 && !vet && !gateChip) return null
        const rankOf = (f: string) => {
          const s = riskFlagSeverity(f)
          return s === 'critical' ? 0 : s === 'high' ? 1 : 2
        }
        const sorted = [...flags].sort((a, b) => rankOf(a) - rankOf(b))
        const hasSerious = !!gateChip || vet || flags.some((f) => rankOf(f) <= 1)
        const toneOf = (s: 'critical' | 'high' | 'info') =>
          s === 'critical'
            ? 'var(--terracotta)'
            : s === 'high'
              ? 'var(--gold)'
              : 'var(--muted)'
        return (
          <section className="px-5 mt-5">
            <div
              className="rounded border p-4"
              style={{ background: 'var(--bg-3)', borderColor: 'var(--rule)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle
                  className="w-4 h-4"
                  strokeWidth={2}
                  color={hasSerious ? 'var(--terracotta)' : 'var(--gold)'}
                />
                <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-muted">
                  {hasSerious ? '꼭 확인하세요' : '참고할 점'}
                </span>
              </div>

              {gateChip && (
                <div
                  className="rounded px-3 py-2.5 mb-2.5 text-[12px] leading-relaxed font-bold"
                  style={{
                    background:
                      'color-mix(in srgb, var(--terracotta) 10%, white)',
                    border:
                      '1px solid color-mix(in srgb, var(--terracotta) 35%, transparent)',
                    color: 'var(--ink)',
                  }}
                >
                  {gateChip.action}
                </div>
              )}

              {vet && (
                <div className="flex items-start gap-2 mb-2.5">
                  <Stethoscope
                    className="w-3.5 h-3.5 mt-0.5 shrink-0"
                    strokeWidth={2}
                    color="var(--terracotta)"
                  />
                  <span
                    className="text-[12px] font-bold leading-relaxed"
                    style={{ color: 'var(--ink)' }}
                  >
                    이 분석은 수의사 상담을 권장해요.
                  </span>
                </div>
              )}

              {sorted.length > 0 && (
                <ul className="space-y-2.5">
                  {sorted.map((f) => {
                    const sev = riskFlagSeverity(f)
                    const c = toneOf(sev)
                    return (
                      <li key={f} className="flex items-start gap-2">
                        <span
                          className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: c }}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          {/* M7 — 색상 외 텍스트 태그로 심각도 전달(색맹 a11y). */}
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded mr-1.5 align-middle"
                            style={{
                              background: `color-mix(in srgb, ${c} 14%, white)`,
                              color: c,
                            }}
                          >
                            {sev === 'critical'
                              ? '위험'
                              : sev === 'high'
                                ? '주의'
                                : '참고'}
                          </span>
                          <span
                            className="text-[12.5px] font-bold"
                            style={{
                              color: sev === 'info' ? 'var(--text)' : c,
                            }}
                          >
                            {riskFlagLabel(f)}
                          </span>
                          {riskFlagDesc(f) && (
                            <p
                              className="text-[12px] leading-relaxed mt-0.5"
                              style={{ color: 'var(--muted)' }}
                            >
                              {riskFlagDesc(f)}
                            </p>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>
        )
      })()}
    </div>
  )
}
