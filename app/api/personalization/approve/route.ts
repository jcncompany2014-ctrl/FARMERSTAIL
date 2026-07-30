import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { dbError } from '@/lib/api/errors'
import type { Formula } from '@/lib/personalization/types'
import { LINE_TO_SLUG, TOPPER_TO_SLUG } from '@/lib/personalization/skuMap'
import {
  computeBoxItems,
  priceForFormula,
  subscribableItems,
} from '@/lib/personalization/boxPricing'
import {
  subscriptionItemRows,
  type ItemProduct,
  type SubscriptionItemRow,
} from '@/lib/personalization/subscriptionItems'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureBusinessEvent } from '@/lib/sentry/trace'

/** 승인된 처방으로 계산한 청구액 + 박스 스냅샷. 둘이 같은 계산에서 나온다. */
type ApprovedBox = {
  subscriptionId: string
  total: number
  itemRows: SubscriptionItemRow[]
}
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

  // ★최종감사 #6 (2026-07-29): 상담 필요(needsConsultation) 처방은 고객
  //   승인으로 적용될 수 없다. 예전엔 approval_status 만 봐서, 알레르기 누출로
  //   상담 라우팅된 처방을 고객이 승인 화면·금액동의 모달에서 [동의] 탭 한 번에
  //   approved 로 만들 수 있었다 — 그 순간 피킹 리스트가 알레르겐 포함 박스를
  //   포장한다. 서버에서 원천 차단한다(화면 분기는 늦게 따라올 수 있으므로
  //   여기가 진짜 게이트다). 거절(decline)은 허용 — 이전 처방 유지는 안전 판단을
  //   바꾸지 않고, 구독은 누출 감지 시점에 이미 일시정지돼 있다.
  const consultationNeeded =
    (pending.formula as { needsConsultation?: boolean } | null)
      ?.needsConsultation === true
  if (consultationNeeded && decision === 'approve') {
    return NextResponse.json(
      {
        code: 'CONSULTATION_REQUIRED',
        message:
          '알려주신 알레르기 때문에 이 구성은 그대로 시작할 수 없어요. 함께 안전한 방법을 찾아드릴게요 — 카카오톡으로 문의해 주세요.',
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
    const box = await boxForApproved(supabase, dogId, pending)

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
    let itemsUpdated = false
    if (box) {
      /**
       * ★★ 쓰기는 service_role 로 한다 — 로그인 클라이언트로는 **저장이 안 된다**
       * (2026-07-31 점검에서 발견). 20260730000000 이 subscriptions UPDATE 를
       * 4칸 화이트리스트로 잠갔고 `total_amount` 는 그 밖이다(실측:
       * has_column_privilege = false). 그래서 이 갱신은 권한 오류로 실패하고,
       * 아래 분기가 로그만 남긴 채 **새 처방에 옛 금액**이 그대로 남았다.
       * 소유권은 위 pending 조회(user_id 로 걸러진 것)가 이미 책임진다.
       */
      const admin = createAdminClient()
      // ★ 구독 **id** 로 갱신한다. 예전엔 `.eq('dog_id', ...)` 라서 같은 강아지의
      //   **해지된 구독까지** 새 금액으로 덮어썼다(과거 원장 오염).
      const { error: priceErr } = await admin
        .from('subscriptions')
        .update({ total_amount: box.total })
        .eq('id', box.subscriptionId)
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

      /**
       * ★ 박스 스냅샷(subscription_items) 을 새 처방으로 다시 만든다 (2026-07-30).
       *
       * 이 표는 여태 **insert 만 있고 update 가 없었다.** 그래서 승인 후
       *   · 실제 포장(피킹) = 새 처방 ✔   · 청구액 = 새 금액 ✔
       *   · 화면 9곳 + 주문내역(order_items) = **옛 레시피** ✘
       * 였다. 고객은 닭고기를 승인하고 닭고기 값을 내고 닭고기를 받는데
       * 주문내역엔 소고기가 적혀 있었다.
       *
       * 쓰기는 **service_role** 로 한다 — 박스 내용은 서버가 소유한다
       * (unit_price 가 order_items 로 복사되는 값이라 고객이 쓸 수 있으면 주문
       * 원장이 조작된다. 20260730000300 마이그레이션이 UPDATE/DELETE 를 회수했다).
       * 소유권은 위에서 이미 검증됐다(pending 조회가 user_id 로 걸러진다).
       *
       * 지우고 다시 넣는다 — 라인 구성 자체가 바뀌므로(단백질 교체·토퍼 추가)
       * 행 단위 upsert 로는 없어진 라인이 남는다.
       */
      const { error: delErr } = await admin
        .from('subscription_items')
        .delete()
        .eq('subscription_id', box.subscriptionId)
      if (delErr) {
        console.error(
          '[personalization/approve] 옛 품목 삭제 실패 — 화면이 옛 레시피에 머문다:',
          delErr.message,
        )
      } else if (box.itemRows.length > 0) {
        const { error: insErr } = await admin
          .from('subscription_items')
          .insert(box.itemRows)
        if (insErr) {
          // 지우기는 됐고 넣기가 실패 = 품목 0개. 청구는 total_amount 로 되지만
          // 발송 운영이 무엇을 담을지 모른다 → 반드시 사람이 봐야 한다.
          captureBusinessEvent('error', 'subscription.items.rebuild_failed', {
            subscriptionId: box.subscriptionId,
            dogId,
            dbError: insErr.message,
          })
        } else {
          itemsUpdated = true
        }
      }
    }

    return NextResponse.json({
      ok: true,
      decision: 'approved',
      priceUpdated,
      itemsUpdated,
    })
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
async function boxForApproved(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dogId: string,
  row: {
    formula: { lineRatios: Formula['lineRatios']; toppers: Formula['toppers'] }
    daily_kcal: number
  },
): Promise<ApprovedBox | null> {
  // ★ maybeSingle() 을 쓰지 않는다 (2026-07-30 수정).
  // `.eq('dog_id', ...)` 는 **해지 이력까지** 걸린다 — 한 번 해지하고 다시
  // 신청한 강아지는 행이 2~3개다(프로덕션 실측: 그런 강아지가 이미 2마리).
  // maybeSingle() 은 그 경우 오류를 돌려주고, 여기선 error 를 안 받고 있어서
  // **금액이 조용히 안 바뀌었다.** 진행 중인 것 하나를 명시적으로 고른다.
  const { data: subRows, error: subErr } = await supabase
    .from('subscriptions')
    .select(
      'id, fresh_ratio, total_amount, status, billing_key, next_delivery_date, ' +
        'failed_charge_count, requires_billing_key_renewal',
    )
    .eq('dog_id', dogId)
    .in('status', ['active', 'paused'])
    .order('created_at', { ascending: false })
    .limit(1)
  if (subErr) {
    console.error('[personalization/approve] 구독 조회 실패:', subErr.message)
    return null
  }
  const subRow = (subRows ?? [])[0]
  if (!subRow) return null
  const sub = subRow as unknown as SubLike & {
    id: string
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
  // id·name·image_url 을 함께 받는다 — subscription_items 행을 다시 만들 때 쓴다.
  const { data: prodList, error: prodErr } = await supabase
    .from('products')
    .select(
      'id, name, image_url, slug, price, sale_price, stock, is_subscribable, nutrition_facts',
    )
    .in('slug', allSlugs)
    .eq('is_active', true)
  if (prodErr) {
    console.error('[personalization/approve] 제품 조회 실패:', prodErr.message)
    return null
  }
  const products: Record<string, ItemProduct> = {}
  for (const p of ((prodList ?? []) as unknown) as ItemProduct[]) {
    products[p.slug] = p
  }
  if (Object.keys(products).length === 0) return null

  const input = {
    formula: {
      lineRatios: row.formula.lineRatios,
      toppers: row.formula.toppers,
      dailyKcal: row.daily_kcal,
    },
    freshRatio: sub.fresh_ratio,
    products,
  }
  const { total } = priceForFormula(input)
  // 0원/음수가 나오면 계산이 깨진 것 — 청구액을 망가뜨리느니 그대로 둔다.
  if (!(total > 0)) return null

  // 같은 입력으로 품목도 만든다 — 금액과 내용물이 같은 계산에서 나와야 한다.
  const items = subscribableItems(computeBoxItems(input))
  return {
    subscriptionId: sub.id,
    total,
    itemRows: subscriptionItemRows(sub.id, items),
  }
}
