import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VetReportPrintButton from './VetReportPrintButton'
import ShareWithVetButton from './ShareWithVetButton'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '수의사 보고서',
  robots: { index: false, follow: false },
}

// React 19 purity rule — Date.now() 를 컴포넌트 body 밖 helper 로.
function oneYearAgoIsoString(): string {
  return new Date(Date.now() - 365 * 86_400_000).toISOString()
}

/**
 * XL-2 (#14) — /dogs/[id]/vet-report
 *
 * 출원서 모듈 H. 수의사 사전 진료 보조용 A4 1장 인쇄 보고서.
 *
 * # 데이터
 *  - dogs 메타 (이름/견종/나이/체중)
 *  - surveys.answers (알레르기·만성질환·BCS·MCS·Bristol)
 *  - analyses 최신 (MER/RER, protein/fat/fiber DM%, 추천식)
 *  - weight_logs 최근 12개월 (sparkline)
 *  - medications (active)
 *
 * # 인쇄
 *  window.print() — A4 portrait, 18mm 마진. .no-print 헤더 숨김.
 *
 * # 보안
 *  본인 강아지만 (RLS + dog.user_id 일치 확인).
 */
type Params = Promise<{ id: string }>

interface SurveyAnswers {
  bcsExact?: number
  mcsScore?: number
  bristolScore?: number
  allergies?: string[]
  chronicDiseases?: string[]
}

interface AnalysisRow {
  id: string
  created_at: string
  mer: number | null
  rer: number | null
  stage: string | null
  bcs_label: string | null
  bcs_score: number | null
  feed_g: number | null
  protein_pct: number | null
  fat_pct: number | null
  carb_pct: number | null
  fiber_pct: number | null
  vet_consult_recommended: boolean | null
  next_review_date: string | null
  commentary: string | null
}

interface WeightLog {
  measured_at: string
  weight: number
}

interface MedicationRow {
  id: string
  name: string
  dose: string | null
  schedule: string | null
  time: string | null
  note: string | null
  enabled: boolean | null
}

export default async function VetReportPage({ params }: { params: Params }) {
  const { id: dogId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dogs/${dogId}/vet-report`)

  // R55 perf — 6 sequential fetch → 1 Promise.all (6 parallel).
  // 이전: dog → profile → survey → analysis → weights → meds = 6 round-trip.
  // 이후: 1 round-trip. dog 검증은 Promise.all 결과 받은 후 즉시 체크.

  // medications — generated types 가 아직 dog_medications 미포함 → cast.
  const medsClient = supabase.from('dog_medications' as never) as unknown as {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        eq: (col: string, val: string) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (n: number) => Promise<{ data: MedicationRow[] | null }>
            }
          }
        }
      }
    }
  }

  const oneYearAgoIso = oneYearAgoIsoString()

  const [
    { data: dog },
    { data: owner },
    { data: surveyRaw },
    { data: analysisRaw },
    { data: weightsRaw },
    { data: medsRaw },
  ] = await Promise.all([
    supabase
      .from('dogs')
      .select(
        'id, name, breed, weight, age_value, age_unit, gender, neutered, photo_url, user_id',
      )
      .eq('id', dogId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('name, phone')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('surveys')
      .select('answers, created_at')
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('analyses')
      .select(
        'id, created_at, mer, rer, stage, bcs_label, bcs_score, feed_g, protein_pct, fat_pct, carb_pct, fiber_pct, vet_consult_recommended, next_review_date, commentary',
      )
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('weight_logs')
      .select('measured_at, weight')
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      .gte('measured_at', oneYearAgoIso)
      .order('measured_at', { ascending: true })
      .limit(60),
    medsClient
      .select('id, name, dose, schedule, time, note, enabled')
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      .order('enabled', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20),
  ])
  if (!dog || dog.user_id !== user.id) notFound()

  const answers = ((surveyRaw?.answers as unknown) ?? {}) as SurveyAnswers
  const analysis = analysisRaw as AnalysisRow | null
  const weights = (weightsRaw ?? []) as WeightLog[]
  const meds = (medsRaw ?? []) as MedicationRow[]

  const todayStr = new Date().toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
  })

  return (
    <div className="px-5 py-5 print:px-0 print:py-0 bg-paper print:bg-white min-h-screen">
      <style>
        {`@media print {
          @page { size: A4 portrait; margin: 14mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .vet-report-page { box-shadow: none !important; border: none !important; }
        }`}
      </style>

      {/* 헤더 (인쇄 제외) */}
      <div className="flex items-end justify-between mb-5 no-print max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-black text-ink tracking-tight leading-snug">
            수의사 진료 보고서
          </h1>
          <p className="text-[12px] text-mute mt-1">
            동물병원에 가져가서 수의사에게 보여주세요. 최근 12개월 식이·체중·분석 요약.
          </p>
        </div>
        <VetReportPrintButton />
      </div>

      {/* XL-7 (#49) 수의사 공유 링크 — 인쇄 대신 URL 전달 */}
      <div className="max-w-4xl mx-auto mb-5 no-print">
        <ShareWithVetButton dogId={dogId} />
      </div>

      {/* 보고서 본문 */}
      <article
        className="vet-report-page bg-white border border-ink/20 mx-auto"
        style={{
          maxWidth: 760,
          padding: '28px 36px',
          fontFamily: 'var(--font-sans), Pretendard, system-ui, sans-serif',
        }}
      >
        {/* 제목 + 발행 정보 */}
        <header className="border-b-2 border-ink pb-3 mb-5">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-widest text-mute">
                Veterinary Pre-Consult Report
              </p>
              <h2 className="text-xl font-black text-ink mt-1 tracking-tight leading-snug">
                수의사 진료 보고서
              </h2>
            </div>
            <div className="text-right text-[10.5px] text-mute leading-relaxed">
              <div>발행: {todayStr}</div>
              <div>파머스테일 (Farmer&apos;s Tail)</div>
            </div>
          </div>
        </header>

        {/* 1. 반려견 정보 */}
        <Section title="1. 반려견 정보">
          <Grid>
            <Field label="이름" value={dog.name} />
            <Field label="견종" value={dog.breed ?? '—'} />
            <Field
              label="나이"
              value={
                dog.age_value
                  ? `${dog.age_value} ${
                      dog.age_unit === 'years' || dog.age_unit === 'year'
                        ? '세'
                        : '개월'
                    }`
                  : '—'
              }
            />
            <Field
              label="성별"
              value={
                dog.gender === 'male'
                  ? '수컷'
                  : dog.gender === 'female'
                    ? '암컷'
                    : '—'
              }
            />
            <Field label="중성화" value={dog.neutered ? '예' : '아니오'} />
            <Field
              label="현재 체중"
              value={dog.weight ? `${dog.weight} kg` : '—'}
            />
          </Grid>
        </Section>

        {/* 2. 견주 정보 */}
        <Section title="2. 견주 연락처">
          <Grid>
            <Field label="이름" value={owner?.name ?? '—'} />
            <Field label="전화" value={owner?.phone ?? '—'} />
          </Grid>
        </Section>

        {/* 3. 신체 평가 */}
        <Section title="3. 신체 상태 평가 (자가 측정)">
          <Grid>
            <Field
              label="BCS (체형 점수)"
              value={
                answers.bcsExact != null
                  ? `${answers.bcsExact} / 9`
                  : analysis?.bcs_score != null
                    ? `${analysis.bcs_score} / 9`
                    : '—'
              }
              hint="1=매우 마름 · 5=이상 · 9=비만"
            />
            <Field
              label="MCS (근육 점수)"
              value={
                answers.mcsScore != null ? `${answers.mcsScore} / 4` : '—'
              }
              hint="1=정상 · 4=심한 손실"
            />
            <Field
              label="Bristol Stool"
              value={
                answers.bristolScore != null
                  ? `${answers.bristolScore} / 7`
                  : '—'
              }
              hint="1=경변 · 4=이상 · 7=수양변"
            />
            <Field
              label="평가일"
              value={
                surveyRaw?.created_at
                  ? new Date(surveyRaw.created_at).toLocaleDateString('ko-KR', {
                      timeZone: 'Asia/Seoul',
                    })
                  : '—'
              }
            />
          </Grid>
        </Section>

        {/* 4. 체중 추이 (12개월) */}
        <Section title="4. 체중 추이 (최근 12개월)">
          {weights.length === 0 ? (
            <p className="text-[10.5px] text-mute">기록 없음.</p>
          ) : (
            <div>
              <WeightChart logs={weights} />
              <div className="grid grid-cols-3 gap-3 mt-3 text-[10.5px]">
                <Field
                  label="기간 시작"
                  value={`${weights[0]!.weight} kg`}
                  hint={new Date(weights[0]!.measured_at).toLocaleDateString(
                    'ko-KR',
                    { timeZone: 'Asia/Seoul' },
                  )}
                />
                <Field
                  label="기간 종료"
                  value={`${weights[weights.length - 1]!.weight} kg`}
                  hint={new Date(
                    weights[weights.length - 1]!.measured_at,
                  ).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
                />
                <Field
                  label="변화"
                  value={`${(
                    weights[weights.length - 1]!.weight - weights[0]!.weight
                  ).toFixed(2)} kg`}
                  hint={`${weights.length}회 측정`}
                />
              </div>
            </div>
          )}
        </Section>

        {/* 5. 알레르기 + 만성 질환 */}
        <Section title="5. 알레르기 · 만성 질환 (견주 보고)">
          <div className="grid grid-cols-2 gap-4 text-[12px]">
            <div>
              <p className="font-semibold text-ink mb-1.5">알레르기</p>
              {answers.allergies && answers.allergies.length > 0 ? (
                <ul className="list-disc pl-4 text-ink/80">
                  {answers.allergies.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-mute">없음 (또는 미입력)</p>
              )}
            </div>
            <div>
              <p className="font-semibold text-ink mb-1.5">만성 질환</p>
              {answers.chronicDiseases && answers.chronicDiseases.length > 0 ? (
                <ul className="list-disc pl-4 text-ink/80">
                  {answers.chronicDiseases.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-mute">없음 (또는 미입력)</p>
              )}
            </div>
          </div>
        </Section>

        {/* 6. 현재 식이 */}
        <Section title="6. 현재 식이 (파머스테일 분석 결과)">
          {!analysis ? (
            <p className="text-[10.5px] text-mute">분석 기록 없음.</p>
          ) : (
            <>
              <Grid>
                <Field
                  label="일일 권장 칼로리 (MER)"
                  value={
                    analysis.mer != null ? `${analysis.mer.toFixed(0)} kcal` : '—'
                  }
                />
                <Field
                  label="일일 권장 급여량"
                  value={
                    analysis.feed_g != null ? `${analysis.feed_g.toFixed(0)} g` : '—'
                  }
                />
                <Field
                  label="단백질 (DM)"
                  value={
                    analysis.protein_pct != null
                      ? `${analysis.protein_pct.toFixed(1)}%`
                      : '—'
                  }
                />
                <Field
                  label="지방 (DM)"
                  value={
                    analysis.fat_pct != null
                      ? `${analysis.fat_pct.toFixed(1)}%`
                      : '—'
                  }
                />
                <Field
                  label="탄수화물"
                  value={
                    analysis.carb_pct != null
                      ? `${analysis.carb_pct.toFixed(1)}%`
                      : '—'
                  }
                />
                <Field
                  label="섬유"
                  value={
                    analysis.fiber_pct != null
                      ? `${analysis.fiber_pct.toFixed(1)}%`
                      : '—'
                  }
                />
              </Grid>
              {analysis.commentary && (
                <div className="mt-3 p-3 bg-ink/5 rounded text-[12px] leading-relaxed">
                  {analysis.commentary}
                </div>
              )}
            </>
          )}
        </Section>

        {/* 7. 현재 복용 약물 */}
        <Section title="7. 현재 복용 약물">
          {meds.filter((m) => m.enabled !== false).length === 0 ? (
            <p className="text-[10.5px] text-mute">기록 없음.</p>
          ) : (
            <table className="w-full text-[10.5px] border-collapse">
              <thead>
                <tr className="border-b border-ink/30 text-mute">
                  <th className="text-left py-2 px-2.5 font-semibold">약물명</th>
                  <th className="text-left py-2 px-2.5 font-semibold">용량</th>
                  <th className="text-left py-2 px-2.5 font-semibold">스케줄</th>
                  <th className="text-left py-2 px-2.5 font-semibold">비고</th>
                </tr>
              </thead>
              <tbody>
                {meds
                  .filter((m) => m.enabled !== false)
                  .map((m) => (
                    <tr key={m.id} className="border-b border-ink/10">
                      <td className="py-2 px-2.5 text-ink">{m.name}</td>
                      <td className="py-2 px-2.5 text-ink/80">{m.dose ?? '—'}</td>
                      <td className="py-2 px-2.5 text-ink/80">
                        {m.schedule ?? '—'}
                        {m.time ? ` · ${m.time}` : ''}
                      </td>
                      <td className="py-2 px-2.5 text-ink/60 text-[10.5px]">
                        {m.note ?? '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* 8. 권고 사항 */}
        <Section title="8. 다음 점검">
          <Grid>
            <Field
              label="수의사 진료 권고 여부"
              value={
                analysis?.vet_consult_recommended ? '권고됨' : '권고 없음'
              }
            />
            <Field
              label="다음 분석 권장일"
              value={
                analysis?.next_review_date
                  ? new Date(analysis.next_review_date).toLocaleDateString(
                      'ko-KR',
                      { timeZone: 'Asia/Seoul' },
                    )
                  : '—'
              }
            />
          </Grid>
        </Section>

        {/* footer */}
        <footer className="border-t border-ink/30 pt-3 mt-5 text-[10.5px] text-mute leading-relaxed">
          <p>
            본 보고서는 견주의 자가 측정 + 파머스테일 알고리즘 분석 결과를
            요약한 자료입니다. 의료 진단을 대체하지 않으며 수의사 진료의 보조
            자료로 활용해 주세요.
          </p>
          <p className="mt-1">
            발행처: 파머스테일 (Farmer&apos;s Tail) · farmerstail.kr ·{' '}
            {todayStr}
          </p>
        </footer>
      </article>
    </div>
  )
}

// ─── Sub components ───

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  // R57 — Section title 과 내용 사이 mb-2 → mb-2.5 (8→10px). border-bottom
  // pb-1 → pb-1.5 로 약간 숨통. Section 간 mb-5 (20px) 유지.
  return (
    <section className="mb-5 print:break-inside-avoid">
      <h3 className="text-[10.5px] font-bold uppercase tracking-widest text-ink/70 mb-2.5 border-b border-ink/20 pb-1.5">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  // R57 — gap-y-2 (8px) → gap-y-3 (12px). 정보 카드 사이 숨 쉴 공간.
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 text-[12px]">
      {children}
    </div>
  )
}

function Field({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  // R57 — label↔value 사이 mt-0.5 (2px) 추가. 라인 height 만으로 분리되던
  // 두 줄이 따닥따닥 붙어보이던 문제 해소.
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wider text-mute">
        {label}
      </div>
      <div className="text-[12px] text-ink font-medium mt-0.5">{value}</div>
      {hint && <div className="text-[9.5px] text-mute mt-0.5">{hint}</div>}
    </div>
  )
}

function WeightChart({ logs }: { logs: WeightLog[] }) {
  if (logs.length < 2) {
    return (
      <p className="text-[10.5px] text-mute">
        측정 2회 이상 필요 (현재 {logs.length}회).
      </p>
    )
  }
  const weights = logs.map((l) => l.weight)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const range = max - min || 1
  const W = 600
  const H = 80
  const points = logs
    .map((l, i) => {
      const x = (i / (logs.length - 1)) * W
      const y = H - ((l.weight - min) / range) * (H - 10) - 5
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-20 border border-ink/20 bg-ink/5"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        points={points}
      />
      {logs.map((l, i) => {
        const x = (i / (logs.length - 1)) * W
        const y = H - ((l.weight - min) / range) * (H - 10) - 5
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={1.6}
            fill="currentColor"
          />
        )
      })}
      <text
        x={4}
        y={H - 4}
        fontSize={8}
        fill="currentColor"
        opacity={0.5}
      >
        {min.toFixed(1)} kg
      </text>
      <text
        x={4}
        y={12}
        fontSize={8}
        fill="currentColor"
        opacity={0.5}
      >
        {max.toFixed(1)} kg
      </text>
    </svg>
  )
}
