import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveAutoDiscount } from '@/lib/payments/auto-discount'
import { nextShipDate } from '@/lib/shipping-schedule'

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
  if (typeof row.total_amount === 'number' && row.total_amount > 0) {
    const d = await resolveAutoDiscount({
      userId: user.id,
      subtotal: row.total_amount,
    })
    chargeAmount = d.chargeAmount
    discountLabel = d.discountAmount > 0 ? (d.label ?? '할인') : null
  }

  return NextResponse.json({
    ok: true,
    /** 실제 출금될 금액(할인 후). */
    amount: chargeAmount,
    /** 할인이 적용됐다면 그 이름 (예: '나무 등급 10%'). */
    discountLabel,
    /** 할인 전 금액 — 화면이 취소선 등으로 함께 보여줄 수 있게. */
    listAmount: row.total_amount,
    // 카드 등록 전 구독은 next_delivery_date 가 null — 첫 결제일은 다음
    // 화요일(billing-issue 가 그렇게 잡는다).
    firstChargeDate: row.next_delivery_date ?? nextShipDate(),
  })
}
