// audit #101 — /notifications server wrapper. auth + 최근 100 push_log row
// 를 server prefetch. mark-read / filter / navigate 만 client.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NotificationsClient, { type Row } from './NotificationsClient'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?next=/notifications')
  }

  const { data } = await supabase
    .from('push_log')
    .select('id, title, body, url, category, sent_count, read_at, sent_at')
    .eq('user_id', user.id)
    .order('sent_at', { ascending: false })
    .limit(100)

  const rows = ((data ?? []) as unknown) as Row[]

  return <NotificationsClient initialRows={rows} />
}
