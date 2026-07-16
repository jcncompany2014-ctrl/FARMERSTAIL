// 알림 통합 페이지(2026-07-16) — 받은 알림 + 알림 설정 + 광고 수신을 탭 하나로.
// 세 화면의 서버 prefetch 를 여기서 모아 AlertsClient(탭) 에 넘긴다.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AlertsClient from './AlertsClient'
import { type Row } from './NotificationsClient'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?next=/notifications')
  }

  const [inboxRes, pushSubsRes, profileRes, consentHistoryRes] =
    await Promise.all([
      // 받은 알림 (인박스)
      supabase
        .from('push_log')
        .select('id, title, body, url, category, sent_count, read_at, sent_at')
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(100),
      // 알림 설정 — 등록된 기기
      supabase
        .from('push_subscriptions')
        .select('id, endpoint, user_agent, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      // 광고 수신 — 동의 현황
      supabase
        .from('profiles')
        .select(
          'agree_email, agree_sms, agree_email_at, agree_sms_at, marketing_policy_version',
        )
        .eq('id', user.id)
        .maybeSingle(),
      // 광고 수신 — 변경 이력
      supabase
        .from('consent_log')
        .select('id, channel, granted, granted_at, policy_version, source')
        .eq('user_id', user.id)
        .order('granted_at', { ascending: false })
        .limit(10),
    ])

  const profile = profileRes.data

  return (
    <AlertsClient
      initialTab={tab}
      inboxRows={((inboxRes.data ?? []) as unknown) as Row[]}
      pushSubs={pushSubsRes.data ?? []}
      vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
      consentInitial={{
        agree_email: Boolean(profile?.agree_email),
        agree_sms: Boolean(profile?.agree_sms),
        agree_email_at: profile?.agree_email_at ?? null,
        agree_sms_at: profile?.agree_sms_at ?? null,
        marketing_policy_version: profile?.marketing_policy_version ?? null,
      }}
      consentHistory={(consentHistoryRes.data ?? []).map((r) => ({
        id: r.id,
        channel: r.channel as 'email' | 'sms',
        granted: Boolean(r.granted),
        granted_at: r.granted_at,
        policy_version: r.policy_version ?? null,
        source: r.source ?? null,
      }))}
    />
  )
}
