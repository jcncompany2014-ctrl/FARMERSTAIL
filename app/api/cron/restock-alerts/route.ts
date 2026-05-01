import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { notifyRestock } from '@/lib/email'
import { captureBusinessEvent } from '@/lib/sentry/trace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/restock-alerts
 *
 * 매시간 또는 일 1회 실행. 재고가 0 → 양수 로 회복된 (product, variant)
 * 페어를 찾아 미통지 구독자에게 메일 + 푸시를 보낸다.
 *
 * 동선
 * ────
 * 1. restock_alerts 에서 notified_at IS NULL 인 (product_id, variant_id)
 *    distinct 쌍을 추출.
 * 2. 각 쌍에 대해:
 *    - variant_id 가 있으면 product_variants.stock 조회, 0 초과면 발송 트리거
 *    - variant_id 가 없으면 products.stock 조회, 0 초과면 발송 트리거
 * 3. notifyRestock 호출 — 내부에서 notified_at 일괄 업데이트, 메일+푸시 발송.
 *
 * 응답: { checked, dispatched, totalNotified }
 *
 * 보안: CRON_SECRET bearer.
 */

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }

  const admin = createAdminClient()

  // 1) 미통지 알림 — 어떤 (product, variant) 조합이 대기 중인지 distinct.
  const { data: pending, error: pendErr } = await admin
    .from('restock_alerts')
    .select('product_id, variant_id')
    .is('notified_at', null)

  if (pendErr) {
    return NextResponse.json(
      { code: 'QUERY_FAILED', message: pendErr.message },
      { status: 500 },
    )
  }

  // 중복 제거 — Set 키는 'productId|variantId' 직렬화.
  const pairs = new Map<
    string,
    { productId: string; variantId: string | null }
  >()
  for (const row of pending ?? []) {
    const key = `${row.product_id}|${row.variant_id ?? ''}`
    if (!pairs.has(key)) {
      pairs.set(key, {
        productId: row.product_id,
        variantId: row.variant_id ?? null,
      })
    }
  }

  if (pairs.size === 0) {
    return NextResponse.json({ ok: true, checked: 0, dispatched: 0, totalNotified: 0 })
  }

  // 2) 각 쌍의 현재 재고 확인 후 발송 트리거.
  let dispatched = 0
  let totalNotified = 0

  for (const { productId, variantId } of pairs.values()) {
    let stock = 0

    if (variantId) {
      const { data: v } = await admin
        .from('product_variants')
        .select('stock, is_active')
        .eq('id', variantId)
        .maybeSingle()
      // 비활성 variant 는 재고가 있어도 알림 안 보냄.
      if (!v || !v.is_active) continue
      stock = v.stock ?? 0
    } else {
      const { data: p } = await admin
        .from('products')
        .select('stock, is_active')
        .eq('id', productId)
        .maybeSingle()
      if (!p || !p.is_active) continue
      stock = p.stock ?? 0
    }

    if (stock <= 0) continue

    // 3) 발송 트리거 — notifyRestock 이 발송 + notified_at 갱신까지 함.
    // 발송 실패 시 notified_at 을 NULL 로 유지해 다음 cron 사이클이 자동 retry.
    // 단 영구 실패 (예: 상품 삭제) 는 일정 횟수 후 포기 — fail_count 컬럼이
    // 없어 in-memory 가 아닌 retry 한도 추적은 미구현. 운영자가 Sentry 알림으로
    // 수동 개입 가능.
    try {
      const result = await notifyRestock(admin, {
        productId,
        variantId,
      })
      dispatched += 1
      totalNotified += result.notified
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[cron/restock-alerts] notifyRestock failed', {
        productId,
        variantId,
        err: message,
      })
      // 매출 영향 가능성 (사용자가 보충 알림 받지 못해 재구매 누락) — Sentry
      // 운영 채널에 warning 으로 기록.
      captureBusinessEvent('warning', 'cron.restock_alerts.dispatch_failed', {
        productId,
        variantId,
        error: message,
      })
    }
  }

  return NextResponse.json({
    ok: true,
    checked: pairs.size,
    dispatched,
    totalNotified,
  })
}
