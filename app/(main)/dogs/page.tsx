// audit #101: 'use client' → server component RSC.
// 이전: client 가 useEffect 에서 auth + supabase fetch → spinner 800ms+.
// 새: server 에서 prefetch → 즉시 페인트. 인증 redirect 도 server.
// 2026-10-09 앱 새 디자인('A 포스터', 시안 T07·T08): 그리는 부분은 DogsListView 로 뺐다(조회는 그대로 여기).
//   화면 이름 '우리 아이'는 윗줄(AppChrome)이 그리고, 시안의 윗줄 오른쪽 '+ 추가'도 윗줄 몫이다.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DogsListView, { type DogListItem } from './DogsListView'

type Dog = DogListItem & {
  gender: string | null
  created_at: string
}

export default async function DogsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?next=/dogs')
  }

  // Explicit user_id filter (defense-in-depth).
  const { data } = await supabase
    .from('dogs')
    .select(
      'id, name, breed, gender, weight, age_value, age_unit, photo_url, created_at',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const dogs = (data ?? []) as Dog[]

  return <DogsListView dogs={dogs} />
}
