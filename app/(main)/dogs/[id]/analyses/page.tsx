import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  ClipboardList,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Scale,
  Flame,
  Sparkles,
  Activity,
  AlertCircle,
  Calendar,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '분석 히스토리',
  robots: { index: false, follow: false },
}

/** RER = 70 · w^0.75 → w = (RER / 70)^(4/3) */
function weightFromRER(rer: number): number {
  return Math.pow(rer / 70, 4 / 3)
}

type AnalysisRow = {
  id: string
  created_at: string
  mer: number
  rer: number
  stage: string
  bcs_label: string
  bcs_score: number
  feed_g: number
  protein_pct: number
  fat_pct: number
  guideline_version: string | null
}

/** 현재 알고리즘 출력 가이드라인 — 이 값보다 오래된 분석은 stale 표시. */
const CURRENT_GUIDELINE_VERSION =
  'NRC2006+AAFCO2024+FEDIAF2024+WSAVA2021+IRIS2019+KFA'

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function Delta({
  value,
  unit,
  neutral = false,
}: {
  value: number
  unit: string
  neutral?: boolean
}) {
  if (Math.abs(value) < 0.05) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-muted">
        <Minus className="w-2.5 h-2.5" strokeWidth={3} />
        변화 없음
      </span>
    )
  }
  const up = value > 0
  const Icon = up ? TrendingUp : TrendingDown
  // BCS/weight direction isn't inherently good/bad — stay neutral unless told otherwise.
  const color = neutral
    ? 'text-muted'
    : up
    ? 'text-terracotta'
    : 'text-moss'
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${color}`}
    >
      <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
      {up ? '+' : ''}
      {value.toFixed(1)}
      {unit}
    </span>
  )
}

type Params = Promise<{ id: string }>

export default async function AnalysesTimelinePage({
  params,
}: {
  params: Params
}) {
  const { id: dogId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dogs/${dogId}/analyses`)

  const { data: dog } = await supabase
    .from('dogs')
    .select('id, name')
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!dog) notFound()

  const { data: analysesRaw } = await supabase
    .from('analyses')
    .select(
      'id, created_at, mer, rer, stage, bcs_label, bcs_score, feed_g, protein_pct, fat_pct, carb_pct, fiber_pct, guideline_version, vet_consult_recommended, next_review_date, commentary, supplements'
    )
    .eq('dog_id', dogId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    // 한 강아지에 분석이 100건+ 쌓이는 케이스는 거의 없지만 server-side
    // limit 으로 메모리 폭주 방어 (가드레일).
    .limit(50)

  const analyses = (analysesRaw ?? []) as (AnalysisRow & {
    carb_pct: number | null
    fiber_pct: number | null
    vet_consult_recommended: boolean | null
    next_review_date: string | null
    commentary: string | null
    supplements: string[] | null
  })[]
  // v1.6.1 audit (2026-05-05) — algorithm 핵심 수정 후 분석은 stale 가능.
  // 첫 row (LATEST) 가 stale 면 "재분석 권장" hint.
  const latestIsStale =
    analyses.length > 0 &&
    analyses[0].guideline_version !== CURRENT_GUIDELINE_VERSION

  return (
    <main className="pb-10">
      {/* 헤더 */}
      <section className="px-5 pt-6 pb-2">
        <Link
          href={`/dogs/${dogId}`}
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← {dog.name}
        </Link>
        <span className="kicker mt-3 block">Analysis History</span>
        <h1 className="font-serif mt-1.5" style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          분석 히스토리
        </h1>
        <p className="text-[11px] text-muted mt-1">
          총 {analyses.length}회의 맞춤 분석 기록이 있어요
        </p>
      </section>

      {/* v1.6.1 audit (2026-05-05) 이전 분석은 MER 부정확 가능 — 재분석 권장 */}
      {latestIsStale && (
        <section className="px-5 mt-3">
          <div
            className="rounded-2xl px-4 py-3 border-2 flex items-start gap-2.5"
            style={{
              background: 'color-mix(in srgb, var(--gold) 8%, white)',
              borderColor: 'color-mix(in srgb, var(--gold) 35%, transparent)',
            }}
          >
            <span style={{ fontSize: 16 }}>🔄</span>
            <div className="flex-1">
              <p
                className="text-[12px] font-bold leading-snug"
                style={{ color: 'var(--ink)' }}
              >
                알고리즘이 업데이트됐어요
              </p>
              <p
                className="text-[10.5px] mt-1 leading-relaxed"
                style={{ color: 'var(--muted)' }}
              >
                BCS / 임신·수유 / 급여량 계산 정확도 향상 (NRC 2006 정식 수식
                반영). 정확한 처방을 위해 다시 분석을 받아주세요.
              </p>
              <Link
                href={`/dogs/${dogId}/survey`}
                className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold"
                style={{ color: 'var(--terracotta)' }}
              >
                새 설문으로 다시 분석 →
              </Link>
            </div>
          </div>
        </section>
      )}

      {analyses.length === 0 ? (
        <section className="px-5 mt-6">
          <div className="text-center bg-white rounded-2xl border border-dashed border-rule-2 px-5 py-10">
            <ClipboardList
              className="w-10 h-10 text-muted mx-auto mb-4"
              strokeWidth={1.2}
            />
            <h3 className="font-serif font-black text-[15px] text-text">
              아직 분석 기록이 없어요
            </h3>
            <p className="text-[11px] text-muted mt-2 leading-relaxed">
              설문을 완료하면 분석 결과가 여기에 쌓여요.
            </p>
            <Link
              href={`/dogs/${dogId}/survey`}
              className="inline-flex items-center gap-1 mt-5 px-5 py-2.5 bg-terracotta text-white rounded-xl text-[12px] font-bold active:scale-[0.98] transition"
            >
              설문 시작하기
            </Link>
          </div>
        </section>
      ) : (
        <>
        {/* LATEST 분석 hero — 사용자가 페이지 들어왔을 때 한눈에 처방 핵심 */}
        <LatestAnalysisHero
          dogId={dogId}
          dogName={dog.name}
          analysis={analyses[0]}
          isStale={latestIsStale}
        />

        {/* 이전 분석 timeline — 최신은 hero 가 표시하므로 2번째부터만 */}
        {analyses.length > 1 && (
        <section className="px-5 mt-5">
          <div className="flex items-center gap-2 mb-2.5">
            <span
              aria-hidden
              style={{ width: 16, height: 1.5, background: 'var(--terracotta)' }}
            />
            <span className="kicker">History · 이전 분석</span>
          </div>
          <ol className="relative space-y-3">
            {/* 세로 타임라인 축 */}
            <div className="absolute top-3 bottom-3 left-[15px] w-px bg-rule" />
            {analyses.slice(1).map((a, idx0) => {
              const idx = idx0 + 1 // 원본 array index (hero 가 0 차지)
              // 이전(더 오래된) 분석과 비교 — 리스트는 최신순이므로 idx+1이 이전
              const prev = analyses[idx + 1]
              const weight = weightFromRER(Number(a.rer))
              const prevWeight = prev ? weightFromRER(Number(prev.rer)) : null
              const dWeight = prevWeight !== null ? weight - prevWeight : 0
              const dMer = prev ? a.mer - prev.mer : 0
              const dBcs = prev ? a.bcs_score - prev.bcs_score : 0
              const isLatest = idx === 0
              return (
                <li key={a.id} className="relative pl-9">
                  {/* 타임라인 점 */}
                  <span
                    className={`absolute left-[10px] top-5 w-2.5 h-2.5 rounded-full ring-2 ring-bg ${
                      isLatest ? 'bg-terracotta' : 'bg-gold'
                    }`}
                  />
                  <Link
                    href={`/dogs/${dogId}/analyses/${a.id}`}
                    className="block bg-white rounded-2xl border border-rule hover:border-terracotta transition p-4 active:scale-[0.995]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-bold text-text">
                          {formatDate(a.created_at)}
                        </span>
                        {isLatest && (
                          <span className="inline-block px-1.5 py-0.5 rounded-full bg-terracotta text-white text-[9px] font-black tracking-wider">
                            LATEST
                          </span>
                        )}
                      </div>
                      <ChevronRight
                        className="w-4 h-4 text-muted shrink-0"
                        strokeWidth={2}
                      />
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-bg px-3 py-2">
                        <div className="flex items-center gap-1 text-[9px] font-bold text-muted uppercase tracking-wider">
                          <Flame className="w-2.5 h-2.5" strokeWidth={2.5} />
                          MER
                        </div>
                        <div className="text-[14px] font-black text-terracotta mt-0.5 leading-none">
                          {a.mer.toLocaleString()}
                          <span className="text-[9px] text-muted font-sans ml-0.5">
                            kcal
                          </span>
                        </div>
                        {prev && <Delta value={dMer} unit="" />}
                      </div>
                      <div className="rounded-lg bg-bg px-3 py-2">
                        <div className="flex items-center gap-1 text-[9px] font-bold text-muted uppercase tracking-wider">
                          <Scale className="w-2.5 h-2.5" strokeWidth={2.5} />
                          체중
                        </div>
                        <div className="text-[14px] font-black text-text mt-0.5 leading-none">
                          {weight.toFixed(1)}
                          <span className="text-[9px] text-muted font-sans ml-0.5">
                            kg
                          </span>
                        </div>
                        {prev && <Delta value={dWeight} unit="kg" neutral />}
                      </div>
                      <div className="rounded-lg bg-bg px-3 py-2">
                        <div className="text-[9px] font-bold text-muted uppercase tracking-wider">
                          BCS
                        </div>
                        <div className="text-[14px] font-black text-text mt-0.5 leading-none">
                          {a.bcs_score}
                          <span className="text-[9px] text-muted font-sans ml-0.5">
                            /9
                          </span>
                        </div>
                        {prev && <Delta value={dBcs} unit="" neutral />}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-[10px] text-muted">
                      <span className="font-semibold">{a.stage}</span>
                      <span className="w-px h-2.5 bg-rule-2" />
                      <span>{a.bcs_label}</span>
                      <span className="w-px h-2.5 bg-rule-2" />
                      <span>급여량 {a.feed_g}g</span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ol>
        </section>
        )}

        <div className="mt-5 px-5">
          <Link
            href={`/dogs/${dogId}/survey`}
            className="block w-full py-3 text-center rounded-xl bg-white text-text text-[12px] font-bold border border-rule hover:border-terracotta hover:text-terracotta transition"
          >
            새 설문으로 다시 분석하기
          </Link>
        </div>
        </>
      )}
    </main>
  )
}

/**
 * Latest 분석 hero 카드.
 *
 * 사용자가 분석 페이지 들어왔을 때 가장 먼저 보이는 영역. 핵심 stat (체중 /
 * MER / 급여량 / BCS) + 영양소 분포 (protein/fat/carb mini bar) + AI 코멘터리
 * 첫 줄 + CTA (처방 보러가기).
 */
function LatestAnalysisHero({
  dogId,
  dogName,
  analysis,
  isStale,
}: {
  dogId: string
  dogName: string
  analysis: AnalysisRow & {
    carb_pct: number | null
    fiber_pct: number | null
    vet_consult_recommended: boolean | null
    next_review_date: string | null
    commentary: string | null
    supplements: string[] | null
  }
  isStale: boolean
}) {
  const weight = weightFromRER(Number(analysis.rer))
  const protein = analysis.protein_pct ?? 0
  const fat = analysis.fat_pct ?? 0
  const carb = analysis.carb_pct ?? Math.max(0, 100 - protein - fat - (analysis.fiber_pct ?? 0))
  // 단축 코멘터리 (첫 문장 또는 80자)
  const commentSnippet = analysis.commentary
    ? analysis.commentary.split(/[.!?。]\s*/)[0].slice(0, 90)
    : null

  return (
    <section className="px-5 mt-3">
      <div
        className="relative overflow-hidden rounded-3xl px-6 pt-6 pb-7 text-white"
        style={{
          background:
            'linear-gradient(135deg, var(--terracotta) 0%, #8B3923 100%)',
        }}
      >
        <div
          aria-hidden
          className="absolute -top-12 -right-10 w-44 h-44 rounded-full pointer-events-none"
          style={{ background: 'rgba(255,255,255,0.10)' }}
        />
        <div
          aria-hidden
          className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full pointer-events-none"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        />

        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-gold" strokeWidth={2} />
              <span className="kicker kicker-gold">Latest · 최근 분석</span>
            </div>
            <span className="text-[10px] text-white/70 font-mono tabular-nums">
              {formatDate(analysis.created_at)}
            </span>
          </div>

          <h2
            className="font-serif leading-tight"
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: '-0.02em',
            }}
          >
            {dogName}의 맞춤 영양 처방
          </h2>
          <p className="text-[11px] text-white/80 mt-1">
            {analysis.stage} · BCS {analysis.bcs_score}/9 ({analysis.bcs_label})
          </p>

          {/* 핵심 stat 4-grid */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <HeroStat
              kicker="체중"
              value={`${weight.toFixed(1)}kg`}
              Icon={Scale}
            />
            <HeroStat
              kicker="일일 칼로리"
              value={`${Math.round(analysis.mer)}kcal`}
              Icon={Flame}
            />
            <HeroStat
              kicker="권장 급여량"
              value={`${analysis.feed_g}g/일`}
              Icon={Activity}
            />
            <HeroStat
              kicker="BCS"
              value={`${analysis.bcs_score}/9`}
              Icon={Sparkles}
            />
          </div>

          {/* 영양소 분포 (protein / fat / carb) — 100% stacked bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                영양소 분포
              </span>
              <span className="text-[10px] text-white/85 font-mono tabular-nums">
                P {protein.toFixed(0)}% · F {fat.toFixed(0)}% · C {carb.toFixed(0)}%
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden flex"
              style={{ background: 'rgba(255,255,255,0.18)' }}
            >
              <div style={{ width: `${protein}%`, background: 'var(--gold)' }} />
              <div style={{ width: `${fat}%`, background: '#F5E0C2' }} />
              <div style={{ width: `${carb}%`, background: 'rgba(255,255,255,0.45)' }} />
            </div>
          </div>

          {/* AI 코멘터리 snippet (있으면) */}
          {commentSnippet && (
            <div
              className="mt-4 px-3.5 py-2.5 rounded-xl text-[11.5px] leading-relaxed"
              style={{
                background: 'rgba(255,255,255,0.10)',
                color: '#F5E0C2',
              }}
            >
              <span className="font-bold">AI 영양사 한마디:</span>{' '}
              {commentSnippet}
              {commentSnippet.length >= 90 ? '…' : ''}
            </div>
          )}

          {/* CTA — 처방 / 주문 / 분석 상세 */}
          <div className="mt-5 flex gap-2">
            <Link
              href={`/dogs/${dogId}/analyses/${analysis.id}`}
              className="flex-1 inline-flex items-center justify-center gap-1 py-2.5 rounded-full text-[12px] font-bold active:scale-[0.98] transition"
              style={{ background: 'white', color: 'var(--terracotta)' }}
            >
              자세히 보기
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </Link>
            <Link
              href={`/dogs/${dogId}/formulas`}
              className="flex-1 inline-flex items-center justify-center gap-1 py-2.5 rounded-full text-[12px] font-bold transition"
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.25)',
              }}
            >
              처방 확인
            </Link>
          </div>

          {/* 메타 — 다음 분석 권장일 / 수의사 상담 추천 */}
          {(analysis.next_review_date || analysis.vet_consult_recommended) && (
            <div className="mt-4 pt-4 border-t border-white/15 space-y-1.5">
              {analysis.next_review_date && (
                <div className="flex items-center gap-1.5 text-[10.5px] text-white/85">
                  <Calendar className="w-3 h-3" strokeWidth={2} />
                  다음 분석 권장: {formatDate(analysis.next_review_date)}
                </div>
              )}
              {analysis.vet_consult_recommended && (
                <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-gold">
                  <AlertCircle className="w-3 h-3" strokeWidth={2} />
                  수의사 상담을 권장해요
                </div>
              )}
            </div>
          )}

          {/* stale 안내 inline (헤더 banner 와 별개) */}
          {isStale && (
            <div
              className="mt-3 px-3 py-2 rounded-lg text-[10.5px]"
              style={{
                background: 'rgba(255,255,255,0.10)',
                color: '#F5E0C2',
              }}
            >
              ⚠️ 알고리즘 업데이트 후 분석 — 정확도를 위해 재분석 권장
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function HeroStat({
  kicker,
  value,
  Icon,
}: {
  kicker: string
  value: string
  Icon: typeof Scale
}) {
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{ background: 'rgba(255,255,255,0.12)' }}
    >
      <div className="flex items-center gap-1">
        <Icon className="w-3 h-3" strokeWidth={2} />
        <span
          className="text-[9.5px] font-bold uppercase tracking-widest"
          style={{ color: 'rgba(255,255,255,0.75)' }}
        >
          {kicker}
        </span>
      </div>
      <div
        className="font-serif tabular-nums leading-none mt-1"
        style={{
          fontSize: 17,
          fontWeight: 800,
          letterSpacing: '-0.015em',
        }}
      >
        {value}
      </div>
    </div>
  )
}
