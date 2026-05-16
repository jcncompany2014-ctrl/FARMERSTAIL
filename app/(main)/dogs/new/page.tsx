// audit #101 — /dogs/new server wrapper. auth 검증 + user.id 만 prop drill.
// 이전: client useEffect 미인증 시 router.push('/login') → spinner flash.
// 이후: server-side redirect.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NewDogClient from './NewDogClient'

export default async function NewDogPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?next=/dogs/new')
  }

  return <NewDogClient userId={user.id} />
}
