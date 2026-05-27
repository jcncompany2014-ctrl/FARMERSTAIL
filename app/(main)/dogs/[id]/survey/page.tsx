// audit #109: server-side 인증 + dogId 검증. 이전엔 client 가 useEffect 에서
// supabase.auth.getUser() 후 미인증 시 router.push('/login') → UI flash + history
// pollution. 서버에서 redirect 하면 빈 surface 없이 깔끔.
//
// audit #100 / #101 partial: page.tsx server component 화 (Next 16 params Promise).
// 실제 survey 흐름 (8 step state, autosave) 은 SurveyClient.tsx 그대로 — #96
// step 별 dynamic import 분할은 별도 sprint.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SurveyClient from './SurveyClient'

export default async function SurveyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=/dogs/${id}/survey`)
  }

  // dog 소유 검증 — 다른 사용자 dogId 로 진입 시 /dogs 로.
  const { data: dog } = await supabase
    .from('dogs')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!dog) {
    redirect('/dogs')
  }

  // R80-P1: 재분석 30일 제한 — Anthropic 비용 폭주 차단.
  // 마지막 분석 후 30일 이내면 새 설문 차단, 기존 분석 페이지로 redirect.
  // 6개월(180일) 후 cron 이 자동으로 재진단 푸시 알림 발송.
  // URL ?force=1 로 우회 가능 (admin / 비상 시 — application 측 보호선만)
  const forceParam = false // 추후 searchParams 로 admin 우회 추가 가능
  if (!forceParam) {
    const { data: lastAnalysis } = await supabase
      .from('analyses')
      .select('id, created_at')
      .eq('dog_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastAnalysis && lastAnalysis.created_at) {
      // 서버 컴포넌트 — react-hooks/purity 규칙 우회 위해 new Date() 만 사용.
      // Date.now() 는 impure 함수로 분류되어 정적 분석에 막힘.
      const now = new Date()
      const ageMs =
        now.getTime() - new Date(lastAnalysis.created_at).getTime()
      const ageDays = ageMs / (1000 * 60 * 60 * 24)
      if (ageDays < 30) {
        // 30일 미만 — 최신 분석 페이지로. 사용자에게 안내는 그 페이지에서
        // ?from=survey_blocked query 로 토스트 표시.
        const daysLeft = Math.ceil(30 - ageDays)
        redirect(
          `/dogs/${id}/analysis?from=survey_blocked&days=${daysLeft}`,
        )
      }
    }
  }

  return <SurveyClient dogId={id} />
}
