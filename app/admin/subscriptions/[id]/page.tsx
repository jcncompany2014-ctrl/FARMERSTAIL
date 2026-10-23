import { notFound, redirect } from 'next/navigation'
import { createClient, getRequestUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { loadInternalUserIds, isInternalUser } from '@/lib/admin/internal-accounts'
import { loadCustomerData } from '@/app/admin/users/[id]/_data'
import SubscriptionSheet from './SubscriptionSheet'

export const dynamic = 'force-dynamic'

/**
 * /admin/subscriptions/[id] — 정기배송 한 장 (2026-10-24 규칙314).
 *
 * 새 정기배송 알림·홈 '새로 들어온 것'·정기배송 목록·달력·이번 주 할 일이 이 주소로 온다(lib/admin/customer-link
 * subscriptionHref). 데이터는 고객 화면과 **같은 조회**(loadCustomerData — 청구·포장과 같은 정본 함수 모음)에서 이 구독과
 * 그 강아지만 골라 그린다. 돈·날짜를 여기서 다시 계산하지 않는다.
 *
 * service_role 로 읽으므로 레이아웃과 별개로 여기서도 관리자를 확인한다(클라이언트 이동 때 레이아웃은 다시 안 돈다).
 */
export default async function AdminSubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getRequestUser()
  if (!user) redirect(`/login?next=/admin/subscriptions/${encodeURIComponent(id)}`)
  const supabase = await createClient()
  if (!(await isAdmin(supabase, user))) redirect('/dashboard')
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const admin = createAdminClient()
  // 구독 주인 — 조회 실패는 '없는 구독'(404)으로 보이지 않게 던진다(규칙1).
  const { data: owner, error } = await admin.from('subscriptions').select('user_id').eq('id', id).maybeSingle()
  if (error) throw new Error(`정기배송을 찾지 못했어요: ${error.message}`)
  if (!owner?.user_id) notFound()

  const [data, internal] = await Promise.all([loadCustomerData(owner.user_id), loadInternalUserIds(admin)])
  if (!data) notFound()
  const sub = data.subs.find((s) => s.id === id)
  if (!sub) notFound()
  const dog = (sub.dogId && data.dogs.find((d) => d.id === sub.dogId)) || null
  // eslint-disable-next-line react-hooks/purity -- 서버 컴포넌트 한 번 그리기('새' 배지 48시간 판정)
  const isNew = Date.now() - Date.parse(sub.createdAt) < 48 * 60 * 60 * 1000

  return <SubscriptionSheet data={data} sub={sub} dog={dog} isTest={isInternalUser(owner.user_id, internal.ids)} isNew={isNew} />
}
