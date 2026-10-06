import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveAutoDiscount } from '@/lib/payments/auto-discount'
import { nextShipDate, keepShipDateOnCardRegister, firstChargeNoticeDate } from '@/lib/shipping-schedule'
import { getChargeTiming } from '@/lib/payments/charge-timing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/subscriptions/billing-terms?subscriptionId=X
 *
 * 자동결제 등록 화면(/subscribe/billing-auth)의 **정기결제 고지**용 —
 * 금액 · 첫 결제일.
 *
 * # 왜 라우트가 필요한가 (2026-08-08 금액 감사)
 * 그 화면은 'use client' 라 `resolveAutoDiscount`(createAdminClient 사용)를
 * 직접 부를 수 없다. 그래서 처음엔 `total_amount`(할인 **전**)를 그대로
 * 보여줬는데, 나무 등급 고객은 화면이 153,100원이라 말하고 실제로는
 * 137,790원이 출금됐다 — **정기결제 동의를 받는 자리**라 화면 금액과
 * 실제 출금액이 달라선 안 된다(전자상거래법 정기결제 고지 · 토스 PG 심사).
 *
 * 여기서 청구 크론과 **같은 함수**(resolveAutoDiscount)로 할인 후 금액을
 * 계산해 내려준다 — 두 곳이 다른 계산을 하면 또 갈라진다.
 *
 * # 주의
 * 등급·프로모션은 결제일에 다시 계산되므로 이 값은 "지금 기준"이다.
 * 그 사이 등급이 오르면 **더 적게** 청구된다 — 고지보다 적게 나가는 방향만
 * 허용된다(반대는 금액변경 동의 게이트가 막는다).
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const subscriptionId = url.searchParams.get('subscriptionId')
  if (!subscriptionId) {
    return NextResponse.json(
      { code: 'MISSING_PARAM', message: '구독 정보가 없어요' },
      { status: 400 },
    )
  }

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

  // 소유 확인 — 쿠키 클라이언트 + RLS 가 남의 구독을 거른다.
  const { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .select('id, total_amount, next_delivery_date')
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (subErr) {
    return NextResponse.json(
      { code: 'DB_ERROR', message: '금액을 불러오지 못했어요' },
      { status: 500 },
    )
  }
  if (!sub) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '구독을 찾을 수 없어요' },
      { status: 404 },
    )
  }

  const row = sub as {
    total_amount: number | null
    next_delivery_date: string | null
  }

  // 할인 후 = 실제 출금액. 청구 크론과 같은 함수를 쓴다.
  let chargeAmount = row.total_amount
  let discountLabel: string | null = null
  // ★첫 결제와 그 뒤 반복 금액을 나눠 말한다 (2026-09-26 출시 전 점검 5차).
  //   이벤트 할인은 첫 결제 한 번, 체험가는 체험 기간만 — 화면이 이 금액을 '2주마다'로
  //   말하고 있었다(2번째 박스부터 정상가가 동의 없이 나가는데).
  let discountKind: 'promotion' | 'trial' | 'tier' | null = null
  let recurringAmount = row.total_amount
  let oneTimeDeferred = false
  if (typeof row.total_amount === 'number' && row.total_amount > 0) {
    // ★여러 구독 — 이벤트·이웃 할인·서포터즈 회차는 사람 단위라 먼저 청구되는 구독이 쓴다
    //   (2026-09-28 9차 점검). 이 구독은 카드 등록 전이라 청구 순서가 미정 → 이미 있는
    //   활성·일시정지 구독이 모두 먼저 청구된다고 보고 보수적으로 고지한다. 동의 화면은
    //   고지액 ≥ 실제 청구액이어야 한다(할인가로 동의받고 정가가 나가면 '동의와 다른 청구').
    const { count: othersCount, error: othersErr } = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['active', 'paused'])
      .neq('id', subscriptionId)
    // 조회 실패면 다른 구독이 있다고 본다(보수적).
    const others = othersErr ? 1 : (othersCount ?? 0)
    const d = await resolveAutoDiscount({
      userId: user.id,
      subtotal: row.total_amount,
      aheadCount: others,
    })
    if (others > 0) {
      const optimistic = await resolveAutoDiscount({ userId: user.id, subtotal: row.total_amount })
      oneTimeDeferred = optimistic.chargeAmount < d.chargeAmount
    }
    chargeAmount = d.chargeAmount
    discountLabel = d.discountAmount > 0 ? (d.label ?? '할인') : null
    discountKind =
      d.discountAmount <= 0
        ? null
        : d.reason === 'promotion' || d.reason === 'neighbor'
          ? 'promotion'
          : d.reason === 'trial_cheap' || d.reason === 'trial_half'
            ? 'trial'
            : 'tier'
    recurringAmount =
      discountKind === 'promotion' || discountKind === 'trial'
        ? (
            await resolveAutoDiscount({
              userId: user.id,
              subtotal: row.total_amount,
              recurringOnly: true,
            })
          ).chargeAmount
        : chargeAmount
  }

  // ★첫 결제일 = 결제 시점 정본(2026-10-01 일정 변경). 발송일(화)과 결제일이 고객마다 다르다 — 일반 = 발송 3일 전
  //   토요일(조리 직전), 서포터즈 체험 구간 = 발송일. 이 값이 정기결제 동의 화면의 "첫 결제 M월 D일"이다(법정 고지).
  //   결제 시점을 모르면(조회 실패) 결제일을 비운다 — 화면은 발송일만 말하고, 틀린 결제일을 고지하지 않는다.
  //   카드 등록 전 구독은 next_delivery_date 가 null — 첫 발송일은 billing-issue 가 잡는 것과 같은 계산
  //   (nextShipDate + 결제 시점별 마감: 서포터즈 체험 구간 일요일·일반 금요일 밤, 2026-10-02).
  const timing = await getChargeTiming(user.id)
  // ★카드 재등록이면 billing-issue 와 **같은 판정**으로 날짜를 고른다(10차 점검 A F3) — 결제일이 지난 옛 날짜를
  //   "첫 결제 10월 10일(토)"처럼 지난 날로 고지하던 것. 정본 keepShipDateOnCardRegister.
  const firstShipDate =
    row.next_delivery_date && keepShipDateOnCardRegister(row.next_delivery_date, timing ?? 'ship_day')
      ? row.next_delivery_date
      : nextShipDate(undefined, timing ?? 'before_cooking')
  // 지난 날·오늘 결제 시각이 지난 날을 고지하지 않는다 — 다음 크론이 실제로 도는 날 이후(11차 점검 A#3).
  const firstChargeDate = timing ? firstChargeNoticeDate(firstShipDate, timing) : null

  return NextResponse.json({
    ok: true,
    /** 실제 출금될 금액(할인 후). */
    amount: chargeAmount,
    /** 할인이 적용됐다면 그 이름 (예: '나무 등급 10%'). */
    discountLabel,
    /** 할인 전 금액 — 화면이 취소선 등으로 함께 보여줄 수 있게. */
    listAmount: row.total_amount,
    /** 할인 종류 — promotion(첫 박스만)·trial(체험 기간만)·tier(계속). */
    discountKind,
    /** 한정 할인이 끝난 뒤 2주마다 나갈 금액. */
    recurringAmount,
    /** 다른 구독에 1회성 할인이 먼저 쓰일 수 있어 할인 전(보수적) 금액으로 고지했는가. */
    oneTimeDeferred,
    /** 첫 결제일(결제 시점을 모르면 null). */
    firstChargeDate,
    /** 첫 발송일(화). */
    firstShipDate,
  })
}
