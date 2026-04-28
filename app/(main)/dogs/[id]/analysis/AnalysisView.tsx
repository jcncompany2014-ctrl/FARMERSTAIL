'use client'

import { useEffect, useRef, useState } from 'react'
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
  Pill,
  ArrowRight,
  Check,
  TrendingDown,
  TrendingUp,
  LineChart,
  Scale,
  Minus,
  Sparkles,
  Share2,
  History,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getAAFCORanges, stageFromKR, type MacroRange } from '@/lib/nutrition'
import StructuredAnalysis from '@/components/analysis/StructuredAnalysis'

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

type Dog = { id: string; name: string }

/** RER = 70 · w^0.75  →  w = (RER / 70)^(4/3) */
function weightFromRER(rer: number): number {
  return Math.pow(rer / 70, 4 / 3)
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

  const [dog, setDog] = useState<Dog | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [commentary, setCommentary] = useState<string | null>(null)
  const [commentaryState, setCommentaryState] = useState<
    'idle' | 'loading' | 'ok' | 'unavailable' | 'error'
  >('idle')
  // Guard against double-fetching when effect re-runs (StrictMode, re-renders).
  // We track the analysis id we last requested commentary for; the effect
  // itself stays pure — no setState in its synchronous body.
  const commentaryFetchedRef = useRef<string | null>(null)

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
        .select('id, name')
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

      if (!rows || rows.length === 0) {
        setLoading(false)
        return
      }

      setTotalCount(rows.length)

      const target = analysisId
        ? rows.find((r) => r.id === analysisId) ?? null
        : rows[0]

      if (!target) {
        setLoading(false)
        return
      }

      setAnalysis(target)
      setCommentary(target.commentary ?? null)

      // For the trend chart: everything up to and including the target
      // (so older detail views show the timeline state as of that reading).
      const targetTime = new Date(target.created_at).getTime()
      const upToTarget = rows.filter(
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
    load()
  }, [dogId, analysisId, router, supabase])

  // Lazy-generate AI commentary if not yet persisted.
  // 'idle' doubles as the loading state (the consumer already treats
  // idle|loading identically), so we can skip the synchronous transition
  // in the effect body and only write terminal states from the async task.
  useEffect(() => {
    if (!analysis || commentary) return
    if (commentaryFetchedRef.current === analysis.id) return
    commentaryFetchedRef.current = analysis.id

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/analysis/commentary', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ analysisId: analysis.id }),
        })
        const data = await res.json()
        if (cancelled) return
        if (res.status === 503 || data?.code === 'API_KEY_MISSING') {
          setCommentaryState('unavailable')
          return
        }
        if (!res.ok || !data?.commentary) {
          setCommentaryState('error')
          return
        }
        setCommentary(data.commentary)
        setCommentaryState('ok')
      } catch {
        if (!cancelled) setCommentaryState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [analysis, commentary])

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

  return (
    <main className="pb-10">
      <section className="px-5 pt-6 pb-2">
        <Link
          href={isArchive ? `/dogs/${dogId}/analyses` : `/dogs/${dogId}`}
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← {isArchive ? '분석 히스토리' : dog.name}
        </Link>
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
          <a
            href="#commentary"
            className="text-[10px] font-bold text-terracotta inline-flex items-center gap-0.5"
          >
            코멘트
            <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
          </a>
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

      {/* Hero */}
      <section className="px-5 mt-3 text-center relative">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-moss/10 text-moss text-[10px] font-bold tracking-[0.15em] uppercase mb-3">
          <ShieldCheck className="w-3 h-3" strokeWidth={2.5} />
          AAFCO 2024 충족
        </div>
        <span className="kicker inline-block">Nutrition Report</span>
        <h1 className="font-serif mt-1.5" style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          {dog.name} 맞춤 영양 분석
        </h1>
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
              await navigator.clipboard.writeText(
                `${text}\n${shareData.url}`
              )
              alert('분석 요약을 복사했어요')
            }
          }}
          className="absolute top-0 right-5 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-rule text-[10px] font-bold text-text hover:border-terracotta hover:text-terracotta active:scale-[0.96] transition-all shadow-sm"
          aria-label="분석 결과 공유"
        >
          <Share2 className="w-3 h-3" strokeWidth={2.5} />
          공유
        </button>
      </section>

      {/* Energy card */}
      <section className="px-5 mt-5">
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
            </div>
            <div className="text-right text-[9px] text-moss font-semibold leading-tight">
              RER {analysis.rer}
              <br />× {analysis.factor}
              <br />
              <span className="text-[8px] text-muted">NRC 2006</span>
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

      {/* AI 코멘트 */}
      {commentaryState !== 'unavailable' && (
        <section id="commentary" className="px-5 mt-3 scroll-mt-16">
          <div className="bg-gradient-to-br from-bg to-white rounded-2xl border border-rule p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-text flex items-center justify-center">
                <Sparkles
                  className="w-3.5 h-3.5 text-gold"
                  strokeWidth={2}
                />
              </div>
              <div>
                <span className="kicker" style={{ fontSize: 9 }}>
                  AI Consultant · AI 컨설턴트
                </span>
                <div
                  className="font-serif mt-0.5 leading-none"
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: 'var(--ink)',
                    letterSpacing: '-0.015em',
                  }}
                >
                  {dog.name}에게 드리는 한마디
                </div>
              </div>
            </div>
            {commentary ? (
              <p className="text-[12.5px] text-text leading-[1.7] whitespace-pre-wrap">
                {commentary}
              </p>
            ) : commentaryState === 'loading' || commentaryState === 'idle' ? (
              <div className="space-y-2">
                <div className="h-2.5 rounded-full bg-rule animate-pulse w-[95%]" />
                <div className="h-2.5 rounded-full bg-rule animate-pulse w-[88%]" />
                <div className="h-2.5 rounded-full bg-rule animate-pulse w-[75%]" />
              </div>
            ) : (
              <p className="text-[11px] text-muted leading-relaxed">
                코멘트를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
              </p>
            )}
          </div>
        </section>
      )}

      {/* 추이 */}
      <section className="px-5 mt-3">
        <div className="bg-white rounded-2xl border border-rule p-5">
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

      {/* 영양 비율 */}
      <section className="px-5 mt-3">
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

      {/* 보충제 */}
      {analysis.supplements && analysis.supplements.length > 0 && (
        <section className="px-5 mt-3">
          <div className="bg-moss/5 rounded-2xl border border-moss/30 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Pill className="w-4 h-4 text-moss" strokeWidth={1.8} />
              <div className="text-[13px] font-black text-moss">
                {dog.name} 맞춤 보충제
              </div>
            </div>
            <ul className="space-y-1.5">
              {analysis.supplements.map((s, i) => (
                <li
                  key={i}
                  className="text-[12px] text-text leading-relaxed"
                >
                  · <strong className="text-text">{s}</strong>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* AI v2 — 구조화 분석 (위험플래그 + 전환플랜 + 출처) */}
      <StructuredAnalysis
        analysisId={analysis.id}
        vetConsultFromCalc={analysis.vet_consult_recommended ?? false}
        riskFlagsFromCalc={analysis.risk_flags ?? []}
        nextReviewDate={analysis.next_review_date ?? null}
      />

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
  const first = values[0]
  const last = values[values.length - 1]
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
  const areaPath = `${path} L ${pts[pts.length - 1].x.toFixed(1)} ${
    H - PAD
  } L ${pts[0].x.toFixed(1)} ${H - PAD} Z`

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
      <div className="flex justify-between items-center mb-1.5">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-text">
          <Icon className="w-3.5 h-3.5 text-muted" strokeWidth={1.8} />
          {label}
        </span>
        <span className="text-[12px] font-black text-terracotta">{pct}%</span>
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
        <span className="text-[9px] text-muted font-semibold">
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
