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
import DogSubscriptionClient, { type DogSub, type ChargePreview } from './DogSubscriptionClient'
import { getTrialState } from '@/lib/payments/trial-state'
import { resolveAutoDiscount } from '@/lib/payments/auto-discount'
import { getChargeTiming } from '@/lib/payments/charge-timing'
import { PAID_STATUSES } from '@/lib/commerce/paid-status'

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
        .select('name, photo_url')
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
  const dogPhoto = (dog as { photo_url?: string | null }).photo_url ?? null
  const startHref = formulaRow
    ? `/dogs/${dogId}/plan`
    : `/dogs/${dogId}/analysis`

  // ★다음 결제액은 청구 크론과 **같은 함수**(resolveAutoDiscount)로(2026-09-28 점검 9차). 예전엔 이 화면만
  //   서포터즈 할인(trialPricing)만 반영해, 이벤트·이웃 할인·나무 등급 10% 가 빠진 금액을 "결제 예정"으로
  //   보여 줬다(사전고지 메일·/mypage/subscriptions 와 숫자가 갈렸다). 계산 실패는 null → 화면이 옛 방식으로.
  const subsList = (subsData ?? []) as unknown as DogSub[]
  const chargePreview: Record<string, ChargePreview> = {}
  await Promise.all(
    subsList
      .filter((s) => s.status === 'active' || s.status === 'paused')
      .map(async (s) => {
        try {
          const d = await resolveAutoDiscount({ userId: user.id, subtotal: s.total_amount ?? 0, subscriptionId: s.id })
          // reason — 서포터즈 할인이면 화면이 "서포터즈 혜택으로 N원 할인"으로 말한다(정기배송 탭과 같은 말, 2026-10-09).
          chargePreview[s.id] = { chargeAmount: d.chargeAmount, label: d.label ?? null, reason: d.reason }
        } catch {
          /* 미리보기 실패 — 화면은 서포터즈 판정으로 대신 그린다 */
        }
      }),
  )

  // ★이번 박스 진행 상황(2026-10-01 B안) — 결제됐지만 아직 안 나간 박스(결제됨 + 발송 대기 주문)가 있으면
  //   화면이 '이번 박스'의 조리·발송 단계를 보여준다. 일반 고객은 발송 3일 전 토요일에 결제되므로
  //   토~화 사이에는 다음 결제일보다 이 박스가 궁금하다. 조회가 실패하면 단계만 '다음 박스' 기준으로 —
  //   돈·버튼과 무관한 표시라 화면을 멈추지 않는다.
  const liveIds = subsList.filter((s) => s.status !== 'cancelled').map((s) => s.id)
  const inProgress: Record<string, boolean> = {}
  // 그 박스의 결제 시각 — 발송일을 next_delivery_date 만으로 세면 결제 뒤 '2주 미루기'에 이번 박스가
  //   2주 늦게 나가는 것처럼 보인다(lib/shipping-schedule paidBoxShipIso, 2026-10-02).
  const inProgressPaidAt: Record<string, string> = {}
  // 보냈지만 아직 도착 전인 박스가 있나(배송 중) — '받은 박스' 수에서 뺀다.
  const inTransit: Record<string, boolean> = {}
  // 조회 실패 = 결제된 박스가 있는지 **모름** — 시트가 "그 사이 2주는 박스가 안 가요"를 단정하지 않게(10차 점검 D).
  let paidStateUnknown = false
  if (liveIds.length > 0) {
    const { data: prepRows, error: prepErr } = await supabase
      .from('orders')
      .select('subscription_id, paid_at, created_at, order_status')
      .in('subscription_id', liveIds)
      .in('payment_status', PAID_STATUSES)
      // 'shipping' = 보냈지만 아직 도착 전 — '받은 박스' 수에서 뺄 때만 쓴다(11차 점검 E).
      .in('order_status', ['preparing', 'shipping'])
      .order('created_at', { ascending: false })
    if (prepErr) {
      console.error('[dogs/subscription] 준비 중 박스 조회 실패:', prepErr.message)
      paidStateUnknown = true
    } else {
      for (const r of (prepRows ?? []) as Array<{
        subscription_id: string | null
        paid_at: string | null
        created_at: string
        order_status: string
      }>) {
        if (!r.subscription_id) continue
        if (r.order_status === 'shipping') {
          inTransit[r.subscription_id] = true
          continue
        }
        if (inProgress[r.subscription_id]) continue
        inProgress[r.subscription_id] = true
        inProgressPaidAt[r.subscription_id] = r.paid_at ?? r.created_at
      }
    }
  }

  // 결제 시점 — getTrialState 는 조회 실패를 '체험 아님'으로 접어 서포터즈에게 토요일 결제를 보여줄 수 있다.
  //   getChargeTiming 은 실패면 null(모름) → 화면이 결제 요일을 말하지 않는다(사장님 "정상가 전까지 알리지 마").
  const [trial, chargeTiming] = await Promise.all([getTrialState(user.id), getChargeTiming(user.id)])
  return (
    <DogSubscriptionClient
      initialSubs={subsList}
      dogName={dogName}
      dogPhoto={dogPhoto}
      startHref={startHref}
      trial={trial}
      // 결제 시점 정본(lib/shipping-schedule) — 서포터즈 체험 구간은 발송일(화), 그 외는 조리 직전 토요일. 모르면 null.
      chargeTiming={chargeTiming}
      inProgress={inProgress}
      inProgressPaidAt={inProgressPaidAt}
      inTransit={inTransit}
      paidStateUnknown={paidStateUnknown}
      chargePreview={chargePreview}
    />
  )
}
