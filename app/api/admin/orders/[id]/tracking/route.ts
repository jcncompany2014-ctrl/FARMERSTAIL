import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { dbError } from '@/lib/api/errors'
import { isCarrierCode, carrierLabel } from '@/lib/tracking'
import { pushToUser } from '@/lib/push'
import { recordAdminAction } from '@/lib/admin-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

/**
 * PATCH /api/admin/orders/[id]/tracking — 이미 발송한 주문의 운송장 정정.
 *
 * # 왜 필요한가 (2026-08-07 어드민 감사)
 * 발송 패널이 `이미 발송된 주문이에요. 수정 기능은 곧 열려요.` 로 막혀 있었고,
 * 그 "곧"에 해당하는 엔드포인트가 없었다. 즉 **송장을 한 번 잘못 넣으면 고칠
 * 방법이 없었다.** 유일한 우회가 shipping→preparing→재발송인데, 그러면 배송
 * 시작 푸시와 메일이 고객에게 **두 번** 간다.
 *
 * 상태 전이(/status)와 분리한 이유: FSM 은 from == to 를 거부한다. 운송장만
 * 고치는 일은 상태 전이가 아니므로 FSM 을 우회하는 게 아니라, 애초에 FSM 의
 * 관심사가 아니다.
 *
 * # 알림 규칙
 * 배송 시작 푸시/메일은 **다시 보내지 않는다**(중복 발송이 이 버그의 우회로가
 * 만들던 바로 그 피해다). 대신 송장번호가 실제로 **바뀐 경우에만** "운송장이
 * 변경됐어요" 를 한 번 보낸다 — 번호 없이 발송 처리된 주문에 뒤늦게 넣는
 * 경우가 여기 해당하고, 그때는 고객이 알아야 한다.
 */
export async function PATCH(req: Request, { params }: { params: Params }) {
  const { id } = await params

  let body: { carrier?: unknown; trackingNumber?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: '요청 형식이 올바르지 않습니다' },
      { status: 400 },
    )
  }

  const carrier =
    typeof body.carrier === 'string' ? body.carrier.trim() : ''
  const trackingNumber =
    typeof body.trackingNumber === 'string' ? body.trackingNumber.trim() : ''

  if (!carrier || !isCarrierCode(carrier)) {
    return NextResponse.json(
      { code: 'INVALID_CARRIER', message: '지원하지 않는 택배사예요' },
      { status: 400 },
    )
  }
  if (!trackingNumber) {
    return NextResponse.json(
      { code: 'INVALID_TRACKING', message: '송장번호를 입력해 주세요' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요합니다' },
      { status: 401 },
    )
  }
  if (!(await isAdmin(supabase, user))) {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다' },
      { status: 403 },
    )
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number, user_id, order_status, carrier, tracking_number')
    .eq('id', id)
    .single()

  if (orderError || !order) {
    return NextResponse.json(
      { code: 'ORDER_NOT_FOUND', message: '주문을 찾을 수 없습니다' },
      { status: 404 },
    )
  }

  // 운송장은 발송한 뒤에만 의미가 있다. preparing 은 발송 패널(=상태 전이)에서
  // 넣고, cancelled 는 고칠 이유가 없다.
  if (order.order_status !== 'shipping' && order.order_status !== 'delivered') {
    return NextResponse.json(
      {
        code: 'INVALID_STATE',
        message: '발송된 주문만 운송장을 수정할 수 있어요',
      },
      { status: 400 },
    )
  }

  const changed =
    order.tracking_number !== trackingNumber || order.carrier !== carrier

  if (!changed) {
    return NextResponse.json({ ok: true, unchanged: true })
  }

  // 쓰기는 service_role — orders 는 컬럼 UPDATE 권한을 회수한 결제 원장이다
  // (20260731000000). 관리자 검증은 위에서 끝났고 범위는 .eq('id', id) 가 책임진다.
  const { error: updateError } = await (
    createAdminClient() as unknown as {
      from: (t: string) => {
        update: (r: Record<string, unknown>) => {
          eq: (
            c: string,
            v: string,
          ) => Promise<{ error: { message?: string } | null }>
        }
      }
    }
  )
    .from('orders')
    .update({ carrier, tracking_number: trackingNumber })
    .eq('id', id)

  if (updateError) {
    return dbError(
      updateError,
      'admin_order_tracking',
      '운송장 수정에 실패했어요',
    )
  }

  // 번호가 바뀐 경우에만 한 번 알린다. 배송 시작 알림은 재발송하지 않는다.
  if (order.order_status === 'shipping') {
    pushToUser(
      order.user_id,
      {
        title: '운송장 정보가 업데이트됐어요',
        body: `${carrierLabel(carrier) ?? '택배'} · ${trackingNumber}`,
        url: `/mypage/orders/${order.id}`,
        tag: `order-${order.id}-tracking`,
      },
      { category: 'order' },
    ).catch(() => {
      /* 푸시는 베스트 에포트 */
    })
  }

  await recordAdminAction(supabase, {
    action: 'order_tracking_update',
    entityType: 'order',
    entityId: order.id,
    diff: {
      before: {
        carrier: order.carrier,
        tracking_number: order.tracking_number,
      },
      after: { carrier, tracking_number: trackingNumber },
      meta: { order_number: order.order_number },
    },
    req,
  })

  return NextResponse.json({ ok: true })
}
