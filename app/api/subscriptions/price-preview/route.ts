import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveAutoDiscount } from '@/lib/payments/auto-discount'
import { ipFromRequest, rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/subscriptions/price-preview?subtotal=N — 주문 화면의 **실제 첫 결제·반복 금액** 미리보기
 * (2026-09-26 출시 전 점검 5차).
 *
 * # 왜
 * 주문 화면은 '결제하기'를 누르면 곧바로 토스 카드 등록 창이 열린다 — 즉 정기결제에 동의하는
 * 마지막 화면이다. 그런데 금액을 구독가(할인 전)로만 보여 줘서, 이벤트 첫 박스 할인·체험가·
 * 나무 등급 10% 고객은 **실제로 나갈 금액을 한 번도 보지 못했고**, 이벤트 고객은 "2번째 박스부터
 * 정상가"라는 사실도 못 봤다. 청구와 **같은 함수**(resolveAutoDiscount)로 계산한다.
 *
 * subtotal 은 화면이 계산한 구독가(할인 전)다 — 표시용일 뿐 저장·청구에 쓰이지 않는다
 * (구독 생성 라우트가 서버에서 다시 계산한다). 로그인 사용자 본인의 할인만 계산한다.
 */
export async function GET(req: Request) {
  const rl = rateLimit({ bucket: 'price-preview', key: ipFromRequest(req), limit: 30, windowMs: 60_000 })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rl.headers },
    )
  }
  const subtotal = Number(new URL(req.url).searchParams.get('subtotal'))
  if (!Number.isInteger(subtotal) || subtotal <= 0 || subtotal > 10_000_000) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: '금액이 올바르지 않아요' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요해요' }, { status: 401 })
  }

  const now = await resolveAutoDiscount({ userId: user.id, subtotal })
  const discountKind: 'promotion' | 'trial' | 'tier' | null =
    now.discountAmount <= 0
      ? null
      : now.reason === 'promotion'
        ? 'promotion'
        : now.reason === 'trial_cheap' || now.reason === 'trial_half'
          ? 'trial'
          : 'tier'
  const recurringAmount =
    discountKind === 'promotion' || discountKind === 'trial'
      ? (await resolveAutoDiscount({ userId: user.id, subtotal, recurringOnly: true })).chargeAmount
      : now.chargeAmount

  return NextResponse.json({
    ok: true,
    /** 첫 결제에 실제로 나갈 금액. */
    firstAmount: now.chargeAmount,
    /** 한정 할인이 끝난 뒤 2주마다 나갈 금액. */
    recurringAmount,
    discountKind,
    discountLabel: now.discountAmount > 0 ? (now.label ?? '할인') : null,
    discountAmount: now.discountAmount,
  })
}
