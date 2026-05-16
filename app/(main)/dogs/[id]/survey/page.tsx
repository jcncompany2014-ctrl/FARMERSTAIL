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

  return <SurveyClient dogId={id} />
}
