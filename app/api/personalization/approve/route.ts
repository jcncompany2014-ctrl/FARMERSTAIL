import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { dbError } from '@/lib/api/errors'
import type { Formula } from '@/lib/personalization/types'
import type { SubscriptionItemRow } from '@/lib/personalization/subscriptionItems'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureBusinessEvent } from '@/lib/sentry/trace'

/** 승인된 처방으로 계산한 청구액 + 박스 스냅샷. 둘이 같은 계산에서 나온다. */
type ApprovedBox = {
  subscriptionId: string
  total: number
  itemRows: SubscriptionItemRow[]
}
import { subscriptionState, type SubLike } from '@/lib/subscription-state'
import { quoteBox } from '@/lib/subscription/boxQuote'

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
    formula: {
      lineRatios: Formula['lineRatios']
      toppers: Formula['toppers']
      /**
       * 재제안 크론이 박아 둔 "이 금액으로 바뀝니다" 표식. 동의 모달이
       * 고객에게 보여준 값이 바로 `to` 다.
       */
      priceChange?: { from: number; to: number; forced: boolean }
    }
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

      // ★dog_formulas 쓰기는 service_role 로만(2026-08-05 보안 감사).
    //   daily_kcal 이 청구액에 **선형 비례**하는데(boxPricing: dailyG =
    //   ratio × dailyKcal ÷ kcalPer100g) 고객이 REST 로 직접 UPDATE 할 수
    //   있었다 — subscriptions·orders·profiles 를 컬럼 화이트리스트로 잠가도
    //   **그 칸에 들어갈 값을 만드는 테이블**이 열려 있으면 소용없다.
    //   청구 검문소도 같은 행을 재계산하므로 stored == recomputed 로 통과한다.
    //   소유권은 이 라우트가 위에서 이미 확인했고, 범위는 코드가 책임진다.
    /**
     * ★CAS — pending_approval 인 행만 전이시킨다 (2026-08-08 동시성 감사).
     *
     * 위 pending 검사(SELECT)와 이 UPDATE 사이에 창이 있다. 최악 조합:
     * 타임아웃 크론(08:40)이 이 행을 declined 로 처리하는 순간 고객이 아침에
     * 승인 탭을 누르면 — CAS 없이는 **declined 처방 위에 승인 필드가 덮여**
     * 새 total_amount 와 옛 레시피가 공존하고, 다음 청구가 새 금액으로 옛
     * 박스를 긁는다. 두 화면이 같은 시간대라 창이 실재한다.
     *
     * 0행이면 이미 다른 쪽이 처리한 것 — 오류가 아니라 "늦었다"고 말한다.
     */
    const { data: approvedRows, error } = await createAdminClient()
      .from('dog_formulas')
      .update({
        approval_status: 'approved',
        approved_at: now.toISOString(),
        applied_from: today,
        applied_until: plus28,
      })
      .eq('id', pending.id)
      .eq('approval_status', 'pending_approval')
      .select('id')

    if (error) {
      return dbError(error, 'personalization_approve', '확정에 실패했어요')
    }
    if (!approvedRows || approvedRows.length === 0) {
      // 타임아웃 크론이 먼저 마감했거나 다른 기기에서 이미 응답한 것.
      return NextResponse.json(
        {
          code: 'ALREADY_RESOLVED',
          message:
            '이 제안은 이미 처리됐어요. 화면을 새로고침해 최신 상태를 확인해 주세요.',
        },
        { status: 409 },
      )
    }

    /**
     * 보호자가 금액을 보고 승인했으므로 청구액을 새 처방 기준으로 갱신.
     *
     * ★★ **동의받은 금액과 대조한다** (2026-08-08 금액 감사).
     *
     * 예전 주석은 "승인 화면이 보여준 값과 같은 함수·같은 입력 → 값 일치"
     * 라고 **주장만** 했다. 실물 검산이 없었다(AGENTS.md 규칙4).
     *
     * 실제로는 갈라진다. 제안(크론)과 승인(여기)은 **다른 시점**이고 동의
     * 유효기간이 3일이다. 그 사이 재고가 돌아오거나 단가가 바뀌면 여기서
     * 다시 계산한 값이 모달이 보여준 값과 달라지는데, 그대로 저장했다.
     * 실측: 품절 중 제안(177,100원) → 재입고 후 승인 → **453,700원 저장**
     * (+276,600, 2.56배). 고객은 177,100원에 동의했다.
     *
     * `app/api/subscriptions/create` 는 정확히 이 이유로 `expectedTotal`
     * 검산을 하고 있다(:244) — 승인 경로에만 없었다.
     *
     * 어긋나면 **금액은 건드리지 않는다**(처방 승인은 유효). 옛 금액이 남으면
     * 우리가 차액을 흡수하는 쪽이라 고객에게 불리하지 않고, 사람이 보고
     * 판단할 수 있게 사건으로 남긴다.
     */
    const agreedTotal = pending.formula?.priceChange?.to
    if (
      box &&
      typeof agreedTotal === 'number' &&
      Number.isFinite(agreedTotal) &&
      agreedTotal !== box.total
    ) {
      captureBusinessEvent('warning', 'approve_amount_mismatch', {
        subscriptionId: box.subscriptionId,
        dogId,
        agreedTotal,
        recomputedTotal: box.total,
        diff: box.total - agreedTotal,
      })
      console.error(
        '[personalization/approve] 동의 금액과 재계산 금액이 다르다 — 금액 갱신 보류:',
        { agreedTotal, recomputed: box.total },
      )
      return NextResponse.json({
        ok: true,
        decision,
        priceUpdated: false,
        itemsUpdated: false,
        amountMismatch: true,
        message:
          '처방은 확정했어요. 다만 안내드린 금액과 지금 계산한 금액이 달라서 금액은 그대로 두었어요 — 확인 후 다시 안내드릴게요.',
      })
    }

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
  // service_role — 위 approve 와 같은 이유(고객 UPDATE 권한 회수).
  // CAS — 승인 쪽과 같은 이유(위 주석). 0행이면 이미 처리된 것.
  const { data: declinedRows, error: declineErr } = await createAdminClient()
    .from('dog_formulas')
    .update({
      approval_status: 'declined',
      approved_at: null,
    })
    .eq('id', pending.id)
    .eq('approval_status', 'pending_approval')
    .select('id')
  if (!declineErr && (!declinedRows || declinedRows.length === 0)) {
    return NextResponse.json(
      {
        code: 'ALREADY_RESOLVED',
        message:
          '이 제안은 이미 처리됐어요. 화면을 새로고침해 최신 상태를 확인해 주세요.',
      },
      { status: 409 },
    )
  }
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
      await createAdminClient()
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

  // ★ 계산은 공용 헬퍼로 (2026-07-31). 화식 비율 변경 라우트가 **같은 계산**을
  //   비율만 바꿔서 쓴다 — 복사하면 금액을 만드는 곳이 둘이 된다.
  const quote = await quoteBox(supabase, {
    subscriptionId: sub.id,
    formula: row.formula,
    dailyKcal: row.daily_kcal,
    freshRatio: sub.fresh_ratio,
  })
  if (!quote) return null
  return {
    subscriptionId: sub.id,
    total: quote.total,
    itemRows: quote.itemRows,
  }
}
