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

  const [
    { data: dog, error: dogErr },
    { data: subsData, error: subsErr },
    { data: formulaRow, error: formulaErr },
  ] = await Promise.all([
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
            'total_amount, recipient_name, address, address_detail, has_billing_key, ' +
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

  // ★조회 실패를 "없음" 으로 읽지 않는다(AGENTS 규칙1, 2026-08-03 검수).
  //   AGENTS.md 가 이 화면의 **웹 판**에서 일어났던 사고로 기록해 둔 것이
  //   앱 판에 그대로 남아 있었다: "새 정기배송 화면이 조회 실패를 '구독 없음'
  //   으로 표시해, 결제가 걸린 고객에게 '정기배송을 시작할 수 있어요'를 안내했다."
  //   구독 조회가 실패했는데 빈 배열로 넘기면 이 화면은
  //   "푸린이의 정기배송이 아직 없어요 → 정기배송 시작하기" 를 그린다.
  //   이미 결제 중인 고객이 그걸 보고 다시 신청하면 중복 구독이 된다
  //   (DB UNIQUE 가 막지만, 고객은 영문을 모른 채 오류를 만난다).
  //   던지면 error.tsx 가 "문제가 생겼어요 · 다시 시도" 를 보여준다 — 없다고
  //   거짓말하는 것보다 낫다.
  if (subsErr) {
    throw new Error(`[dogs/subscription] 구독 조회 실패: ${subsErr.message}`)
  }
  // 처방 유무는 시작 지점(plan vs analysis)만 가르므로 실패해도 화면은 뜬다.
  // 다만 조용히 analysis 로 보내면 "왜 레시피 고르는 데로 안 가지" 가 되므로 남긴다.
  if (formulaErr) {
    console.error('[dogs/subscription] 처방 조회 실패:', formulaErr.message)
  }
  if (dogErr) {
    throw new Error(`[dogs/subscription] 강아지 조회 실패: ${dogErr.message}`)
  }
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
