import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, getRequestUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { AdminHeader, LoadError } from '@/components/admin/ui'
import TrialsClient, { type TrialRow } from './TrialsClient'

/**
 * /admin/trials — 구독 체험단 도장 (docs/TRIAL_PROGRAM_2026_10.md v2).
 *
 * 선발자가 일반 가입을 마치면 여기서 도장을 찍는다. 도장이 붙은 계정은
 * 청구가 100원×4 → 자기 구독가 반값×4 → 정상가로 자동 진행되고,
 * 각 전환의 마지막 결제 때 다음 가격 예고 푸시가 나간다.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '체험단',
  robots: { index: false, follow: false },
}

export default async function AdminTrialsPage() {
  const supabase = await createClient()
  const user = await getRequestUser()
  if (!user) redirect('/login?next=/admin/trials')
  if (!(await isAdmin(supabase, user))) redirect('/')

  const admin = createAdminClient()
  // 규칙1 — error 를 버리면 조회 실패가 "체험단 없음"으로 위장한다.
  const { data: trials, error } = await admin
    .from('subscription_trials')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <>
        <AdminHeader title="체험단" sub="구독 체험단 도장 · 진행 현황" />
        <LoadError what="체험단 목록" />
      </>
    )
  }

  const ids = (trials ?? []).map((t) => t.user_id)
  const profileById = new Map<string, { name: string | null; email: string | null }>()
  if (ids.length > 0) {
    const { data: profs } = await admin.from('profiles').select('id, name, email').in('id', ids)
    for (const p of profs ?? []) profileById.set(p.id, { name: p.name, email: p.email })
  }

  const rows: TrialRow[] = (trials ?? []).map((t) => ({
    ...t,
    profile: profileById.get(t.user_id) ?? { name: null, email: null },
  }))

  return (
    <>
      <AdminHeader title="체험단" sub="도장 찍기 · 3단 가격(100원→반값→정상) 진행 현황" />
      <TrialsClient initial={rows} />
    </>
  )
}
