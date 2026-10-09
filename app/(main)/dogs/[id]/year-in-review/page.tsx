import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import YearInReviewView, { YearTooEarlyView } from './YearInReviewView'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '한 해 회고',
  robots: { index: false, follow: false },
}

type Params = Promise<{ id: string }>

/**
 * /dogs/[id]/year-in-review — 최근 365일 동안의 함께한 한 해 회고.
 *
 * 사용자 자율 진입 (마일스톤 카드 365일에서 cta 로 연결 가능). 발표 톤은
 * "정성껏 챙겨주셔서 고마워요" — 견 주어, 시스템 성공 X.
 *
 * # 데이터
 *  - dogs: 등록일 + 이름 + 사진
 *  - weight_logs: 시작·종료·min·max (체중 변화 추세)
 *  - dog_checkins: 365일 카운트
 *  - analyses: 365일 카운트
 *  - dog_diary: 365일 카운트 (있을 때만 — 테이블 없으면 silent skip)
 *
 * # 비유효 진입
 *  - dog 가입 후 30일 미만이면 "아직 한 해가 안 됐어요" 안내.
 *  - 가입 365일+ 인 사용자는 첫 진입 시 일종의 surprise — share CTA 도 포함.
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 캔버스 A09·I11): 그리는 부분은 YearInReviewView 로 옮겼다(조회·계산은 여기 그대로).
 */
export default async function YearInReviewPage({
  params,
}: {
  params: Params
}) {
  const { id: dogId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dogs/${dogId}/year-in-review`)

  const { data: dog } = await supabase
    .from('dogs')
    .select('id, name, photo_url, created_at')
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!dog) notFound()

  const dogRow = dog as {
    id: string
    name: string
    photo_url: string | null
    created_at: string
  }

  // 기간 — 등록일 ~ 365일 후 (또는 등록일 ~ 오늘 중 짧은 쪽).
  const registeredAt = new Date(dogRow.created_at)
  const yearAfter = new Date(registeredAt.getTime() + 365 * 86_400_000)
  const now = new Date()
  const periodEnd = now < yearAfter ? now : yearAfter
  const sinceIso = registeredAt.toISOString()
  const untilIso = periodEnd.toISOString()
  const daysIn = Math.floor(
    (periodEnd.getTime() - registeredAt.getTime()) / 86_400_000,
  )
  // 1년 미만 계정(예: 66일)엔 "한 해" 문구가 거짓 → 실제 기간에 맞춰 톤 전환.
  // (제목은 항상 실제 일수 "함께한 N일" 로 정직하게.) 사장님 2026-07-23 점검.
  const isFullYear = daysIn >= 365

  const [
    { data: weightLogs },
    { count: checkinCount },
    { count: analysisCount },
    { count: diaryCount },
  ] = await Promise.all([
    supabase
      .from('weight_logs')
      .select('weight, measured_at')
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      .gte('measured_at', sinceIso)
      .lte('measured_at', untilIso)
      .order('measured_at', { ascending: true }),
    supabase
      .from('dog_checkins')
      .select('id', { count: 'exact', head: true })
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      .gte('created_at', sinceIso)
      .lte('created_at', untilIso),
    supabase
      .from('analyses')
      .select('id', { count: 'exact', head: true })
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      .eq('source', 'survey') // 받은 분석 = 설문. 자견 월간 자동 갱신은 세지 않는다
      .gte('created_at', sinceIso)
      .lte('created_at', untilIso),
    supabase
      .from('dog_diary')
      .select('id', { count: 'exact', head: true })
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      // ★dog_diary 엔 entry_date 가 없다(2026-09-16 실측: created_at 뿐). PostgREST 가
      //   42703 으로 거절해 count=null → 연간 리뷰 '그림일기' 가 영구 0편이었다.
      .gte('created_at', sinceIso)
      .lte('created_at', untilIso),
  ])

  type WLog = { weight: number; measured_at: string }
  const wlogs = ((weightLogs ?? []) as WLog[]).filter(
    (w) => typeof w.weight === 'number' && Number.isFinite(w.weight),
  )
  const weightStart = wlogs[0]?.weight ?? null
  const weightEnd = wlogs[wlogs.length - 1]?.weight ?? null
  const weightDelta =
    weightStart != null && weightEnd != null
      ? Math.round((weightEnd - weightStart) * 100) / 100
      : null
  const weightMax = wlogs.length
    ? Math.max(...wlogs.map((w) => w.weight))
    : null
  const weightMin = wlogs.length
    ? Math.min(...wlogs.map((w) => w.weight))
    : null

  if (daysIn < 30) {
    return <YearTooEarlyView dogId={dogRow.id} dogName={dogRow.name} daysIn={daysIn} />
  }

  return (
    <YearInReviewView
      data={{
        dogId: dogRow.id,
        dogName: dogRow.name,
        daysIn,
        isFullYear,
        analysisCount: analysisCount ?? 0,
        weightCount: wlogs.length,
        checkinCount: checkinCount ?? 0,
        diaryCount: diaryCount ?? 0,
        weightStart,
        weightEnd,
        weightDelta,
        weightMin,
        weightMax,
      }}
    />
  )
}
