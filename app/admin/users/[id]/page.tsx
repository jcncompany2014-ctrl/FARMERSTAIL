import { notFound, redirect } from 'next/navigation'
import { createClient, getRequestUser } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { loadCustomerData } from './_data'
import CustomerView from './CustomerView'

export const dynamic = 'force-dynamic'

/**
 * /admin/users/[id] — 고객 한 명 화면 (2026-10-14 C1, 규칙253).
 *
 * 예전엔 이 주소 아래에 1:1 메시지(/message)만 있어서, 한 고객을 보려면 회원 목록·정기배송·주문·설문·포장 목록을
 * 따로 열어 맞춰 봐야 했고, 알레르기·기저질환은 어드민 어디에도 안 보였다. 여기 한 화면에 모은다.
 * 통합 검색·구독 목록·주문 상세·포장 목록·회원 목록의 고객 이름이 이리로 온다(lib/admin/customer-link).
 *
 * 레이아웃이 관리자를 확인하지만 여기서도 다시 본다 — 이 화면은 service_role 로 읽는다(_data.ts).
 */
export default async function AdminCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getRequestUser()
  if (!user) redirect('/login?next=/admin')
  const supabase = await createClient()
  if (!(await isAdmin(supabase, user))) redirect('/dashboard')
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const data = await loadCustomerData(id)
  if (!data) notFound()
  return <CustomerView data={data} />
}
