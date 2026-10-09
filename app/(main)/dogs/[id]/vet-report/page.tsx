import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VetReportView, {
  type VetAnalysisRow,
  type VetMedicationRow,
  type VetSurveyAnswers,
  type VetWeightLog,
} from './VetReportView'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '수의사 보고서',
  robots: { index: false, follow: false },
}

// React 19 purity rule — Date.now() 를 컴포넌트 body 밖 helper 로.
function oneYearAgoIsoString(): string {
  return new Date(Date.now() - 365 * 86_400_000).toISOString()
}

/** 발행일(오늘) — 같은 이유로 body 밖 helper. */
function nowIsoString(): string {
  return new Date(Date.now()).toISOString()
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
 *  window.print() — A4 portrait, 14mm 마진. .no-print 헤더 숨김.
 *
 * # 보안
 *  본인 강아지만 (RLS + dog.user_id 일치 확인).
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 캔버스 D22): 그리는 부분은 VetReportView 로 옮겼다(조회는 여기 그대로).
 */
type Params = Promise<{ id: string }>

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
              limit: (n: number) => Promise<{ data: VetMedicationRow[] | null }>
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

  const answers = ((surveyRaw?.answers as unknown) ?? {}) as VetSurveyAnswers
  const analysis = analysisRaw as VetAnalysisRow | null
  const weights = (weightsRaw ?? []) as VetWeightLog[]
  const meds = (medsRaw ?? []) as VetMedicationRow[]

  return (
    <VetReportView
      data={{
        dog: {
          name: dog.name,
          breed: dog.breed,
          weight: dog.weight,
          age_value: dog.age_value,
          age_unit: dog.age_unit,
          gender: dog.gender,
          neutered: dog.neutered,
        },
        owner: owner ? { name: owner.name ?? null, phone: owner.phone ?? null } : null,
        answers,
        surveyCreatedAt: surveyRaw?.created_at ?? null,
        analysis,
        weights,
        meds,
        issuedAt: nowIsoString(),
      }}
    />
  )
}
