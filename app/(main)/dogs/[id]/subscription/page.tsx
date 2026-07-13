// /dogs/[id]/subscription — 강아지 상세 '구독' 탭 (사장님 2026-07-13).
// 신청 플로우(/order)와 분리 — 여기선 '이미 하는 구독' 관리만: 진행중/과거
// 정기배송의 일시정지·재개·스킵·주기변경·해지·카드재등록. 마이페이지 구독관리
// (SubscriptionsClient)를 dogId 스코프로 재사용. 구독 없으면 시작 CTA.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SubscriptionsClient, {
  type Subscription,
} from '@/app/(main)/mypage/subscriptions/SubscriptionsClient'

export default async function DogSubscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: dogId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/dogs/${dogId}/subscription`)

  const [{ data: dog }, { data: subsData }, { data: formulaRow }] =
    await Promise.all([
      supabase
        .from('dogs')
        .select('name')
        .eq('id', dogId)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('subscriptions')
        .select('*, subscription_items(*), dogs(id, name)')
        .eq('user_id', user.id)
        .eq('dog_id', dogId)
        .order('created_at', { ascending: false }),
      supabase
        .from('dog_formulas')
        .select('id')
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle(),
    ])

  if (!dog) redirect('/dogs')
  const dogName = (dog as { name: string }).name
  const initialSubs = (subsData ?? []) as Subscription[]
  // 처방 있으면 상품(플랜) 페이지로, 없으면 분석부터.
  const startHref = formulaRow
    ? `/dogs/${dogId}/plan`
    : `/dogs/${dogId}/analysis`

  return (
    <SubscriptionsClient
      initialSubs={initialSubs}
      isNew={false}
      focusSubId={null}
      dogId={dogId}
      dogName={dogName}
      startHref={startHref}
    />
  )
}
