import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { dbError } from '@/lib/api/errors'
import type { Formula } from '@/lib/personalization/types'
import { LINE_TO_SLUG, TOPPER_TO_SLUG } from '@/lib/personalization/skuMap'
import {
  priceForFormula,
  type BoxProduct,
} from '@/lib/personalization/boxPricing'
import { subscriptionState, type SubLike } from '@/lib/subscription-state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/personalization/approve
 *
 * 보호자가 cron 이 만든 pending_approval formula 에 응답. push/email 의 deep
 * link 가 이 화면으로 데려옴.
 *
 *  - approve: status=approved, approved_at=now, applied_from=오늘, applied_until=+28일
 *             **+ subscriptions.total_amount 를 새 처방 금액으로 갱신**
 *  - decline: status=declined. 이전 cycle 의 applied_until 을 +28일 연장 (현행 유지).
 *             금액도 그대로 — 유지를 골랐으니 청구도 유지.
 *
 * 만 5일 응답 없으면 별도 cron 이 declined 로 timeout (= 금액도 그대로).
 *
 * # 금액 갱신 (2026-07-17 · 사장님 "처방 → 가격 연동")
 * 이전엔 처방을 승인해도 청구액이 안 바뀌었다 — 포장량만 처방을 따라가고
 * `total_amount` 는 가입 시 값으로 고정 = **개인화된 양을 보내며 고정 금액을
 * 받는 상태**(마진 누수 / 감량견은 과지불).
 *
 * ⚠️ **금액은 반드시 서버가 정본(`boxPricing`)으로 재계산한다.** 클라이언트가
 * 보낸 금액을 믿으면 조작으로 청구액을 낮출 수 있다 — 이 라우트는 돈에 닿는다.
 * 승인 화면이 보여준 금액과 같은 함수·같은 입력이라 값도 일치한다.
 */

const zApprove = z.object({
  dogId: z.string().uuid(),
  cycleNumber: z.number().int().min(1).max(120),
  decision: z.enum(['approve', 'decline']),
})

export async function POST(req: Request) {
  const rl = rateLimit({
    bucket: 'personalization-approve',
    key: ipFromRequest(req),
    limit: 10,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rl.headers },
    )
  }

  const parsed = await parseRequest(req, zApprove)
  if (!parsed.ok) return parsed.response
  const { dogId, cycleNumber, decision } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
      { status: 401 },
    )
  }

  // pending formula 확인. (금액 재산정에 formula 본체가 필요 — id 만으론 부족.)
  // dog_formulas 는 generated types 에 일부 컬럼이 없어 select 확장 시 추론이
  // GenericStringError 로 무너진다 → 저장소 관례대로 unknown 경유 캐스팅.
  type PendingRow = {
    id: string
    approval_status: string
    formula: { lineRatios: Formula['lineRatios']; toppers: Formula['toppers'] }
    daily_kcal: number
  }
  const { data: pendingRaw, error: fetchErr } = await supabase
    .from('dog_formulas')
    .select('id, approval_status, formula, daily_kcal')
    .eq('dog_id', dogId)
    .eq('user_id', user.id)
    .eq('cycle_number', cycleNumber)
    .maybeSingle()
  if (fetchErr || !pendingRaw) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '해당 cycle 처방을 찾을 수 없어요' },
      { status: 404 },
    )
  }
  const pending = pendingRaw as unknown as PendingRow

  const status = pending.approval_status
  if (status !== 'pending_approval') {
    return NextResponse.json(
      {
        code: 'NOT_PENDING',
        message: `이미 ${status} 상태입니다`,
      },
      { status: 409 },
    )
  }

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const plus28 = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  if (decision === 'approve') {
    // 금액을 **먼저** 계산한다 — 처방만 승인되고 금액 갱신이 실패하면
    // '새 박스 + 옛 금액' 으로 갈라진다. 계산이 불가능하면(구독 없음·화식비율
    // 미상·제품 없음) 금액은 건드리지 않는다(돈은 추측하지 않는다).
    const newTotal = await priceForApproved(supabase, dogId, pending)

    const { error } = await supabase
      .from('dog_formulas')
      .update({
        approval_status: 'approved',
        approved_at: now.toISOString(),
        applied_from: today,
        applied_until: plus28,
      })
      .eq('id', pending.id)

    if (error) {
      return dbError(error, 'personalization_approve', '확정에 실패했어요')
    }

    // 보호자가 금액을 보고 승인했으므로 청구액을 새 처방 기준으로 갱신.
    // (승인 화면이 보여준 값과 같은 함수·같은 입력 → 값 일치.)
    let priceUpdated = false
    if (newTotal != null) {
      const { error: priceErr } = await supabase
        .from('subscriptions')
        .update({ total_amount: newTotal })
        .eq('dog_id', dogId)
        .eq('user_id', user.id)
      if (priceErr) {
        // 처방은 이미 승인됨 → 금액만 옛 값으로 남는다(= 우리가 원가 흡수,
        // 고객에게 불리하지 않은 방향). 조용히 넘기지 말고 남긴다.
        console.error(
          '[personalization/approve] total_amount 갱신 실패 — 새 처방·옛 금액 상태:',
          priceErr.message,
        )
      } else {
        priceUpdated = true
      }
    }

    return NextResponse.json({ ok: true, decision: 'approved', priceUpdated })
  }

  // decline — 이전 cycle 처방의 applied_until 을 +28일 연장.
  const { error: declineErr } = await supabase
    .from('dog_formulas')
    .update({
      approval_status: 'declined',
      approved_at: null,
    })
    .eq('id', pending.id)
  if (declineErr) {
    // audit #69: 원본 DB message 클라이언트 노출 제거 — 서버 로그만(2026-06-20).
    console.error('[personalization/approve] decline db error:', declineErr.message)
    return NextResponse.json(
      { code: 'DB_ERROR', message: '처리하지 못했어요' },
      { status: 500 },
    )
  }

  // 이전 cycle (cycleNumber - 1) 의 applied_until 연장.
  if (cycleNumber > 1) {
    const { data: prev } = await supabase
      .from('dog_formulas')
      .select('id, applied_until')
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      .eq('cycle_number', cycleNumber - 1)
      .maybeSingle()
    if (prev) {
      const prevUntil =
        (prev as { applied_until: string | null }).applied_until ?? today
      const extended = new Date(
        new Date(prevUntil).getTime() + 28 * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .slice(0, 10)
      await supabase
        .from('dog_formulas')
        .update({ applied_until: extended })
        .eq('id', (prev as { id: string }).id)
    }
  }

  return NextResponse.json({ ok: true, decision: 'declined' })
}

/**
 * 승인된 처방의 2주 청구액을 **서버에서** 재계산.
 *
 * 클라이언트가 보낸 금액은 절대 쓰지 않는다(조작 시 청구액을 마음대로 낮출 수
 * 있다). 계산은 `boxPricing` 정본 — 주문 화면·승인 화면과 같은 함수라 값이
 * 갈라지지 않는다.
 *
 * @returns 새 금액. 판단 근거가 하나라도 없으면 **null** = 금액 미변경.
 */
async function priceForApproved(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dogId: string,
  row: {
    formula: { lineRatios: Formula['lineRatios']; toppers: Formula['toppers'] }
    daily_kcal: number
  },
): Promise<number | null> {
  const { data: subRow } = await supabase
    .from('subscriptions')
    .select(
      'fresh_ratio, total_amount, status, billing_key, next_delivery_date, ' +
        'failed_charge_count, requires_billing_key_renewal',
    )
    .eq('dog_id', dogId)
    .maybeSingle()
  if (!subRow) return null
  const sub = subRow as unknown as SubLike & {
    fresh_ratio: number | null
    total_amount: number
  }
  // 진행 중인 구독이 아니면 청구 기준이 없다.
  if (subscriptionState(sub) !== 'active') return null
  if (sub.fresh_ratio == null || sub.fresh_ratio <= 0) return null

  const allSlugs = [
    ...Object.values(LINE_TO_SLUG).filter((s): s is string => s !== null),
    ...Object.values(TOPPER_TO_SLUG),
  ]
  const { data: prodList } = await supabase
    .from('products')
    .select('slug, price, sale_price, stock, is_subscribable, nutrition_facts')
    .in('slug', allSlugs)
    .eq('is_active', true)
  const products: Record<string, BoxProduct> = {}
  for (const p of ((prodList ?? []) as unknown) as BoxProduct[]) {
    products[p.slug] = p
  }
  if (Object.keys(products).length === 0) return null

  const { total } = priceForFormula({
    formula: {
      lineRatios: row.formula.lineRatios,
      toppers: row.formula.toppers,
      dailyKcal: row.daily_kcal,
    },
    freshRatio: sub.fresh_ratio,
    products,
  })
  // 0원/음수가 나오면 계산이 깨진 것 — 청구액을 망가뜨리느니 그대로 둔다.
  if (!(total > 0)) return null
  return total
}
