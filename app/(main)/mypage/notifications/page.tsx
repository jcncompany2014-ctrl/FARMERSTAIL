import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NotificationSettingsClient from './NotificationSettingsClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '알림 설정',
  robots: { index: false, follow: false },
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/notifications')

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, user_agent, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null

  return (
    <NotificationSettingsClient
      initialSubs={
        subs ?? ([] as { id: string; endpoint: string; user_agent: string | null; created_at: string }[])
      }
      vapidPublicKey={vapidPublicKey}
    />
  )
}
