/**
 * 정기배송 관리 화면 공용 타입.
 *
 * 2026-07-16 — 옛 app (main)/mypage/subscriptions 디자인을 삭제하면서(사장님 "거지같은
 * 옛날 디자인 삭제"), 그 파일이 export 하던 Subscription 타입을 살아남는 소비처
 * (/account/subscriptions)로 옮겼다. 옛 리스트 UI 는 /account/subscriptions 로 일원화.
 */

type SubscriptionItem = {
  product_name: string
  product_image_url: string | null
  quantity: number
  unit_price: number
}

export type Subscription = {
  id: string
  status: 'active' | 'paused' | 'cancelled'
  interval_weeks: number
  coverage_weeks: number | null
  /** 화식 비율 티어 (30/60/100). 레거시 구독은 null. */
  fresh_ratio: number | null
  next_delivery_date: string | null
  last_delivery_date: string | null
  total_deliveries: number
  subtotal: number
  shipping_fee: number
  total_amount: number
  recipient_name: string | null
  created_at: string
  reminder_enabled: boolean
  reminder_days_before: number
  dog_id: string | null
  dogs: { id: string; name: string } | null
  subscription_items: SubscriptionItem[]
  billing_card_brand: string | null
  billing_card_last4: string | null
  billing_customer_key: string | null
  failed_charge_count: number
  last_failed_charge_at: string | null
  last_failed_charge_reason: string | null
  last_failed_charge_code: string | null
  next_retry_at: string | null
  requires_billing_key_renewal: boolean
}
