// /dogs/[id]/subscription — 강아지 상세 '구독' 탭.
//
// 신청 플로우(/order)와 분리 — 여기선 '이미 하는 구독' 관리만.
//
// 2026-07-16: 마이페이지(웹) SubscriptionsClient 재사용을 끊고 앱 전용 클라이언트로
// 교체(사장님 "구독 관리 페이지 그냥 개구려 전부 제대로 리뉴얼해"). 재사용하는 동안
// 웹 커머스 시절 물건(배송 주기 매주/4주 변경 등)이 이 화면에 그대로 딸려 왔었다.
// 자세한 배경은 DogSubscriptionClient 상단 주석 참고.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DogSubscriptionClient, { type DogSub } from './DogSubscriptionClient'

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
        .select(
          'id, status, interval_weeks, fresh_ratio, next_delivery_date, total_deliveries, ' +
            'total_amount, recipient_name, address, address_detail, billing_key, ' +
            'billing_card_brand, billing_card_last4, billing_customer_key, ' +
            'failed_charge_count, last_failed_charge_reason, ' +
            'requires_billing_key_renewal, created_at, subscription_items(product_name, quantity)',
        )
        .eq('user_id', user.id)
        .eq('dog_id', dogId)
        .order('created_at', { ascending: false }),
      // 처방이 있으면 레시피 고르는 단계(/plan)부터, 없으면 분석부터.
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
  const startHref = formulaRow
    ? `/dogs/${dogId}/plan`
    : `/dogs/${dogId}/analysis`

  return (
    <DogSubscriptionClient
      initialSubs={(subsData ?? []) as unknown as DogSub[]}
      dogName={dogName}
      startHref={startHref}
    />
  )
}
