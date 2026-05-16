// audit #101 — /mypage/subscriptions server wrapper. auth + 모든 subs (items
// + dogs nested) 를 server prefetch. ?new=1 / ?focus=id 도 server-side parse
// → client Suspense 래핑 제거.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SubscriptionsClient, {
  type Subscription,
} from './SubscriptionsClient'

export default async function MySubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; focus?: string }>
}) {
  const sp = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?next=/mypage/subscriptions')
  }

  const { data } = await supabase
    .from('subscriptions')
    .select('*, subscription_items(*), dogs(id, name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const initialSubs = (data ?? []) as Subscription[]
  const isNew = sp.new === '1'
  const focusSubId = sp.focus ?? null

  return (
    <SubscriptionsClient
      initialSubs={initialSubs}
      isNew={isNew}
      focusSubId={focusSubId}
    />
  )
}
