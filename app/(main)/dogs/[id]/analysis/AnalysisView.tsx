'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ClipboardList,
  ShieldCheck,
  FlaskConical,
  Beef,
  Droplet,
  Wheat,
  Leaf,
  ArrowRight,
  Check,
  TrendingDown,
  TrendingUp,
  LineChart,
  Scale,
  Minus,
  Share2,
  History,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { getAAFCORanges, stageFromKR, type MacroRange } from '@/lib/nutrition'
import StructuredAnalysis from '@/components/analysis/StructuredAnalysis'
import RecommendationBox from '@/components/analysis/RecommendationBox'
import FeedingPlanCard from '@/components/analysis/FeedingPlanCard'
import NutrientGauges38 from '@/components/analysis/NutrientGauges38'
import { WARM_CREAM } from '@/components/analysis/magazine/palette'
import { HeroSection as MagHero } from '@/components/analysis/magazine/HeroSection'
import { DiagnosisCard as MagDiagnosis } from '@/components/analysis/magazine/DiagnosisCard'
import { CelebrationBanner as MagCelebration } from '@/components/analysis/magazine/CelebrationBanner'
import { AtAGlance as MagAtAGlance } from '@/components/analysis/magazine/AtAGlance'
import { DailyEnergyCard as MagDailyEnergy } from '@/components/analysis/magazine/DailyEnergyCard'
import {
  NutrientsCard as MagNutrients,
  type NutrientRow as MagNutrientRow,
} from '@/components/analysis/magazine/NutrientsCard'
import {
  BoxMixCard as MagBoxMix,
  type BoxMixItem as MagBoxMixItem,
} from '@/components/analysis/magazine/BoxMixCard'
import {
  SupplementsCard as MagSupplements,
  type SupplementItem as MagSupplementItem,
} from '@/components/analysis/magazine/SupplementsCard'
import { CTAStack as MagCTA } from '@/components/analysis/magazine/CTAStack'
import { CornerMark as MagCornerMark } from '@/components/analysis/magazine/ReportCard'
import {
  merConfidenceInterval,
  formatRange,
} from '@/lib/nutrition/confidence-interval'
import { summarizeHistory } from '@/lib/analysis/narrative'
import { FOOD_LINE_META, ALL_LINES } from '@/lib/personalization/lines'
import type { Formula } from '@/lib/personalization/types'
import AnalysisTrendsCard from '@/components/analysis/AnalysisTrendsCard'

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
}

/** RER = 70 · w^0.75  →  w = (RER / 70)^(4/3) */
function weightFromRER(rer: number): number {
  return Math.pow(rer / 70, 4 / 3)
}

/**
 * Magazine HeroSection 용 나이 라벨. birth_date 우선, 없으면 age_value/unit.
 * 출력 예: "3세 4개월" / "8개월" / "성견 (나이 미상)".
 */
function formatAgeLabel(dog: {
  birth_date: string | null
  age_value: number | null
  age_unit: string | null
}): string {
  if (dog.birth_date) {
    const b = new Date(dog.birth_date)
    const now = new Date()
    let years = now.getFullYear() - b.getFullYear()
    let months = now.getMonth() - b.getMonth()
    if (now.getDate() < b.getDate()) months -= 1
    if (months < 0) {
      years -= 1
      months += 12
    }
    if (years <= 0 && months <= 0) return '신생견'
    if (years <= 0) return `${months}개월`
    if (months <= 0) return `${years}세`
    return `${years}세 ${months}개월`
  }
  if (dog.age_value != null && dog.age_unit) {
    const unit = dog.age_unit === 'years' || dog.age_unit === '년' ? '세' : '개월'
    return `${dog.age_value}${unit}`
  }
  return '성견'
}

/**
 * analysis.supplements (string[]) → magazine SupplementsCard 행.
 * 알려진 키워드 매칭으로 icon · tag · reason 결정.
 */
function mapSupplements(
  raw: string[],
): Array<{ name: string; tag: string; reason: string; icon: 'pill' | 'drop' | 'leaf' }> {
  return raw.slice(0, 3).map((label) => {
    const lower = label.toLowerCase()
    if (/오메가|epa|dha|피쉬|fish/.test(lower)) {
      return { name: label, tag: '피부·모질', reason: 'BCS·피모 윤기 보강', icon: 'drop' as const }
    }
    if (/프로바이오|장|gi|소화|probiotic/.test(lower)) {
      return { name: label, tag: '장 건강', reason: '단백 소화 보조', icon: 'leaf' as const }
    }
    return { name: label, tag: '기본', reason: 'AAFCO 미량성분 보강', icon: 'pill' as const }
  })
}

export default function AnalysisView({
  dogId,
  analysisId,
}: {
  dogId: string
  /** When set, load this specific historical analysis instead of the latest. */
  analysisId?: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

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
        .select('id, name, breed, birth_date, age_value, age_unit, photo_url')
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
    void load()
  }, [dogId, analysisId, router, supabase])

  // formula fetch — Magazine BoxMixCard 가 dog 별 동적 lineRatios 표시 위해.
  useEffect(() => {
    if (!dog || analysisId) return // archive 모드는 skip — 현 시점 formula 의미 X
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/personalization/compute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dogId, cycleNumber: 1 }),
        })
        if (!res.ok) return
        const json = (await res.json()) as
          | { ok: true; formula: Formula }
          | { ok: false }
        if (cancelled || !json.ok) return
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
      <main className="flex items-center justify-center min-h-[80vh]">
        <div className="w-8 h-8 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
      </main>
    )

  if (!analysis || !dog) {
    return (
      <main className="px-5 py-6 max-w-md mx-auto">
        <Link
          href={`/dogs/${dogId}`}
          className="text-[11px] text-muted hover:text-terracotta font-semibold"
        >
          ← 돌아가기
        </Link>
        <div className="mt-6 text-center bg-white rounded-2xl border border-dashed border-rule-2 px-5 py-10">
          <ClipboardList
            className="w-10 h-10 text-muted mx-auto mb-4"
            strokeWidth={1.2}
          />
          <h3 className="font-serif font-black text-[16px] text-text">
            분석 결과가 없어요
          </h3>
          <p className="text-[12px] text-muted mt-2 leading-relaxed">
            설문을 완료하면 AI가
            <br />
            맞춤 영양 분석을 제공해요
          </p>
          <Link
            href={`/dogs/${dogId}/survey`}
            className="inline-flex items-center gap-1 mt-5 px-5 py-2.5 bg-terracotta text-white rounded-xl text-[12px] font-bold active:scale-[0.98] transition"
          >
            설문 시작하기
          </Link>
        </div>
      </main>
    )
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
  const magP = WARM_CREAM
  const createdAt = new Date(analysis.created_at)
  const magDateLabel = `${String(createdAt.getMonth() + 1).padStart(2, '0')}.${String(createdAt.getDate()).padStart(2, '0')}`
  const magAgeLabel = formatAgeLabel(dog)
  const magWeightKg = +weightFromRER(analysis.rer).toFixed(1)
  // accuracyScore 미상 — null 전달 시 default 0.7 사용 (lib 기본값).
  const magMerCi = merConfidenceInterval(analysis.mer, null)
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
    <main className="pb-10">
      <section className="px-5 pt-6 pb-2 flex items-center justify-between gap-3">
        <Link
          href={isArchive ? `/dogs/${dogId}/analyses` : `/dogs/${dogId}`}
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← {isArchive ? '분석 히스토리' : dog.name}
        </Link>
        <button
          onClick={async () => {
            const text = `${dog.name}의 맞춤 영양 분석\n\n• 하루 에너지 ${analysis.mer.toLocaleString()} kcal\n• 급여량 ${analysis.feed_g}g/일\n• 체형 ${analysis.bcs_label}\n\n파머스테일 · Farm to Tail`
            const shareData = {
              title: `${dog.name} 영양 분석 · 파머스테일`,
              text,
              url: typeof window !== 'undefined' ? window.location.href : '',
            }
            if (typeof navigator !== 'undefined' && navigator.share) {
              try {
                await navigator.share(shareData)
              } catch {
                /* 사용자 취소 */
              }
            } else if (
              typeof navigator !== 'undefined' &&
              navigator.clipboard
            ) {
              await navigator.clipboard.writeText(`${text}\n${shareData.url}`)
              toast.success('분석 요약을 복사했어요')
            }
          }}
          className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-terracotta font-semibold transition-colors"
          aria-label="분석 결과 공유"
        >
          <Share2 className="w-3 h-3" strokeWidth={2.5} />
          공유
        </button>
      </section>

      {/* Sticky 핵심 요약 — 스크롤해도 상단에 고정 */}
      <div className="sticky top-0 z-30 -mx-0 mt-2 px-5 py-2.5 bg-bg/85 backdrop-blur-md border-y border-rule">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-[11px] text-text">
            <span className="inline-flex items-center gap-1 font-bold">
              <span className="text-terracotta font-black">
                {analysis.mer.toLocaleString()}
              </span>
              <span className="text-[9px] text-muted">kcal</span>
            </span>
            <span className="w-px h-3 bg-rule-2" />
            <span className="inline-flex items-center gap-1 font-bold">
              <Scale className="w-3 h-3 text-moss" strokeWidth={2.5} />
              {analysis.feed_g}g
            </span>
            <span className="w-px h-3 bg-rule-2" />
            <span className="font-semibold text-muted">
              {analysis.bcs_label}
            </span>
          </div>
          <span className="text-[10px] font-bold text-muted">
            {analysisDate}
          </span>
        </div>
      </div>

      {/* 히스토리 뷰: 이 분석이 언제 것인지 명시 */}
      {isArchive && (
        <section className="px-5 mt-3">
          <div className="bg-text/5 border border-text/15 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] text-text min-w-0">
              <History className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
              <span className="font-bold truncate">
                {analysisDate} 기록 · 과거 분석 보기
              </span>
            </div>
            <Link
              href={`/dogs/${dogId}/analysis`}
              className="shrink-0 text-[10px] font-bold text-terracotta hover:underline"
            >
              최신 분석 →
            </Link>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Magazine Edition (2026-05-21) — 새 분석 결과 카드 묶음.
          archive 모드에서는 숨김 (역사적 데이터 컨텍스트와 충돌 방지).
          기존 컴포넌트 (FeedingPlanCard / RecommendationBox /
          StructuredAnalysis) 는 아래 그대로 보존.
          ───────────────────────────────────────────────────────────── */}
      {!isArchive && (
        <div
          style={{ background: magP.bg, marginTop: 12, paddingBottom: 4 }}
        >
          <MagHero
            p={magP}
            dogName={dog.name}
            ageLabel={magAgeLabel}
            breedLabel={dog.breed}
            weightKg={magWeightKg}
            photoUrl={dog.photo_url}
          />
          <MagDiagnosis
            p={magP}
            dogName={dog.name}
            chips={[
              { label: analysis.stage || '성견 유지', variant: 'primary' },
              { label: `BCS ${analysis.bcs_score}/9 · ${analysis.bcs_label}`, variant: 'soft' },
              { label: `단백 ${Math.round(analysis.protein_pct)}%`, variant: 'soft' },
            ]}
            headline={{
              intro: '단백질은',
              accentBrand: '넉넉히',
              middle: ', 지방은',
              accentOchre: '균형 있게',
              body: `${dog.name}이의 ${analysis.bcs_label} 체형에`,
              highlight: '맞춤 식단을 준비했어요.',
            }}
            guidelineLabel={`AAFCO ${analysis.guideline_version ?? '2024'} 영양 기준 충족`}
            versionLabel={`분석 · ${analysisDate}`}
          />
          <MagCelebration
            p={magP}
            dogName={dog.name}
            dateLabel={magDateLabel}
          />
          <MagAtAGlance
            p={magP}
            data={{
              kcalPerDay: Math.round(analysis.mer),
              feedGramPerDay: Math.round(analysis.feed_g),
              kcalPerMeal: Math.round(analysis.mer / 2),
              bcsLabel: `BCS ${analysis.bcs_score}/9`,
            }}
          />
          <MagDailyEnergy
            p={magP}
            dogName={dog.name}
            data={{
              mer: Math.round(analysis.mer),
              rer: analysis.rer,
              factor: analysis.factor,
              merMin: magMerMin,
              merMax: magMerMax,
              guideline: 'NRC 2006',
            }}
          />
          {/* 카드 순서 (사용자 지시 2026-05-21):
              BoxMix → RecommendationBox (정기배송+비율조정+왜이비율) →
              Nutrients (영양 균형) → 추이 → Supplements → MagCTA(보조) */}
          <MagBoxMix p={magP} dogName={dog.name} items={magBoxItems} />
          {!isArchive && (
            <div style={{ marginTop: 14 }}>
              <RecommendationBox dogId={dogId} dogName={dog.name} />
            </div>
          )}
          <MagNutrients p={magP} rows={magNutrientRows} />
          <AnalysisTrendsCard
            dogId={dogId}
            dogName={dog.name}
            history={history}
            totalCount={totalCount}
          />
          <MagSupplements
            p={magP}
            dogName={dog.name}
            items={magSupplementItems}
          />
          <MagCTA p={magP} consultHref="/contact" />
          <div style={{ height: 12, background: magP.bg }} />
        </div>
      )}

      {/* 옛 Hero 폐기 (2026-05-21) — Magazine HeroSection + DiagnosisCard 가 대체. */}
      <section className="px-5 mt-4 text-center" style={{ display: 'none' }}>
        <span className="kicker inline-block">Nutrition Report</span>
        <h1
          className="font-serif mt-1.5"
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          {dog.name} 맞춤 영양 분석
        </h1>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-moss/10 text-moss text-[10px] font-bold tracking-[0.15em] uppercase mt-3">
          <ShieldCheck className="w-3 h-3" strokeWidth={2.5} />
          AAFCO 2024 충족
        </div>
      </section>

      {/* 옛 Energy card 폐기 (2026-05-21) — Magazine DailyEnergy + AtAGlance 가 대체. */}
      <section className="px-5 mt-5" style={{ display: 'none' }}>
        <div className="bg-white rounded-2xl border border-rule p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.2em]">
                Daily Energy · MER
              </div>
              <div className="font-serif text-[36px] font-black text-terracotta tracking-tight leading-none mt-1.5">
                {analysis.mer.toLocaleString()}
                <span className="text-[14px] text-muted ml-1 font-sans">
                  kcal
                </span>
              </div>
              {/* 신뢰구간 — P2 / B-49. 단일 값이 아닌 범위로 표시해 데이터
                  정밀도의 실재감 전달. accuracyScore 없을 때 default 0.7. */}
              <div className="mt-1 text-[10.5px] font-bold text-muted">
                범위 {formatRange(merConfidenceInterval(analysis.mer, null))}
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
          className="rounded-2xl p-5 relative overflow-hidden"
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
              <div className="text-[13px] font-black text-text">
                최근 추이
              </div>
            </div>
            {totalCount > 1 && (
              <Link
                href={`/dogs/${dogId}/analyses`}
                className="text-[10px] font-bold text-terracotta hover:underline inline-flex items-center gap-0.5"
              >
                전체 기록 {totalCount}회
                <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
              </Link>
            )}
          </div>
          <div className="text-[10px] text-muted font-semibold mb-4">
            설문 기록 {history.length}회 · 최신{' '}
            {formatDate(history[history.length - 1]?.date)}
          </div>
          {history.length < 2 ? (
            <div className="flex items-center gap-2 text-[11px] text-muted bg-bg rounded-xl px-4 py-3">
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
                    className="rounded-xl px-4 py-3 text-[12.5px] leading-relaxed font-bold"
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
        <div className="bg-white rounded-2xl border border-rule p-5">
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical
              className="w-4 h-4 text-moss"
              strokeWidth={1.8}
            />
            <div className="text-[13px] font-black text-text">
              영양소 구성 · 권장치 비교
            </div>
          </div>
          <div className="text-[10px] text-muted font-semibold mb-4">
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
            className="block rounded-2xl border border-rule bg-white p-4 hover:border-text transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted">
                  5종 라인 비교
                </p>
                <p className="text-[13px] font-bold text-ink mt-1">
                  닭·오리·연어·돼지·한우 영양 한눈에 보기
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted" strokeWidth={2.5} />
            </div>
          </Link>
        </section>
      )}

      {/* CTA */}
      <section className="px-5 mt-5 space-y-2">
        {isArchive ? (
          <>
            <Link
              href={`/dogs/${dogId}/analysis`}
              className="flex items-center justify-center gap-1.5 w-full py-4 rounded-xl bg-text text-white text-[13px] font-black active:scale-[0.98] transition"
            >
              최신 분석 보기
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </Link>
            <Link
              href={`/dogs/${dogId}/analyses`}
              className="block w-full py-3 text-center rounded-xl bg-white text-muted text-[12px] font-bold border border-rule hover:border-text hover:text-text transition"
            >
              히스토리 목록
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/products"
              className="flex items-center justify-center gap-1.5 w-full py-4 rounded-full bg-ink text-bg text-[13px] font-bold active:scale-[0.98] transition"
            >
              {dog.name} 맞춤 체험팩 주문하기
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </Link>
            <Link
              href={`/dogs/${dogId}/survey`}
              className="block w-full py-3 text-center rounded-xl bg-white text-muted text-[12px] font-bold border border-rule hover:border-text hover:text-text transition"
            >
              다시 분석하기
            </Link>
            {totalCount > 1 && (
              <Link
                href={`/dogs/${dogId}/analyses`}
                className="block w-full py-3 text-center rounded-xl bg-white text-muted text-[12px] font-bold border border-rule hover:border-text hover:text-text transition"
              >
                이전 분석 히스토리 {totalCount}회 →
              </Link>
            )}
          </>
        )}
      </section>
    </main>
  )
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return `${d.getMonth() + 1}.${d.getDate()}`
}

function TrendRow({
  Icon,
  label,
  values,
  labels,
  format,
  color,
}: {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  values: number[]
  labels: string[]
  format: (v: number) => string
  color: string
}) {
  const first = values[0]!
  const last = values[values.length - 1]!
  const delta = last - first
  const deltaSign =
    delta === 0
      ? '변화 없음'
      : delta > 0
      ? `+${delta.toFixed(1)}`
      : delta.toFixed(1)
  const DirIcon = delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown
  const dirColor = 'text-muted'

  const W = 180
  const H = 36
  const PAD = 4
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = (W - PAD * 2) / Math.max(values.length - 1, 1)
  const pts = values.map((v, i) => {
    const x = PAD + i * step
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2)
    return { x, y }
  })
  const path = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
  const areaPath = `${path} L ${pts[pts.length - 1]!.x.toFixed(1)} ${
    H - PAD
  } L ${pts[0]!.x.toFixed(1)} ${H - PAD} Z`

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-text">
          <Icon className="w-3.5 h-3.5 text-muted" strokeWidth={1.8} />
          {label}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${dirColor}`}
        >
          <DirIcon className="w-3 h-3" strokeWidth={2.5} />
          {deltaSign}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="flex-1 max-w-[180px]"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`grad-${label}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#grad-${label})`} />
          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={i === pts.length - 1 ? 3 : 1.8}
              fill={i === pts.length - 1 ? color : 'white'}
              stroke={color}
              strokeWidth={i === pts.length - 1 ? 1.5 : 1.2}
            />
          ))}
        </svg>
        <div className="text-right leading-tight">
          <div className="text-[9px] text-muted font-semibold uppercase tracking-[0.15em]">
            {labels[0]}
          </div>
          <div className="text-[9px] text-muted">↓</div>
          <div className="text-[13px] font-black text-text">
            {format(last)}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] text-muted font-semibold uppercase tracking-[0.2em]">
        {label}
      </div>
      <div className="text-[13px] font-black text-text mt-0.5">
        {value}
      </div>
    </div>
  )
}

function Bar({
  Icon,
  label,
  pct,
  g,
  color,
  range,
}: {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  pct: number
  g: number
  color: string
  range: MacroRange
}) {
  const { min, max, scale } = range
  const fillWidth = Math.min((pct / scale) * 100, 100)
  const bandLeft = (min / scale) * 100
  const bandWidth = Math.max(((max - min) / scale) * 100, 2)

  const status: 'under' | 'ok' | 'over' =
    pct < min ? 'under' : pct > max ? 'over' : 'ok'

  const StatusIcon =
    status === 'ok' ? Check : status === 'under' ? TrendingDown : TrendingUp
  const statusText =
    status === 'ok'
      ? '권장 범위 내'
      : status === 'under'
      ? '권장치 미달'
      : '권장치 상회'
  const statusColor =
    status === 'ok'
      ? 'text-moss'
      : status === 'under'
      ? 'text-muted'
      : 'text-terracotta'

  return (
    <div className="mb-4 last:mb-0">
      {/* UI audit: 영양소 4 row (단백질/지방/탄수/식이섬유) 퍼센트 자릿수 정렬. */}
      <div className="flex justify-between items-center mb-1.5">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-text">
          <Icon className="w-3.5 h-3.5 text-muted" strokeWidth={1.8} />
          {label}
        </span>
        <span className="text-[12px] font-black text-terracotta tabular-nums">{pct}%</span>
      </div>
      <div className="relative h-2.5 bg-rule rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 bg-text/15"
          style={{ left: `${bandLeft}%`, width: `${bandWidth}%` }}
        />
        <div
          className={`relative h-full bg-gradient-to-r ${color} transition-all duration-700`}
          style={{ width: `${fillWidth}%` }}
        />
      </div>
      <div className="flex justify-between items-center mt-1.5">
        <span className="text-[9px] text-muted font-semibold tabular-nums">
          {g}g/일 · 권장 {min}–{max}%
        </span>
        <span
          className={`inline-flex items-center gap-0.5 text-[9px] font-bold ${statusColor}`}
        >
          <StatusIcon className="w-3 h-3" strokeWidth={2.5} />
          {statusText}
        </span>
      </div>
    </div>
  )
}
