import { notFound, redirect } from 'next/navigation'
import { createClient, getRequestUser } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { customerHref } from '@/lib/admin/customer-link'

export const dynamic = 'force-dynamic'

/**
 * /admin/users/by-subscription/[subId] — 구독 id 로 고객 화면 찾아가기 (2026-10-14 C1).
 *
 * 포장 목록 카드는 구독 id 만 들고 있다(행에 user_id 가 없다). 그 파일을 크게 고치지 않고 카드 이름을 고객 화면으로
 * 잇기 위한 길 — 구독 주인을 찾아 /admin/users/[id] 로 보낸다. 조회 실패는 404 로 감추지 않고 던진다(규칙1).
 */
export default async function BySubscriptionPage({ params }: { params: Promise<{ subId: string }> }) {
  const { subId } = await params
  const user = await getRequestUser()
  if (!user) redirect('/login?next=/admin')
  const supabase = await createClient()
  if (!(await isAdmin(supabase, user))) redirect('/dashboard')
  if (!/^[0-9a-f-]{36}$/i.test(subId)) notFound()

  const { data, error } = await createAdminClient()
    .from('subscriptions')
    .select('user_id')
    .eq('id', subId)
    .maybeSingle()
  if (error) throw new Error(`구독 조회 실패: ${error.message}`)
  if (!data?.user_id) notFound()
  redirect(customerHref(data.user_id))
}
