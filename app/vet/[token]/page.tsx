import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertCircle,
  Dog as DogIcon,
  Stethoscope,
  Scale,
  ClipboardList,
  Pill,
  AlertTriangle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import VetSharePrintButton from './VetSharePrintButton'
import { sensitivityAnalysis, type DogState } from '@/lib/counterfactual'
import { TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '진료 참고용 공유',
  robots: { index: false, follow: false },
}

type Params = Promise<{ token: string }>

/**
 * /vet/[token] — 보호자가 수의사에게 공유한 read-only 페이지.
 *
 * 로그인 없이 익명 진입. supabase anon role 로 fetch_vet_share() RPC 호출.
 * RPC 가 RLS 우회 + 토큰 검증 + 정보 통합 반환.
 *
 * # 표시
 *  - 보호자 이름 + 강아지 메타 (이름, 종, 성별, 중성화, 나이, 체중)
 *  - 알레르기 / 만성 질환
 *  - 최신 분석 결과 (RER, MER, BCS, 단백·지방·탄수, 처방 supplements, risk flags)
 *  - 최근 체중 측정
 *
 * # 데이터 신뢰성 표시
 *  - allergies_source, weight_method, weight_measured_at 으로 "어떻게 측정한
 *    값인지" 명시 — 수의사가 보호자 보고와 객관 측정을 구분.
 */
export default async function VetSharePage({
  params,
}: {
  params: Params
}) {
  const { token } = await params

  const supabase = await createClient()
  const { data } = await supabase.rpc('fetch_vet_share', { p_token: token })

  type RpcResult =
    | {
        ok: true
        token: { expiresAt: string; accessedCount: number }
        owner: { name: string | null }
        dog: DogRow
        analysis: AnalysisRow | null
        latestWeight: { weight: number; measured_at: string } | null
      }
    | { ok: false; error: string; message: string }

  const result = (data ?? { ok: false, error: 'unknown', message: '응답 없음' }) as RpcResult

  if (!result.ok) {
    return (
      <main className="min-h-[80vh] flex items-center justify-center px-5 py-10" style={{ background: 'var(--bg)' }}>
        <div className="max-w-sm w-full text-center rounded-2xl border bg-white px-6 py-7" style={{ borderColor: 'var(--rule)' }}>
          <AlertCircle className="w-9 h-9 mx-auto text-sale" strokeWidth={1.8} />
          <h1
            className="font-serif mt-3"
            style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}
          >
            진료 공유 링크 사용 불가
          </h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-text/70">
            {result.message}
          </p>
        </div>
      </main>
    )
  }

  const dog = result.dog
  const analysis = result.analysis
  const latestWeight = result.latestWeight

  return (
    <main className="pb-12 vet-share-print" style={{ background: 'var(--bg)' }}>
      <style>{`
        @media print {
          .vet-share-print { background: white !important; padding-bottom: 0 !important; }
          .vet-share-print .no-print { display: none !important; }
          .vet-share-print section { page-break-inside: avoid; }
          .vet-share-print a { color: #1E1A14 !important; text-decoration: none !important; }
        }
      `}</style>
      <section className="px-5 pt-6 pb-2 flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'var(--bg-2)' }}>
            <Stethoscope className="w-3 h-3" strokeWidth={2.2} style={{ color: 'var(--terracotta)' }} />
            <span className="text-[10.5px] font-bold uppercase tracking-widest" style={{ color: 'var(--terracotta)' }}>
              진료 참고용
            </span>
          </div>
        </div>
        {/* PDF / 인쇄 — P15. window.print() — 브라우저가 PDF 저장 또는 실 인쇄 */}
        <VetSharePrintButton />
      </section>
      <section className="px-5 pt-2 pb-2">
        <h1
          className="font-serif mt-3 leading-tight"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          {dog.name}의 정보
        </h1>
        {result.owner.name && (
          <p className="mt-1 text-[12px] text-muted">
            보호자: {result.owner.name}
          </p>
        )}
      </section>

      {/* 강아지 메타 */}
      <section className="px-5 mt-4">
        <div className="rounded-2xl border bg-white px-5 py-4" style={{ borderColor: 'var(--rule)' }}>
          <span className="kicker" style={{ color: 'var(--muted)' }}>강아지 정보</span>
          <div className="mt-2 grid grid-cols-2 gap-3 text-[12.5px]">
            <Field label="이름" value={dog.name} />
            <Field label="종" value={dog.breed ?? '—'} />
            <Field label="성별" value={dog.gender === 'female' ? '여' : dog.gender === 'male' ? '남' : '—'} />
            <Field label="중성화" value={dog.neutered ? '예' : '아니오'} />
            <Field label="현재 체중" value={dog.weight != null ? `${dog.weight} kg` : '—'} />
            <Field label="생년월일" value={dog.birth_date ?? '—'} />
            <Field label="활동량" value={activityLabel(dog.activity_level)} />
            <Field
              label="체중 측정"
              value={
                dog.weight_method
                  ? `${weightMethodLabel(dog.weight_method)}${dog.weight_measured_at ? ` · ${dog.weight_measured_at.slice(0, 10)}` : ''}`
                  : '—'
              }
            />
          </div>
        </div>
      </section>

      {/* 알레르기 / 만성 질환 */}
      {((dog.allergies?.length ?? 0) > 0 || (dog.chronic_conditions?.length ?? 0) > 0) && (
        <section className="px-5 mt-3">
          <div className="rounded-2xl border bg-white px-5 py-4" style={{ borderColor: 'var(--rule)' }}>
            <span className="kicker flex items-center gap-1.5" style={{ color: 'var(--gold)' }}>
              <AlertTriangle className="w-3 h-3" strokeWidth={2.2} />
              알레르기 / 만성 질환
            </span>
            {dog.allergies && dog.allergies.length > 0 && (
              <div className="mt-2">
                <p className="text-[11px] uppercase tracking-wider font-bold text-muted">알레르기</p>
                <p className="mt-1 text-[12.5px]" style={{ color: 'var(--ink)' }}>
                  {dog.allergies.join(', ')}
                  {dog.allergies_source && (
                    <span className="text-muted ml-1.5">
                      ({allergiesSourceLabel(dog.allergies_source)})
                    </span>
                  )}
                </p>
              </div>
            )}
            {dog.chronic_conditions && dog.chronic_conditions.length > 0 && (
              <div className="mt-2">
                <p className="text-[11px] uppercase tracking-wider font-bold text-muted">만성 질환</p>
                <p className="mt-1 text-[12.5px]" style={{ color: 'var(--ink)' }}>
                  {dog.chronic_conditions.join(', ')}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 최신 분석 */}
      {analysis ? (
        <section className="px-5 mt-3">
          <div className="rounded-2xl border bg-white px-5 py-4" style={{ borderColor: 'var(--rule)' }}>
            <span className="kicker flex items-center gap-1.5" style={{ color: 'var(--terracotta)' }}>
              <ClipboardList className="w-3 h-3" strokeWidth={2.2} />
              최신 분석 · {analysis.created_at.slice(0, 10)}
            </span>
            <div className="mt-2 grid grid-cols-2 gap-3 text-[12.5px]">
              <Field label="RER" value={`${analysis.rer} kcal`} />
              <Field label="MER" value={`${analysis.mer} kcal`} />
              <Field label="활동 factor" value={`${analysis.factor}`} />
              <Field label="라이프 스테이지" value={analysis.stage} />
              <Field label="BCS" value={analysis.bcs_label} />
              <Field label="단백질" value={`${analysis.protein_pct}%`} />
              <Field label="지방" value={`${analysis.fat_pct}%`} />
              <Field label="탄수" value={`${analysis.carb_pct}%`} />
              <Field label="일일 권장" value={`${analysis.feed_g} g`} />
              <Field label="Ca:P" value={analysis.ca_p_ratio?.toString() ?? '—'} />
            </div>
            {analysis.supplements && analysis.supplements.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] uppercase tracking-wider font-bold text-muted flex items-center gap-1">
                  <Pill className="w-3 h-3" strokeWidth={2.2} />
                  권장 보조제
                </p>
                <p className="mt-1 text-[12.5px]" style={{ color: 'var(--ink)' }}>
                  {analysis.supplements.join(', ')}
                </p>
              </div>
            )}
            {analysis.risk_flags && analysis.risk_flags.length > 0 && (
              <div className="mt-3 rounded-lg px-3 py-2" style={{ background: 'color-mix(in srgb, var(--sale) 8%, white)' }}>
                <p className="text-[11px] uppercase tracking-wider font-bold" style={{ color: 'var(--sale)' }}>
                  Risk Flags
                </p>
                <p className="mt-1 text-[12px]" style={{ color: 'var(--ink)' }}>
                  {analysis.risk_flags.join(' · ')}
                </p>
              </div>
            )}
            {analysis.vet_consult_recommended && (
              <p className="mt-3 text-[12px] font-bold" style={{ color: 'var(--terracotta)' }}>
                ⚠ 수의사 상담 권장
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="px-5 mt-3">
          <div className="rounded-2xl border-dashed border bg-white px-5 py-4 text-center text-[12px] text-muted" style={{ borderColor: 'var(--rule)' }}>
            아직 분석 데이터가 없어요
          </div>
        </section>
      )}

      {/* 최근 체중 */}
      {latestWeight && (
        <section className="px-5 mt-3">
          <div className="rounded-2xl border bg-white px-5 py-4" style={{ borderColor: 'var(--rule)' }}>
            <span className="kicker flex items-center gap-1.5" style={{ color: 'var(--moss)' }}>
              <Scale className="w-3 h-3" strokeWidth={2.2} />
              최근 체중
            </span>
            <p
              className="mt-1.5 font-serif"
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              {latestWeight.weight} kg
              <span className="text-[11.5px] text-muted ml-2 font-normal">
                · {latestWeight.measured_at.slice(0, 10)}
              </span>
            </p>
          </div>
        </section>
      )}

      {/* [C1] 반사실 sensitivity — 발명 모듈 G UI 노출. flag OFF 면 빈 array
          반환 → section hide. 수의사가 어떤 변수 변화가 식단에 가장 큰 영향
          줄지 판단 보조. */}
      {(() => {
        if (!analysis || !dog.weight) return null
        const lifeStage: DogState['lifeStage'] = analysis.stage.includes('성장')
          ? 'puppy'
          : analysis.stage.includes('노령')
            ? 'senior'
            : 'adult'
        const baseline: DogState = {
          weightKg: dog.weight,
          bcs: analysis.bcs_score ?? 5,
          activityFactor: analysis.factor ?? 1.2,
          lifeStage,
          neutered: !!dog.neutered,
        }
        const results = sensitivityAnalysis(baseline)
        if (results.length === 0) return null
        return (
          <section className="px-5 mt-3">
            <div className="rounded-2xl border bg-white px-5 py-4" style={{ borderColor: 'var(--rule)' }}>
              <span className="kicker flex items-center gap-1.5" style={{ color: 'var(--moss)' }}>
                <TrendingUp className="w-3 h-3" strokeWidth={2.2} />
                반사실 sensitivity (식단 영향력)
              </span>
              <p className="mt-1 text-[11.5px] text-muted leading-relaxed">
                각 변수 1단위 변화 시 권장 그램의 변화량. 가장 영향이 큰 변수
                를 보면 케어 priority 결정에 도움.
              </p>
              <ul className="mt-2 space-y-1">
                {results.slice(0, 4).map((r) => (
                  <li
                    key={`${r.variable}-${r.delta}`}
                    className="flex items-center justify-between text-[12px]"
                  >
                    <span style={{ color: 'var(--ink)' }}>{r.description}</span>
                    <span
                      className="font-mono tabular-nums"
                      style={{
                        color:
                          r.delta > 0 ? 'var(--moss)' : 'var(--terracotta)',
                      }}
                    >
                      {r.delta > 0 ? '+' : ''}
                      {r.delta} g/일
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )
      })()}

      {/* 푸터 — 안내 + 만료 */}
      <section className="px-5 mt-6">
        <div className="text-[10.5px] text-muted leading-relaxed text-center">
          이 페이지는 보호자가 발급한 토큰으로 read-only 공유돼요. {' '}
          만료: {result.token.expiresAt.slice(0, 10)}.
          <br />
          <span className="inline-block mt-1">
            farmerstail · <Link href="/" className="underline">farmerstail.kr</Link>
          </span>
        </div>
      </section>
    </main>
  )
}

type DogRow = {
  id: string
  name: string
  breed: string | null
  gender: 'male' | 'female' | null
  neutered: boolean | null
  weight: number | null
  birth_date: string | null
  activity_level: string | null
  allergies_source: string | null
  weight_method: string | null
  weight_measured_at: string | null
  chronic_conditions: string[] | null
  allergies: string[] | null
}

type AnalysisRow = {
  created_at: string
  rer: number
  mer: number
  factor: number
  stage: string
  bcs_label: string
  bcs_score: number
  protein_pct: number
  fat_pct: number
  carb_pct: number
  feed_g: number
  ca_p_ratio: number | null
  supplements: string[] | null
  risk_flags: string[] | null
  vet_consult_recommended: boolean | null
  next_review_date: string | null
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider font-bold text-muted">
        {label}
      </div>
      <div className="mt-0.5" style={{ color: 'var(--ink)' }}>{value}</div>
    </div>
  )
}

function activityLabel(level: string | null): string {
  if (!level) return '—'
  const map: Record<string, string> = {
    very_low: '매우 낮음',
    low: '낮음',
    normal: '보통',
    moderate: '보통',
    high: '높음',
    very_high: '매우 높음',
  }
  return map[level] ?? level
}

function weightMethodLabel(method: string): string {
  const map: Record<string, string> = {
    vet_scale: '동물병원 체중계',
    home_digital: '가정용 디지털',
    home_analog: '가정용 아날로그',
    hold: '안고 재기',
    eyeball: '눈으로 추정',
    unknown: '미상',
  }
  return map[method] ?? method
}

function allergiesSourceLabel(source: string): string {
  const map: Record<string, string> = {
    self_suspected: '보호자 자가관찰',
    vet_diagnosed: '수의사 확진',
    unknown: '미상',
  }
  return map[source] ?? source
}
