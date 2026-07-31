// audit #101 — /dogs/[id]/order server wrapper. dog ownership + cycle 1
// dog_formulas + profile + 매핑된 products 를 server prefetch. 인증
// 미통과/소유 X → server redirect (이전: client loading spinner + flash).
//
// ★2026-07-31 — 데이터 준비를 `lib/subscription/orderPageData` 로 옮겼다.
//   웹에서도 구독 신청이 되게 만들면서(사장님 지시) 이 206줄을 복사하면
//   cycle 1 고정·알레르기 게이트·`?recipes=` 반영처럼 **과거에 실제로 사고가 났던
//   규칙들이 두 벌**이 된다. 한쪽만 고쳐지는 순간 그 사고가 그쪽에서 부활한다.
//   이 파일에는 **어디로 돌려보낼지(앱 목적지)만** 남는다.
import { redirect } from 'next/navigation'
import { loadOrderPageData } from '@/lib/subscription/orderPageData'
import OrderClient, { type OrderProduct } from './OrderClient'

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ fresh?: string; recipes?: string }>
}) {
  const { id: dogId } = await params
  const sp = await searchParams
  const data = await loadOrderPageData(dogId, sp)

  if (!data.ok) {
    if (data.reason === 'unauthenticated') {
      redirect(`/login?next=/dogs/${dogId}/order`)
    }
    if (data.reason === 'dog_not_found') {
      redirect('/dogs')
    }
    // 알레르기 상담 필요 — 분석 페이지의 상담 안내(카톡 문의)로.
    redirect(`/dogs/${dogId}/analysis`)
  }

  return (
    <OrderClient
      dogId={dogId}
      userId={data.userId}
      dogName={data.dogName}
      formula={data.formula}
      products={data.products as Record<string, OrderProduct>}
      profile={data.profile}
      initialFresh={data.initialFresh}
      pickedRecipes={data.pickedRecipes}
    />
  )
}
