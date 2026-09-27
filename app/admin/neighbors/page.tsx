import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, getRequestUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { AdminHeader, LoadError } from '@/components/admin/ui'
import NeighborsClient, { type NeighborRow } from './NeighborsClient'

/**
 * /admin/neighbors — 이웃 할인 (사장님 2026-09-27).
 *
 * 지인·쓰레드·인스타 DM 등으로 온 특정 고객에게 첫 박스 할인율(10~50%)을 붙인다.
 * 첫 결제 1회 소진, 등급·이벤트 코드와는 더 큰 쪽 하나만, 서포터즈 가격이 있으면 그것이
 * 우선(lib/payments/auto-discount.ts). 전액 환불·취소되면 자동으로 되돌아온다.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '이웃 할인',
  robots: { index: false, follow: false },
}

export default async function AdminNeighborsPage() {
  const supabase = await createClient()
  const user = await getRequestUser()
  if (!user) redirect('/login?next=/admin/neighbors')
  if (!(await isAdmin(supabase, user))) redirect('/')

  const admin = createAdminClient()
  // 규칙1 — error 를 버리면 조회 실패가 "이웃 할인 없음"으로 위장한다.
  const { data: rows, error } = await admin
    .from('neighbor_discounts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <>
        <AdminHeader title="이웃 할인" sub="지인·쓰레드 유입 고객 첫 박스 할인" />
        <LoadError what="이웃 할인 목록" />
      </>
    )
  }

  const ids = (rows ?? []).map((r) => r.user_id)
  const profileById = new Map<string, { name: string | null; email: string | null }>()
  if (ids.length > 0) {
    const { data: profs } = await admin.from('profiles').select('id, name, email').in('id', ids)
    for (const p of profs ?? []) profileById.set(p.id, { name: p.name, email: p.email })
  }

  const list: NeighborRow[] = (rows ?? []).map((r) => ({
    user_id: r.user_id,
    rate: Number(r.rate),
    source: r.source,
    note: r.note,
    created_at: r.created_at,
    redeemed_order_id: r.redeemed_order_id,
    redeemed_at: r.redeemed_at,
    profile: profileById.get(r.user_id) ?? { name: null, email: null },
  }))

  return (
    <>
      <AdminHeader
        title="이웃 할인"
        sub="지인·쓰레드·인스타 DM 으로 온 분에게 첫 박스 할인율을 붙여요 — 첫 결제 한 번에만 적용"
      />
      <NeighborsClient initial={list} />
    </>
  )
}
