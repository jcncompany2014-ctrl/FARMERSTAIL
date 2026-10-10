import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isAppContextServer } from '@/lib/app-context'

/**
 * /account/subscribe/[dogId] — 예전 **웹 정기배송 신청** 주소(2026-07-31 ~ 2026-10-10).
 *
 * 2026-10-10 웹 리뉴얼(기획서 D2, 사장님 "기획서대로"): 웹은 단품 가게, 맞춤·정기배송 신청은 앱에서만 한다.
 * 그래서 이 주소는 더 그리지 않고 보낸다 —
 *   · 웹 → 앱 소개(/app): 앱을 깔아 같은 계정으로 들어가면 우리 아이·설문이 그대로 있다.
 *   · 앱 안(옛 링크·북마크) → 앱의 같은 화면(/dogs/[id]/order).
 * 신청 화면(OrderClient)은 앱 화면 하나만 남는다 — 금액 계산·주소·카드 창이 한 곳에만 산다.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '정기배송 신청',
  robots: { index: false, follow: false },
}

export default async function WebSubscribePage({ params }: { params: Promise<{ dogId: string }> }) {
  const { dogId } = await params
  if (await isAppContextServer()) redirect(`/dogs/${encodeURIComponent(dogId)}/order`)
  redirect('/app')
}
