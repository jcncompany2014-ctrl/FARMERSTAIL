import { NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { createClient, getSafeUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import { LINE_TO_SLUG, TOPPER_TO_SLUG } from '@/lib/personalization/skuMap'
import {
  computeBoxItems,
  priceBox,
  subscribableItems,
} from '@/lib/personalization/boxPricing'
import {
  subscriptionItemRows,
  type ItemProduct,
} from '@/lib/personalization/subscriptionItems'
import type { Formula, FoodLine } from '@/lib/personalization/types'
import { ALL_LINES } from '@/lib/personalization/lines'
import { MAX_PICKS, ratiosFromPicks } from '@/lib/personalization/boxPicks'
import { isKoreanMobile, PHONE_ERROR } from '@/lib/phone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/subscriptions/create — 정기배송 생성. **금액은 서버가 정한다.**
 *
 * # 왜 만들었나 (2026-07-30 최종감사 후속)
 * 구독을 **클라이언트가 직접 insert** 하고 있었다(주문 화면). 그래서 금액·상태·
 * 배송횟수가 전부 브라우저에서 온 값이었다:
 *
 *   insert({ total_amount: subTotal, subtotal, status: 'active', ... })
 *
 * 1차에서 `subscriptions` 의 UPDATE 권한을 화이트리스트로 잠갔지만
 * (20260730000000) **INSERT 는 열려 있었다** — 즉 `{"total_amount": 100}` 으로
 * 구독을 만들면 청구 크론이 저장값을 그대로 긁으므로(그게 정본 규칙이다)
 * 100원만 내고 박스를 계속 받을 수 있었다. 그 마이그레이션 주석에 "남은 경로는
 * 구독 생성 시점 뿐이고, 그건 서버 라우트 이관이 정답 — 후속" 이라고 적어 둔
 * 그 후속이다.
 *
 * # 금액을 두 번 계산하지 않는다 — 서버가 계산하고, 화면 값은 **검산**이다
 * 서버는 주문 화면과 **같은 입력**으로 같은 순수함수를 돌린다:
 *   · 처방 = 그 강아지의 **cycle 1** (주문 화면과 같은 고정 — 최신 회차를 쓰면
 *     화면과 금액이 갈라진다. 그 함정을 이미 두 번 밟았다)
 *   · 제품 = is_active 인 것만, slug 매핑은 LINE_TO_SLUG/TOPPER_TO_SLUG 정본
 *   · 화식 양 = 요청값(티어 3개 중 하나만 허용)
 * 그리고 화면이 보여준 금액(`expectedTotal`)과 **다르면 거부**한다. 클라이언트
 * 값을 믿는 것이 아니라, 고객이 **본 금액과 청구할 금액이 같은지** 확인하는
 * 것이다. 다르면 대개 화면을 열어둔 사이 제품 가격이 바뀐 경우다 — 그때
 * 조용히 새 금액으로 만들면 **고객이 동의하지 않은 금액**을 청구하게 된다.
 *
 * # 카드 등록 전에는 배송일을 잡지 않는다
 * `next_delivery_date: null` 로 만든다. 홈이 이 값으로 '진행 중'을 판정하므로,
 * 카드 없는 구독이 활성처럼 보이던 문제를 막는다(사장님 2026-07-14).
 * 첫 배송일은 billing-issue(카드 등록 성공)가 잡는다.
 *
 * # 응답
 * `{ subscriptionId, customerKey, total }` — 클라이언트는 이 값으로 토스 창을
 * 연다. customerKey 도 서버가 만든다(클라이언트가 정할 이유가 없다).
 */

const zCreate = z.object({
  dogId: z.string().uuid(),
  /** 화식 양 티어. FRESH_TIERS 의 세 값만. */
  freshRatio: z.union([z.literal(30), z.literal(50), z.literal(100)]),
  recipientName: z.string().trim().min(2).max(40),
  /** 하이픈 포함/미포함 모두 허용 — 아래에서 숫자만 남겨 검사한다. */
  recipientPhone: z.string().trim().min(9).max(20),
  zip: z.string().trim().min(4).max(10),
  address: z.string().trim().min(4).max(200),
  addressDetail: z.string().trim().max(100).nullable(),
  deliveryMemo: z.string().trim().max(400).nullable(),
  /**
   * 플랜에서 보호자가 직접 고른 레시피(주문 화면의 `?recipes=`).
   *
   * ★ 이걸 안 받으면 **그 경로로 온 고객의 가입이 전부 막힌다.** 주문 페이지는
   * picks 가 있으면 `ratiosFromPicks` 로 처방 비율을 덮어써서 박스와 금액을
   * 만드는데, 서버가 알고리즘 원본 비율로 계산하면 금액이 달라져 아래
   * expectedTotal 검산에서 거부된다.
   *
   * 금액을 정하는 값이 아니라 **선택지**다 — 화면에서 고를 수 있는 것과 같은
   * 제약(유효한 라인, 최대 2종)을 서버가 그대로 건다.
   */
  recipes: z
    .array(z.enum(ALL_LINES as unknown as [FoodLine, ...FoodLine[]]))
    .max(MAX_PICKS)
    .optional(),
  /** 주문 화면이 보여준 총액 — 청구 근거가 아니라 **검산용**. */
  expectedTotal: z.number().int().min(0),
  saveToProfile: z.boolean().optional(),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const user = await getSafeUser(supabase)
  if (!user) {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 })
  }

  // 구독 생성은 되돌리기 비싼 작업(카드 등록 창까지 이어진다) — 연타·스크립트 방어.
  const rl = rateLimit({
    bucket: 'subscription-create',
    key: `${user.id}:${ipFromRequest(req)}`,
    limit: 10,
    windowMs: 300_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요.' },
      { status: 429, headers: rl.headers },
    )
  }

  const parsed = await parseRequest(req, zCreate)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  // 휴대폰 검증 정본 = lib/phone (2026-08-03). 화면과 서버가 각자 정규식을
  // 들고 있으면 갈라진다 — 실제로 네 곳이 따로 있었고 넷 다 같은 구멍이었다.
  if (!isKoreanMobile(body.recipientPhone)) {
    return NextResponse.json(
      { code: 'BAD_PHONE', message: PHONE_ERROR },
      { status: 400 },
    )
  }

  // ── 소유권: 내 강아지인가 ────────────────────────────────────────────
  const { data: dogRow, error: dogErr } = await supabase
    .from('dogs')
    .select('id')
    .eq('id', body.dogId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (dogErr) {
    return NextResponse.json({ code: 'DB_ERROR' }, { status: 500 })
  }
  if (!dogRow) {
    return NextResponse.json({ code: 'DOG_NOT_FOUND' }, { status: 404 })
  }

  // ── 처방: 주문 화면과 **같은 cycle 1** ──────────────────────────────
  const { data: formulaRow, error: formulaErr } = await supabase
    .from('dog_formulas')
    .select('cycle_number, formula, daily_kcal')
    .eq('dog_id', body.dogId)
    .eq('user_id', user.id)
    .eq('cycle_number', 1)
    .maybeSingle()
  if (formulaErr) {
    return NextResponse.json({ code: 'DB_ERROR' }, { status: 500 })
  }
  if (!formulaRow) {
    return NextResponse.json(
      {
        code: 'NO_FORMULA',
        message: '먼저 맞춤 식단 분석을 마쳐 주세요.',
      },
      { status: 409 },
    )
  }
  const f = formulaRow as unknown as {
    formula: {
      lineRatios: Formula['lineRatios']
      toppers: Formula['toppers']
      needsConsultation?: boolean
    }
    daily_kcal: number
  }

  // ★ 안전 게이트 — 판매 레시피가 전부 알레르기라 자동 추천이 불가한 강아지는
  //   결제로 넘어가면 안 된다. 주문 **화면**은 이 검사로 분석 페이지에 돌려보내지만,
  //   화면이 막는 것은 화면일 뿐이다 — 이 API 를 직접 부르면 알레르기 성분 박스가
  //   결제까지 갈 수 있었다. 승인 라우트와 같은 게이트를 여기에도 둔다.
  if (f.formula.needsConsultation === true) {
    return NextResponse.json(
      {
        code: 'CONSULTATION_REQUIRED',
        message:
          '알려주신 알레르기 때문에 이 구성은 그대로 시작할 수 없어요. 함께 안전한 방법을 찾아드릴게요 — 카카오톡으로 문의해 주세요.',
      },
      { status: 409 },
    )
  }

  // 플랜에서 고른 레시피가 있으면 그것이 이긴다 — 주문 화면과 **같은 변환**.
  const picks = body.recipes ?? []
  const lineRatios =
    picks.length > 0 ? ratiosFromPicks(picks) : f.formula.lineRatios

  // ── 제품: 활성 제품만 (주문 화면과 같은 조회) ───────────────────────
  const allSlugs = [
    ...Object.values(LINE_TO_SLUG).filter((s): s is string => s !== null),
    ...Object.values(TOPPER_TO_SLUG),
  ]
  const { data: prodList, error: prodErr } = await supabase
    .from('products')
    .select(
      'id, name, image_url, slug, price, sale_price, stock, is_subscribable, nutrition_facts',
    )
    .in('slug', allSlugs)
    .eq('is_active', true)
  if (prodErr) {
    return NextResponse.json({ code: 'DB_ERROR' }, { status: 500 })
  }
  const products: Record<string, ItemProduct> = {}
  for (const p of ((prodList ?? []) as unknown) as ItemProduct[]) {
    products[p.slug] = p
  }

  // ── 금액: 순수함수 정본. 화면 값은 검산에만 쓴다 ────────────────────
  const items = computeBoxItems({
    formula: {
      lineRatios,
      toppers: f.formula.toppers,
      dailyKcal: f.daily_kcal,
    },
    freshRatio: body.freshRatio,
    products,
  })
  const billable = subscribableItems(items)
  if (billable.length === 0) {
    return NextResponse.json(
      {
        code: 'NO_ITEMS',
        message:
          '지금은 정기배송 가능한 구성이 없어요. 잠시 후 다시 시도하거나 문의해 주세요.',
      },
      { status: 409 },
    )
  }
  const { subtotal, shipping, total } = priceBox(items)
  // ★`> 0` 만으로는 Infinity 를 못 막는다(`Infinity > 0` 은 참).
  //  토퍼 kcal 이 0 이면 total 이 Infinity 가 됐다(2026-08-08 금액 감사).
  if (!Number.isFinite(total) || total <= 0) {
    // 계산이 깨진 것 — 0원 구독을 만들지 않는다.
    captureBusinessEvent('error', 'subscription.create.zero_total', {
      userId: user.id,
      dogId: body.dogId,
      freshRatio: body.freshRatio,
    })
    return NextResponse.json({ code: 'PRICE_ERROR' }, { status: 500 })
  }

  if (total !== body.expectedTotal) {
    // 고객이 **본 금액**과 다르다 → 동의하지 않은 금액을 청구하게 된다.
    // 대개 화면을 열어둔 사이 제품 가격·재고가 바뀐 경우다.
    captureBusinessEvent('warning', 'subscription.create.total_mismatch', {
      userId: user.id,
      dogId: body.dogId,
      serverTotal: total,
      clientTotal: body.expectedTotal,
    })
    return NextResponse.json(
      {
        code: 'PRICE_CHANGED',
        message: '금액이 바뀌었어요. 화면을 새로 불러 확인해 주세요.',
        total,
      },
      { status: 409 },
    )
  }

  // ── 생성 ────────────────────────────────────────────────────────────
  // customerKey 도 서버가 만든다 — 클라이언트가 정할 이유가 없다.
  const customerKey = randomUUID()
  const admin = createAdminClient()

  const { data: sub, error: subErr } = await (
    admin as unknown as {
      from: (t: string) => {
        insert: (r: Record<string, unknown>) => {
          select: (c: string) => {
            single: () => Promise<{
              data: { id: string } | null
              error: { code?: string; message?: string } | null
            }>
          }
        }
      }
    }
  )
    .from('subscriptions')
    .insert({
      user_id: user.id,
      dog_id: body.dogId,
      // 2주 고정 — 주기 선택은 없다(박스가 14일치라 다른 주기는 성립하지 않는다).
      interval_weeks: 2,
      coverage_weeks: 2,
      fresh_ratio: body.freshRatio,
      status: 'active',
      // 카드 등록 전 = 배송 일정 없음. billing-issue 가 첫 배송일을 잡는다.
      next_delivery_date: null,
      total_deliveries: 0,
      recipient_name: body.recipientName,
      recipient_phone: body.recipientPhone,
      zip: body.zip,
      address: body.address,
      address_detail: body.addressDetail,
      delivery_memo: body.deliveryMemo,
      subtotal,
      shipping_fee: shipping,
      total_amount: total,
      billing_customer_key: customerKey,
    })
    .select('id')
    .single()

  if (subErr || !sub) {
    // 23505 = subscriptions_one_live_per_dog (강아지당 진행 중 구독 1개).
    if (subErr?.code === '23505') {
      return NextResponse.json(
        {
          code: 'ALREADY_SUBSCRIBED',
          message:
            '이 강아지에 진행중인 정기배송이 이미 있어요. 마이페이지에서 관리해 주세요.',
        },
        { status: 409 },
      )
    }
    captureBusinessEvent('error', 'subscription.create.insert_failed', {
      userId: user.id,
      dogId: body.dogId,
      dbError: subErr?.message ?? 'unknown',
    })
    return NextResponse.json({ code: 'DB_ERROR' }, { status: 500 })
  }

  // 품목 — 가입과 승인이 같은 빌더를 쓴다(승인 시 이 표를 다시 만든다).
  const { error: itemErr } = await admin
    .from('subscription_items')
    .insert(subscriptionItemRows(sub.id, billable))
  if (itemErr) {
    // 구독만 남고 품목이 비면 발송할 것을 모른다 → 즉시 취소(옛 클라이언트와 같은 처리).
    await admin
      .from('subscriptions')
      .update({
        status: 'cancelled',
        last_failed_charge_reason: 'item-insert-failed',
      })
      .eq('id', sub.id)
    captureBusinessEvent('error', 'subscription.create.items_failed', {
      userId: user.id,
      subscriptionId: sub.id,
      dbError: itemErr.message,
    })
    return NextResponse.json(
      { code: 'ITEMS_FAILED', message: '주문 상품을 담지 못했어요. 다시 시도해 주세요.' },
      { status: 500 },
    )
  }

  // 다음 주문에 자동 채우기 — 실패해도 구독은 계속(부가 기능).
  if (body.saveToProfile) {
    const { error: profErr } = await supabase
      .from('profiles')
      .update({
        name: body.recipientName,
        phone: body.recipientPhone,
        zip: body.zip,
        address: body.address,
        address_detail: body.addressDetail,
      })
      .eq('id', user.id)
    if (profErr) {
      captureBusinessEvent('warning', 'subscription.create.profile_save_failed', {
        userId: user.id,
        dbError: profErr.message,
      })
    }
  }

  return NextResponse.json({
    ok: true,
    subscriptionId: sub.id,
    customerKey,
    total,
  })
}
