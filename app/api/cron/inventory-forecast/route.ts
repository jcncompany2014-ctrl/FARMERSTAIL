/**
 * /api/cron/inventory-forecast — R39d (#24).
 *
 * 정기구독 demand 기반 재고 예측. 매일 1회 실행:
 *   1) 활성 정기구독자의 next_delivery_date + mix_ratio + 일일 g 합산
 *   2) 향후 7/14/30일 동안 SKU 별 필요량 계산
 *   3) products.stock 과 비교 → 부족 SKU 식별
 *   4) Sentry breadcrumb + admin 이메일 (NEXT_PUBLIC_ADMIN_EMAIL)
 *
 * 솔로 운영자 의존도 ↓ — 매일 자동 점검으로 품절 직전 알림.
 *
 * # 보안
 * isAuthorizedCronRequest (Bearer CRON_SECRET) 검증.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { captureBusinessEvent } from '@/lib/sentry/trace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SubscriptionRow {
  id: string
  status: string | null
  next_delivery_date: string | null
  total_amount: number | null
}

interface SubItemRow {
  subscription_id: string
  product_id: string
  quantity: number | null
}

interface ProductRow {
  id: string
  name: string | null
  stock: number | null
  net_weight_g: number | null
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  // R83-E3 (D3): trackCron wrap.
  return trackCron('inventory-forecast', async () => {
    const supabase = createAdminClient()

  // 1) 활성 정기구독 list + items 한 번에.
  const { data: subsRaw } = await supabase
    .from('subscriptions')
    .select('id, status, next_delivery_date, total_amount')
    .eq('status', 'active')
    .limit(1000)
  const subs = (subsRaw ?? []) as SubscriptionRow[]
  if (subs.length === 0) {
    return NextResponse.json({ ok: true, message: 'no active subs' })
  }

  const subIds = subs.map((s) => s.id)
  const { data: itemsRaw } = await supabase
    .from('subscription_items')
    .select('subscription_id, product_id, quantity')
    .in('subscription_id', subIds)
  const items = (itemsRaw ?? []) as SubItemRow[]

  const productIds = Array.from(new Set(items.map((i) => i.product_id)))
  const { data: productsRaw } = await supabase
    .from('products')
    .select('id, name, stock, net_weight_g')
    .in('id', productIds)
  const products = (productsRaw ?? []) as ProductRow[]
  const prodById = new Map(products.map((p) => [p.id, p]))

  // 2) 평균 결제 주기 (정기구독 — 보통 30일). 단순 모델: N 일 안에 결제될 sub 수 ×
  // items quantity 합산. 향후 subscription.delivery_interval_days 컬럼 추가 시 정확화.
  const horizons = [7, 14, 30] as const
  const demand: Record<number, Record<string, number>> = { 7: {}, 14: {}, 30: {} }

  const todayMs = Date.now()
  for (const sub of subs) {
    if (!sub.next_delivery_date) continue
    const nextMs = new Date(sub.next_delivery_date).getTime()
    if (Number.isNaN(nextMs)) continue
    const daysUntil = Math.ceil((nextMs - todayMs) / 86_400_000)
    if (daysUntil < 0) continue // 이미 지난 결제일은 별도

    for (const horizon of horizons) {
      if (daysUntil > horizon) continue
      const subItems = items.filter((i) => i.subscription_id === sub.id)
      for (const it of subItems) {
        const qty = it.quantity ?? 0
        demand[horizon]![it.product_id] =
          (demand[horizon]![it.product_id] ?? 0) + qty
      }
    }
  }

  // 3) 부족 SKU 식별 — stock < demand_30
  const shortages: Array<{
    productId: string
    name: string
    stock: number
    demand7: number
    demand14: number
    demand30: number
  }> = []
  for (const pid of productIds) {
    const p = prodById.get(pid)
    if (!p) continue
    const stock = p.stock ?? 0
    const d30 = demand[30]![pid] ?? 0
    if (stock < d30) {
      shortages.push({
        productId: pid,
        name: p.name ?? '(이름 없음)',
        stock,
        demand7: demand[7]![pid] ?? 0,
        demand14: demand[14]![pid] ?? 0,
        demand30: d30,
      })
    }
  }

  // 4) Sentry 이벤트 + (admin 이메일 발송은 후속 phase — notifyAdminLowStock helper).
  if (shortages.length > 0) {
    captureBusinessEvent('warning', 'inventory.shortage_forecast', {
      shortageCount: shortages.length,
      // payload 크기 제한 — top 10 shortage summary (JSON 문자열로 cast).
      shortagesPreview: JSON.stringify(shortages.slice(0, 10)),
    })
  } else {
    captureBusinessEvent('info', 'inventory.forecast_ok', {
      activeSubscriptions: subs.length,
      productsChecked: products.length,
    })
  }

    return NextResponse.json({
      ok: true,
      activeSubscriptions: subs.length,
      productsChecked: products.length,
      shortageCount: shortages.length,
      shortages,
    })
  })
}
