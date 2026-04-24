import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ConsentSettingsClient from './ConsentSettingsClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '광고·마케팅 수신 설정',
  robots: { index: false, follow: false },
}

/**
 * /mypage/consent — 이메일/SMS 광고성 정보 수신동의 관리.
 *
 * 정보통신망법 §50 가 요구하는 것:
 *   1. 동의일자 확인/통지 의무 → `agree_email_at`, `agree_sms_at` 표시
 *   2. 동의 철회 용이성       → 토글 하나로 해제
 *   3. 동의/철회 이력 감사     → `consent_log` 이력 최근 10건 보여줌
 */
export default async function ConsentPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/consent')

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'agree_email, agree_sms, agree_email_at, agree_sms_at, marketing_policy_version',
    )
    .eq('id', user.id)
    .maybeSingle()

  const { data: history } = await supabase
    .from('consent_log')
    .select('id, channel, granted, granted_at, policy_version, source')
    .eq('user_id', user.id)
    .order('granted_at', { ascending: false })
    .limit(10)

  return (
    <ConsentSettingsClient
      initial={{
        agree_email: Boolean(profile?.agree_email),
        agree_sms: Boolean(profile?.agree_sms),
        agree_email_at: profile?.agree_email_at ?? null,
        agree_sms_at: profile?.agree_sms_at ?? null,
        marketing_policy_version: profile?.marketing_policy_version ?? null,
      }}
      history={(history ?? []).map((r) => ({
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
