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
}

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
      'id, created_at, mer, rer, stage, bcs_label, bcs_score, feed_g, protein_pct, fat_pct'
    )
    .eq('dog_id', dogId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const analyses = (analysesRaw ?? []) as AnalysisRow[]

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
        <span className="kicker mt-3 inline-block">Analysis History</span>
        <h1 className="font-serif mt-1.5" style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          분석 히스토리
        </h1>
        <p className="text-[11px] text-muted mt-1">
          총 {analyses.length}회의 맞춤 분석 기록이 있어요
        </p>
      </section>

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
        <section className="px-5 mt-4">
          <ol className="relative space-y-3">
            {/* 세로 타임라인 축 */}
            <div className="absolute top-3 bottom-3 left-[15px] w-px bg-rule" />
            {analyses.map((a, idx) => {
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

          <div className="mt-5">
            <Link
              href={`/dogs/${dogId}/survey`}
              className="block w-full py-3 text-center rounded-xl bg-white text-text text-[12px] font-bold border border-rule hover:border-terracotta hover:text-terracotta transition"
            >
              새 설문으로 다시 분석하기
            </Link>
          </div>
        </section>
      )}
    </main>
  )
}
