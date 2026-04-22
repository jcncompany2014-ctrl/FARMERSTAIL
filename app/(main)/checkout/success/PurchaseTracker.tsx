'use client'

/**
 * GA4/Meta Pixel `purchase` 이벤트 트리거.
 *
 * Success 페이지는 서버 컴포넌트 — useEffect를 쓸 수 없어 dedicated
 * client component로 쪼갰다. idempotent하게 동작해야 함:
 *   • 같은 transaction_id로 중복 이벤트가 전송되면 GA는 합산하지 않음
 *     → sessionStorage guard로 1회만 fire.
 *   • 가상계좌(입금 대기) 주문은 실제 결제 완료가 아니므로 여기서
 *     purchase 이벤트를 쏘지 않는다. 입금 웹훅 이후 재방문 시에도
 *     쏠 수 없는데, 그건 서버 사이드 측정 프로토콜의 영역 — 현재
 *     MVP 범위에선 카드 결제만 track.
 */
import { useEffect } from 'react'
import { trackPurchase, type AnalyticsItem } from '@/lib/analytics'

type Props = {
  transactionId: string
  value: number
  items: AnalyticsItem[]
  shipping?: number
  coupon?: string | null
}

export default function PurchaseTracker({
  transactionId,
  value,
  items,
  shipping,
  coupon,
}: Props) {
  useEffect(() => {
    const key = `ft-purchase-tracked-${transactionId}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      /* storage 차단된 경우 그냥 한 번 쏘고 진행 */
    }
    trackPurchase({ transactionId, value, items, shipping, coupon })
  }, [transactionId, value, items, shipping, coupon])

  return null
}
