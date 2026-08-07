import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import { subscriptionState, type SubLike } from '@/lib/subscription-state'
import { FRESH_TIERS } from '@/lib/subscription/freshTier'
import { quoteBox } from '@/lib/subscription/boxQuote'
import type { Formula } from '@/lib/personalization/types'
import { SHIP_WEEKDAY, weekdayOf } from '@/lib/shipping-schedule'
import { addDaysKst, todayKstIsoDate } from '@/lib/datetime-kst'
import { PAID_STATUSES } from '@/lib/commerce/paid-status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 화식 비율 변경 — `GET`(견적) · `PATCH`(적용).
 *
 * # 왜 필요했나 (사장님 2026-07-31)
 * 화식 비율(곁들임 30% / 반반 50% / 완전 100%)은 **신청할 때 한 번 고르면 끝**
 * 이었다. 앱에도 웹에도 어드민에도 바꾸는 수단이 없었다(전부 표시만).
 * 그런데 곁들임 티어의 설명 자체가 "**익숙해질 때까지** 섞어 급여하는 걸
 * 권장해요" 다 — 익숙해진 다음에 올릴 길을 안 만든 셈이었다.
 * 결과: 올리고 싶은 사람도(업셀) 낮추고 싶은 사람도(이탈 방지) **해지 후 재신청**
 * 말고는 길이 없었고, 실제로는 그냥 해지로 끝난다.
 *
 * # 금액은 서버가 정한다
 * 비율이 바뀌면 담기는 양이 바뀌고 그게 곧 청구액이다. 클라이언트가 보낸 금액은
 * **받지 않는다** — 이 라우트는 돈에 닿는다. 화면이 보여주는 값은 아래 GET 이
 * 준 값이고, PATCH 는 저장 직전에 **다시 계산**한다(그 사이 가격·재고가 바뀔 수
 * 있다). 금액과 품목은 `quoteBox` 한 함수 한 입력에서 나온다 — 따로 계산하면
 * "닭 값을 받고 소를 담는" 상태가 만들어진다(실제로 있었던 사고다).
 *
 * # 동의
 * 금액이 바뀌지만 **고객이 직접 고른 값**이라 별도 동의 모달이 없다. 그 모달은
 * 우리가 처방을 바꿔 금액이 달라질 때 쓰는 것이다(project_price_change_consent).
 * 여기선 고르는 화면이 새 금액을 보여주고 그걸 누른 것이 곧 동의다 — 그래서
 * GET 이 **세 티어의 금액을 다** 돌려준다(모르고 누르는 일이 없게).
 *
 * # 쓰기는 service_role
 * `subscriptions.total_amount` 와 `subscription_items` 는 고객 권한 밖이다
 * (20260730000000 · 20260730000300). 소유권은 이 라우트가 위에서 검증한다.
 */

const zPatch = z.object({
  ratio: z.union([z.literal(30), z.literal(50), z.literal(100)]),
})

type SubRow = SubLike & {
  id: string
  user_id: string
  dog_id: string | null
  fresh_ratio: number | null
  total_amount: number
}

type FormulaRow = {
  formula: { lineRatios: Formula['lineRatios']; toppers: Formula['toppers'] }
  daily_kcal: number
}

/**
 * 구독 + 그 강아지의 **적용 중인** 처방을 함께 읽는다.
 *
 * ★처방은 `created_at DESC` 로 고르고 승인 대기·거절은 뺀다 — 회차 번호가 큰 것이
 * 최신이 아니다(실측: cycle 2 가 cycle 1 보다 5일 먼저 생성). 승인 전 처방으로
 * 금액을 계산하면 **고객이 동의한 적 없는 구성으로 청구**하게 된다.
 */
async function loadSubAndFormula(
  supabase: Awaited<ReturnType<typeof createClient>>,
  subId: string,
  userId: string,
): Promise<
  | { ok: true; sub: SubRow; formula: FormulaRow }
  | { ok: false; status: number; code: string; message: string }
> {
  const { data: subRaw, error: subErr } = await supabase
    .from('subscriptions')
    .select(
      'id, user_id, dog_id, fresh_ratio, total_amount, status, billing_key, ' +
        'next_delivery_date, failed_charge_count, requires_billing_key_renewal',
    )
    .eq('id', subId)
    .eq('user_id', userId)
    .maybeSingle()
  if (subErr) {
    return {
      ok: false,
      status: 500,
      code: 'DB_ERROR',
      message: '정기배송 정보를 불러오지 못했어요',
    }
  }
  if (!subRaw) {
    return {
      ok: false,
      status: 404,
      code: 'NOT_FOUND',
      message: '정기배송을 찾을 수 없어요',
    }
  }
  const sub = (subRaw as unknown) as SubRow

  // 해지됐거나 카드 문제로 멈춘 구독은 금액을 바꿀 자리가 아니다.
  const state = subscriptionState(sub)
  if (state === 'cancelled') {
    return {
      ok: false,
      status: 409,
      code: 'NOT_ACTIVE',
      message: '해지된 정기배송은 변경할 수 없어요',
    }
  }
  if (!sub.dog_id) {
    return {
      ok: false,
      status: 409,
      code: 'NO_DOG',
      message: '이 정기배송에 연결된 아이가 없어요',
    }
  }

  /**
   * ★구성 변경 마감을 코드로 (2026-08-08 적대적 재감사 #4).
   *
   * 정본(lib/shipping-schedule)은 "박스 구성 변경 = **일요일 마감**"이라고
   * 문서로만 말하고 있었다 — 월요일에 원료를 손질하고 화요일 09:10 에
   * 청구하기 때문이다. 코드에 마감이 없어서 두 방향 사고가 가능했다:
   *  · 월~화 청구 전 변경 — 화면은 "다음 결제부터"라는데 **이번 청구에**
   *    새 금액이 실리고, 주방은 이미 옛 비율로 손질을 시작했다.
   *  · 화 청구 후 변경 — 긁은 돈은 옛 비율, 피킹 리스트 팩 구성은 새 비율.
   *    화면 금액도 새 값이라 사장님 눈에는 **어긋남이 보이지도 않는다.**
   * 잠금 두 겹:
   *  ① 결제된 발송 대기 주문이 있으면(청구 후 ~ 발송 전) 잠금
   *  ② 이번 주 발송 대상인데 일요일 마감이 지났으면(월·화) 잠금
   * 이 잠금이 있어야 기존 안내 문구("다음 결제부터 적용")가 참이 된다.
   */
  const { count: pendingBoxCount, error: pendingBoxErr } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('subscription_id', sub.id)
    .in('payment_status', PAID_STATUSES)
    .eq('order_status', 'preparing')
  if (pendingBoxErr) {
    return {
      ok: false,
      status: 503,
      code: 'LOOKUP_FAILED',
      message: '일시적인 오류가 있어요. 잠시 후 다시 시도해 주세요',
    }
  }
  const todayKst = todayKstIsoDate()
  const upcomingShip = addDaysKst(
    todayKst,
    (SHIP_WEEKDAY - weekdayOf(todayKst) + 7) % 7,
  )
  const sundayDeadline = addDaysKst(upcomingShip, -2)
  const dueThisWeek =
    sub.next_delivery_date != null && sub.next_delivery_date <= upcomingShip
  if ((pendingBoxCount ?? 0) > 0 || (dueThisWeek && todayKst > sundayDeadline)) {
    return {
      ok: false,
      status: 409,
      code: 'CHANGE_WINDOW_CLOSED',
      message:
        '이번 주 박스는 준비가 시작돼 지금은 바꿀 수 없어요. 박스를 받으신 뒤에 바꾸시면 다음 박스부터 적용돼요.',
    }
  }

  const { data: fRows, error: fErr } = await supabase
    .from('dog_formulas')
    .select('formula, daily_kcal, approval_status')
    .eq('dog_id', sub.dog_id)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)
  if (fErr) {
    return {
      ok: false,
      status: 500,
      code: 'DB_ERROR',
      message: '식단 정보를 불러오지 못했어요',
    }
  }
  const applied = (((fRows ?? []) as unknown) as Array<
    FormulaRow & { approval_status: string | null }
  >).find(
    (r) =>
      r.approval_status !== 'pending_approval' &&
      r.approval_status !== 'declined',
  )
  if (!applied) {
    return {
      ok: false,
      status: 409,
      code: 'NO_FORMULA',
      message: '적용 중인 식단이 없어 금액을 계산할 수 없어요',
    }
  }
  return { ok: true, sub, formula: applied }
}

/** GET — 지금 비율과 **세 티어의 금액**. 모르고 고르는 일이 없게 다 준다. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
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

  const loaded = await loadSubAndFormula(supabase, id, user.id)
  if (!loaded.ok) {
    return NextResponse.json(
      { code: loaded.code, message: loaded.message },
      { status: loaded.status },
    )
  }

  const options: Array<{ ratio: number; amount: number | null }> = []
  for (const t of FRESH_TIERS) {
    const q = await quoteBox(supabase, {
      subscriptionId: loaded.sub.id,
      formula: loaded.formula.formula,
      dailyKcal: loaded.formula.daily_kcal,
      freshRatio: t.ratio,
    })
    // 계산 실패는 **0원이 아니라 '모름'** 이다 — 0 으로 그리면 공짜로 보인다.
    options.push({ ratio: t.ratio, amount: q ? q.total : null })
  }

  return NextResponse.json({
    ok: true,
    current: loaded.sub.fresh_ratio,
    currentAmount: loaded.sub.total_amount,
    options,
  })
}

/** PATCH — 비율 적용. 금액·품목을 **저장 직전에 다시 계산**한다. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const rl = rateLimit({
    bucket: 'subscription-fresh-ratio',
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

  const { id } = await ctx.params
  const parsed = await parseRequest(req, zPatch)
  if (!parsed.ok) return parsed.response
  const { ratio } = parsed.data

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

  const loaded = await loadSubAndFormula(supabase, id, user.id)
  if (!loaded.ok) {
    return NextResponse.json(
      { code: loaded.code, message: loaded.message },
      { status: loaded.status },
    )
  }
  if (loaded.sub.fresh_ratio === ratio) {
    return NextResponse.json({
      ok: true,
      unchanged: true,
      ratio,
      amount: loaded.sub.total_amount,
    })
  }

  // ★ 저장 직전에 다시 계산한다 — 화면이 금액을 본 뒤 가격·재고가 바뀌었을 수 있다.
  const quote = await quoteBox(supabase, {
    subscriptionId: loaded.sub.id,
    formula: loaded.formula.formula,
    dailyKcal: loaded.formula.daily_kcal,
    freshRatio: ratio,
  })
  if (!quote) {
    // 금액을 못 만들면 **아무것도 바꾸지 않는다.** 비율만 바꾸고 금액을 두면
    // 담는 양과 받는 돈이 갈라진다.
    captureBusinessEvent('error', 'subscription.fresh_ratio.quote_failed', {
      subscriptionId: loaded.sub.id,
      requestedRatio: ratio,
    })
    return NextResponse.json(
      {
        code: 'QUOTE_FAILED',
        message: '금액을 계산하지 못했어요. 잠시 후 다시 시도해 주세요.',
      },
      { status: 503 },
    )
  }

  const admin = createAdminClient()
  const { error: updErr } = await admin
    .from('subscriptions')
    .update({ fresh_ratio: ratio, total_amount: quote.total })
    .eq('id', loaded.sub.id)
    .eq('user_id', user.id)
  if (updErr) {
    captureBusinessEvent('error', 'subscription.fresh_ratio.save_failed', {
      subscriptionId: loaded.sub.id,
      requestedRatio: ratio,
      dbError: updErr.message,
    })
    return NextResponse.json(
      { code: 'SAVE_FAILED', message: '변경하지 못했어요. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    )
  }

  /**
   * 박스 스냅샷도 새 비율로 다시 만든다 — 안 하면 청구액은 새 값인데 화면·주문
   * 내역은 옛 구성이 된다(2026-07-30 에 승인 경로에서 정확히 그 상태였다).
   * 지우고 다시 넣는다: 비율이 바뀌면 팩 수가 달라지고 품절로 빠지는 라인도 생긴다.
   */
  const { error: delErr } = await admin
    .from('subscription_items')
    .delete()
    .eq('subscription_id', loaded.sub.id)
  if (delErr) {
    captureBusinessEvent('error', 'subscription.items.rebuild_failed', {
      subscriptionId: loaded.sub.id,
      stage: 'delete',
      dbError: delErr.message,
    })
  } else if (quote.itemRows.length > 0) {
    const { error: insErr } = await admin
      .from('subscription_items')
      .insert(quote.itemRows)
    if (insErr) {
      // 지우기는 됐고 넣기가 실패 = 품목 0개. 청구는 total_amount 로 되지만
      // 발송 운영이 무엇을 담을지 모른다 → 반드시 사람이 봐야 한다.
      captureBusinessEvent('error', 'subscription.items.rebuild_failed', {
        subscriptionId: loaded.sub.id,
        stage: 'insert',
        dbError: insErr.message,
      })
    }
  }

  return NextResponse.json({ ok: true, ratio, amount: quote.total })
}
