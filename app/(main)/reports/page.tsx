// B5 — 월간 / 연간 통합 리포트 (app-only).
// 사용자별 모든 강아지의 체중 / 다이어리 / 분석 highlight 집계.
// 2026-10-09 앱 새 디자인('A 포스터', 캔버스 A11): 그리는 부분은 ReportsView 로 옮겼다(집계는 여기 그대로).

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReportsView from './ReportsView'
import { todayKstIsoDate } from '@/lib/datetime-kst'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/reports')

  // 한 달 기준 집계 — 체중 측정 횟수, 다이어리 entry, 분석 개수.
  // 월 경계는 **KST 기준**(아래 monthLabel 도 KST). 서버 UTC 로 new Date().setDate(1)
  // 하면 경계가 UTC 월 1일 00시(=KST 09시)라, KST 1일 00~08:59 기록이 이달 집계에서
  // 빠져 라벨(KST 월)과 카운트가 어긋난다. KST 월초를 명시 계산해 정합.
  const kstToday = todayKstIsoDate() // 'YYYY-MM-DD' (KST)
  const monthIso = new Date(`${kstToday.slice(0, 7)}-01T00:00:00+09:00`).toISOString()

  const [weightRes, diaryRes, analysesRes, dogsRes] = await Promise.all([
    supabase
      .from('weight_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('measured_at', monthIso),
    supabase
      .from('dog_diary')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monthIso),
    supabase
      .from('analyses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('source', 'survey') // 자견 월간 자동 갱신은 '받은 분석' 횟수가 아니다
      .gte('created_at', monthIso),
    supabase
      .from('dogs')
      .select('id, name')
      .eq('user_id', user.id),
  ])

  const monthLabel = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    // 서버=UTC. timeZone 없으면 매월 1일 KST 00~09시(UTC 전월)에 지난 달로 표시됨.
    timeZone: 'Asia/Seoul',
  })

  const dogs = (dogsRes.data ?? []) as Array<{ id: string; name: string }>

  return (
    <ReportsView
      monthLabel={monthLabel}
      weightCount={weightRes.count ?? 0}
      diaryCount={diaryRes.count ?? 0}
      analysisCount={analysesRes.count ?? 0}
      dogs={dogs}
    />
  )
}
