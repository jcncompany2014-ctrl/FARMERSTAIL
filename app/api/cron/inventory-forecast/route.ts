/**
 * /api/cron/inventory-forecast — R39d (#24).
 *
 * 정기구독 demand 기반 재고 예측. 매일 1회 실행:
 *   1) 활성 정기구독자의 next_delivery_date(발송일) + 결제됐고 아직 안 나간 박스(결제됨 + 발송 대기
 *      주문 — 2026-10-01 토요일 결제 도입으로 토~화엔 next_delivery_date 가 이미 다음 주기다)
 *   2) 향후 7/14/30일(발송일 기준) 동안 SKU 별 필요량 계산
 *   3) products.stock 과 비교 → 부족 SKU 식별
 *   4) Sentry 이벤트로 기록 (captureBusinessEvent). 별도 직접 메일 발송은
 *      안 한다 — 재고 부족 자체는 **ops-digest 가 products 를 직접 조회해**
 *      매일 메일에 싣는다(2026-08-08).
 *
 *      ⚠️ 그 전까지 이 주석은 "ops-digest 가 보낸다" 고만 적혀 있었고
 *      **ops-digest 는 재고를 보고 있지 않았다** — 이 크론은 200 + Sentry
 *      이벤트만 남기므로 trackCron 은 success 로 적고, Sentry 알림 룰이
 *      없으면 품절이 사장님에게 도달하는 경로가 0 이었다(규칙4).
 *      여기서 계산한 **예측**(향후 7/14/30일 부족)은 여전히 Sentry 전용이다 —
 *      메일에 실리는 건 현재 재고 수준이다.
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
import { PAID_STATUSES } from '@/lib/commerce/paid-status'
import { diffDaysKst, todayKstIsoDate } from '@/lib/datetime-kst'
import { paidBoxShipIso } from '@/lib/shipping-schedule'

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

/** 결제됐고 아직 안 나간 정기배송 박스(결제됨 + 발송 대기 주문). 품목은 결제 때 확정된 order_items. */
interface PaidBoxRow {
  id: string
  subscription_id: string | null
  paid_at: string | null
  created_at: string
  order_items: Array<{ product_id: string | null; quantity: number | null }> | null
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  // R83-E3 (D3): trackCron wrap.
  return trackCron('inventory-forecast', async () => {
    const supabase = createAdminClient()

  // 1) 활성 정기구독 list + items 한 번에.
  const { data: subsRaw, error: subsRawErr } = await supabase
    .from('subscriptions')
    .select('id, status, next_delivery_date, total_amount')
    .eq('status', 'active')
    .limit(1000)
  // 조회 실패를 0건으로 접지 않는다(2026-08-05 · 규칙1) — 접히면 "대상 없음"이
  // 되어 크론은 초록인데 아무 일도 안 한 것이 정상으로 기록된다.
  if (subsRawErr) {
    console.error('[inventory-forecast] 구독 목록 조회 실패:', subsRawErr.message)
    return NextResponse.json(
      { ok: false, reason: 'lookup_failed', at: 'subsRaw', error: subsRawErr.message },
      { status: 500 },
    )
  }
  const subs = (subsRaw ?? []) as SubscriptionRow[]

  // 1-b) 결제됐고 아직 안 나간 박스 (2026-10-01 일정 변경 — 토·일 조리 → 월 포장 → 화 발송).
  //   일반 고객은 토요일에 결제되고 청구 크론이 그 즉시 next_delivery_date 를 다음 주기(+14)로 민다.
  //   그래서 토~화엔 조리·포장 중인 박스가 위 구독 목록의 날짜로는 안 잡혔다(그 주 수요가 통째로 빠짐).
  //   결제 증거(결제됨 + 발송 대기 주문)를 따로 읽어 그 박스의 발송 주에 넣는다. 해지·정지된 구독의
  //   결제 박스도 나가므로 구독 상태와 무관하게 읽는다. 품목은 결제 때 확정된 order_items 를 쓴다.
  const { data: paidRaw, error: paidRawErr } = await supabase
    .from('orders')
    .select('id, subscription_id, paid_at, created_at, order_items(product_id, quantity)')
    .in('payment_status', [...PAID_STATUSES])
    .eq('order_status', 'preparing')
    .not('subscription_id', 'is', null)
    .limit(1000)
  if (paidRawErr) {
    console.error('[inventory-forecast] 결제된 박스 조회 실패:', paidRawErr.message)
    return NextResponse.json(
      { ok: false, reason: 'lookup_failed', at: 'paidRaw', error: paidRawErr.message },
      { status: 500 },
    )
  }
  const paidBoxes = (paidRaw ?? []) as unknown as PaidBoxRow[]

  if (subs.length === 0 && paidBoxes.length === 0) {
    return NextResponse.json({ ok: true, message: 'no active subs' })
  }

  // 결제된 박스의 발송일을 따지려면 그 구독의 지금 next_delivery_date 가 필요하다(목록 밖 = 정지·해지).
  const nextBySub = new Map<string, string | null>(subs.map((s) => [s.id, s.next_delivery_date]))
  const missingSubIds = [
    ...new Set(
      paidBoxes
        .map((o) => o.subscription_id)
        .filter((x): x is string => !!x && !nextBySub.has(x)),
    ),
  ]
  if (missingSubIds.length > 0) {
    const { data: moreSubs, error: moreSubsErr } = await supabase
      .from('subscriptions')
      .select('id, next_delivery_date')
      .in('id', missingSubIds)
    if (moreSubsErr) {
      console.error('[inventory-forecast] 결제된 박스의 구독 조회 실패:', moreSubsErr.message)
      return NextResponse.json(
        { ok: false, reason: 'lookup_failed', at: 'paidSubs', error: moreSubsErr.message },
        { status: 500 },
      )
    }
    for (const s of (moreSubs ?? []) as Array<{ id: string; next_delivery_date: string | null }>) {
      nextBySub.set(s.id, s.next_delivery_date)
    }
  }

  const subIds = subs.map((s) => s.id)
  let items: SubItemRow[] = []
  if (subIds.length > 0) {
    const { data: itemsRaw, error: itemsRawErr } = await supabase
      .from('subscription_items')
      .select('subscription_id, product_id, quantity')
      .in('subscription_id', subIds)
    // 조회 실패를 0건으로 접지 않는다(2026-08-05 · 규칙1) — 접히면 "대상 없음"이
    // 되어 크론은 초록인데 아무 일도 안 한 것이 정상으로 기록된다.
    if (itemsRawErr) {
      console.error('[inventory-forecast] 구독 품목 조회 실패:', itemsRawErr.message)
      return NextResponse.json(
        { ok: false, reason: 'lookup_failed', at: 'itemsRaw', error: itemsRawErr.message },
        { status: 500 },
      )
    }
    items = (itemsRaw ?? []) as SubItemRow[]
  }

  const productIds = Array.from(
    new Set([
      ...items.map((i) => i.product_id),
      ...paidBoxes.flatMap((o) =>
        (o.order_items ?? []).map((i) => i.product_id).filter((x): x is string => !!x),
      ),
    ]),
  )
  const { data: productsRaw, error: productsRawErr } = await supabase
    .from('products')
    .select('id, name, stock, net_weight_g')
    .in('id', productIds)
  // 조회 실패를 0건으로 접지 않는다(2026-08-05 · 규칙1) — 접히면 "대상 없음"이
  // 되어 크론은 초록인데 아무 일도 안 한 것이 정상으로 기록된다.
  if (productsRawErr) {
    console.error('[inventory-forecast] 제품 조회 실패:', productsRawErr.message)
    return NextResponse.json(
      { ok: false, reason: 'lookup_failed', at: 'productsRaw', error: productsRawErr.message },
      { status: 500 },
    )
  }
  const products = (productsRaw ?? []) as ProductRow[]
  const prodById = new Map(products.map((p) => [p.id, p]))

  // 2) 단순 모델: N 일 안에 **발송될** 박스 × 품목 수량 합산. 구독은 다음 발송일 한 회차만 센다
  //    (2주 주기의 뒤 회차는 아직 안 센다 — 30일 창에선 과소 추정이라는 걸 알고 쓴다).
  //    날짜는 KST 달력 날짜로 센다(서버는 UTC).
  const horizons = [7, 14, 30] as const
  const demand: Record<number, Record<string, number>> = { 7: {}, 14: {}, 30: {} }
  const addDemand = (daysUntil: number, productId: string, qty: number) => {
    for (const horizon of horizons) {
      if (daysUntil > horizon) continue
      demand[horizon]![productId] = (demand[horizon]![productId] ?? 0) + qty
    }
  }
  const today = todayKstIsoDate()

  // 2-a) 결제된 박스 — 그 박스의 발송일 기준. 발송일이 지났는데 안 나간 박스도 아직 싸야 하므로 '지금'(0일)으로 센다.
  const paidShipKeys = new Set<string>()
  for (const o of paidBoxes) {
    const ship = paidBoxShipIso(
      o.subscription_id ? (nextBySub.get(o.subscription_id) ?? null) : null,
      o.paid_at ?? o.created_at,
    )
    if (o.subscription_id) paidShipKeys.add(`${o.subscription_id}|${ship}`)
    const daysUntil = Math.max(0, diffDaysKst(ship, today))
    for (const it of o.order_items ?? []) {
      if (!it.product_id) continue
      addDemand(daysUntil, it.product_id, it.quantity ?? 0)
    }
  }

  // 2-b) 결제 전 구독 — 다음 발송일 기준.
  for (const sub of subs) {
    if (!sub.next_delivery_date) continue
    const next = sub.next_delivery_date.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) continue
    // ★이중 계산 방지: 결제는 됐는데 청구 크론의 날짜 밀기가 실패해 next_delivery_date 가 그 박스의
    //   발송일에 남은 구독은 2-a 에서 이미 셌다.
    if (paidShipKeys.has(`${sub.id}|${next}`)) continue
    const daysUntil = diffDaysKst(next, today)
    if (daysUntil < 0) continue // 이미 지난 발송일(결제 실패·재시도 중)은 별도

    for (const it of items) {
      if (it.subscription_id !== sub.id) continue
      addDemand(daysUntil, it.product_id, it.quantity ?? 0)
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
      paidBoxesPending: paidBoxes.length,
      productsChecked: products.length,
      shortageCount: shortages.length,
      shortages,
    })
  })
}
