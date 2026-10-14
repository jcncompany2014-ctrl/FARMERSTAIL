import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseRequest } from '@/lib/api/parseRequest'
import { addressInputSchema } from '@/lib/commerce/addresses'
import { isKoreanMobile, formatKoreanMobile, PHONE_ERROR } from '@/lib/phone'
import { PAID_STATUSES } from '@/lib/commerce/paid-status'
import { recordAdminAction } from '@/lib/admin-audit'
import { requireAdminUser, isUuid, rejectDeletedCustomer } from '../../_guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/users/[id]/address — 어드민이 고객 배송지를 고친다(2026-10-14 C5, 규칙257).
 *
 * # 어디를 고치나 — 배송지 우선순위 정본(lib/commerce/shipping-target)의 1순위
 * 청구 크론·포장 목록은 `기본 배송지(addresses.is_default) → 프로필 → 구독 신청서` 순서로 주소를 정한다.
 * 그래서 **기본 배송지**를 고친다(없으면 기본 배송지로 새로 만든다). 프로필은 건드리지 않는다 — profiles.name 은 회원 이름이라
 * 받는 분을 바꾸면 회원 이름이 바뀐다. 구독 신청서 주소(subscriptions.address)도 건드리지 않는다(마지막 대안·가입 때 화석).
 * 고객의 앱 '배송지 관리'에도 같은 기본 배송지가 보인다.
 *
 * # 이미 결제된 박스
 * 결제된 박스의 라벨은 그 주문에 적힌 주소로 찍힌다(청구 때 확정). alsoPendingOrders=true 면 이 고객의 **결제됐고 발송 대기
 * (preparing) 중인 정기배송 주문**의 주소도 같이 고친다 — 이미 보낸 주문·가게 주문은 건드리지 않는다.
 *
 * # 쓰지 않는 것
 * 화식 비율·금액(subscriptions.fresh_ratio·total_amount)은 이 라우트가 절대 쓰지 않는다 — 금액은 고객 동의로만 바뀐다.
 * 고객 쓰기 권한(RLS·칸 화이트리스트)도 바꾸지 않는다 — 관리자 확인 뒤 service_role 로 쓰고 범위는 `.eq('user_id', id)`.
 * 작업 기록(admin_audit_log)에는 바뀐 칸 이름만 남긴다(주소 원문은 남기지 않는다 — PII 최소화).
 *
 * # 2026-10-15 F-b(규칙275·276)
 *  · 탈퇴한 회원은 고치지 않는다(409) — 예전엔 '프로필이 있는가'만 봐서 익명화한 계정에 이름·전화가 든 배송지를 새로 만들 수 있었다.
 *  · 바꾸기 **전에** 옛 값(기본 배송지·결제된 발송 대기 주문 주소)을 admin_address_changes 에 남긴다 — 다른 손님을 눌렀거나 오타를
 *    냈을 때 되살릴 단서. 못 남기면 바꾸지 않는다. 이 표는 탈퇴하면 같이 지운다(고객 개인정보). 작업 기록엔 그 행 id·바뀐 주문 id 만.
 */

/** admin_address_changes — 새 표라 생성 타입(lib/supabase/types.ts)에 아직 없다. 이 두 동작만 좁게 연다. */
type ChangeLogClient = {
  from: (t: 'admin_address_changes') => {
    insert: (r: Record<string, unknown>) => {
      select: (c: 'id') => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> }
    }
    update: (r: Record<string, unknown>) => {
      eq: (c: 'id', v: string) => Promise<{ error: { message: string } | null }>
    }
  }
}

const zBody = addressInputSchema.extend({
  alsoPendingOrders: z.boolean().optional().default(false),
})

type AddrRow = {
  id: string
  recipient_name: string
  phone: string
  zip: string
  address: string
  address_detail: string | null
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!isUuid(id)) return NextResponse.json({ code: 'INVALID_USER' }, { status: 400 })
  const gate = await requireAdminUser()
  if (!gate.ok) return gate.response
  const parsed = await parseRequest(req, zBody)
  if (!parsed.ok) return parsed.response
  const input = parsed.data
  // 휴대폰 번호는 정본(lib/phone) — 냉동 배송은 기사님이 전화를 건다. 한 자리 빠진 번호는 곧 배송 실패.
  if (!isKoreanMobile(input.phone)) {
    return NextResponse.json({ code: 'INVALID_PHONE', message: PHONE_ERROR }, { status: 422 })
  }
  const next = {
    recipient_name: input.recipientName.trim(),
    phone: formatKoreanMobile(input.phone),
    zip: input.zip.trim(),
    address: input.address.trim(),
    address_detail: input.addressDetail?.trim() || null,
  }

  const admin = createAdminClient()
  // 고객이 있는지·탈퇴하지 않았는지 — 없는 id·익명화한 계정에 배송지가 생기지 않게(규칙275).
  const deleted = await rejectDeletedCustomer(admin, id)
  if (deleted) return deleted

  const { data: curRows, error: curErr } = await admin
    .from('addresses')
    .select('id, recipient_name, phone, zip, address, address_detail')
    .eq('user_id', id)
    .eq('is_default', true)
    .limit(1)
  // 조회 실패를 '기본 배송지 없음'으로 읽으면 기본 배송지가 하나 더 생긴다(규칙1).
  if (curErr) {
    return NextResponse.json({ code: 'DB_ERROR', message: '지금 배송지를 확인하지 못했어요' }, { status: 500 })
  }
  const cur = ((curRows ?? []) as AddrRow[])[0] ?? null

  const changedFields = cur
    ? (Object.keys(next) as Array<keyof typeof next>).filter((k) => (cur[k] ?? null) !== (next[k] ?? null))
    : (Object.keys(next) as Array<keyof typeof next>)

  const willChangeDefault = !(cur && changedFields.length === 0)

  // 결제됐고 발송 대기 중인 정기배송 박스 — 고르면 같이 고친다. 바꾸기 전 값을 먼저 읽는다(조회 실패면 바꾸지 않는다 — 규칙1).
  type OrderAddr = {
    id: string
    recipient_name: string | null
    recipient_phone: string | null
    zip: string | null
    address: string | null
    address_detail: string | null
  }
  let ordersBefore: OrderAddr[] = []
  if (input.alsoPendingOrders) {
    const { data: pend, error: pendErr } = await admin
      .from('orders')
      .select('id, recipient_name, recipient_phone, zip, address, address_detail')
      .eq('user_id', id)
      .not('subscription_id', 'is', null)
      .in('payment_status', [...PAID_STATUSES])
      .eq('order_status', 'preparing')
    if (pendErr) {
      return NextResponse.json({ code: 'DB_ERROR', message: '결제된 발송 대기 박스를 확인하지 못했어요 — 바꾸지 않았어요' }, { status: 500 })
    }
    ordersBefore = (pend ?? []) as OrderAddr[]
  }

  // ★바꾸기 전 값 기록(admin_address_changes) — 바꾸기 **전에** 넣는다. 못 넣으면 바꾸지 않는다(되살릴 단서 없이 덮지 않는다).
  const changeLog = admin as unknown as ChangeLogClient
  let changeId: string | null = null
  if (willChangeDefault || ordersBefore.length > 0) {
    const { data: logRow, error: logErr } = await changeLog
      .from('admin_address_changes')
      .insert({
        user_id: id,
        changed_by: gate.user.id,
        before_address: cur
          ? {
              recipient_name: cur.recipient_name,
              phone: cur.phone,
              zip: cur.zip,
              address: cur.address,
              address_detail: cur.address_detail,
            }
          : null,
        after_address: next,
        also_pending_orders: input.alsoPendingOrders,
        orders_before: ordersBefore,
      })
      .select('id')
      .single()
    if (logErr || !logRow) {
      console.error('[admin/address] 바꾸기 전 값 기록 실패 — 바꾸지 않음:', logErr?.message)
      return NextResponse.json(
        { code: 'CHANGE_LOG_FAILED', message: '바꾸기 전 주소를 기록하지 못해 바꾸지 않았어요 — 다시 시도해 주세요' },
        { status: 500 },
      )
    }
    changeId = logRow.id
  }

  let target: 'default_updated' | 'default_created' | 'unchanged'
  if (!willChangeDefault) {
    target = 'unchanged'
  } else if (cur) {
    const { data: upd, error: updErr } = await admin
      .from('addresses')
      .update(next)
      .eq('id', cur.id)
      .eq('user_id', id)
      .select('id')
    if (updErr) {
      return NextResponse.json({ code: 'DB_ERROR', message: '배송지를 저장하지 못했어요' }, { status: 500 })
    }
    if (!upd || upd.length === 0) {
      return NextResponse.json({ code: 'CONFLICT', message: '배송지가 방금 바뀌었어요 — 새로고침 후 다시 해 주세요' }, { status: 409 })
    }
    target = 'default_updated'
  } else {
    const { error: insErr } = await admin
      .from('addresses')
      .insert({ ...next, user_id: id, label: '기본 배송지', is_default: true })
    if (insErr) {
      return NextResponse.json({ code: 'DB_ERROR', message: '배송지를 저장하지 못했어요' }, { status: 500 })
    }
    target = 'default_created'
  }

  // 결제됐고 발송 대기 중인 정기배송 박스의 주소 — 고르면 같이.
  let pendingOrdersUpdated = 0
  let pendingOrdersError: string | null = null
  let updatedOrderIds: string[] = []
  if (input.alsoPendingOrders) {
    const { data: ords, error: ordErr } = await admin
      .from('orders')
      .update({
        recipient_name: next.recipient_name,
        recipient_phone: next.phone,
        zip: next.zip,
        address: next.address,
        address_detail: next.address_detail,
      })
      .eq('user_id', id)
      .not('subscription_id', 'is', null)
      .in('payment_status', [...PAID_STATUSES])
      .eq('order_status', 'preparing')
      .select('id')
    if (ordErr) pendingOrdersError = ordErr.message
    else {
      updatedOrderIds = ((ords ?? []) as Array<{ id: string }>).map((o) => o.id)
      pendingOrdersUpdated = updatedOrderIds.length
    }
  }

  // 기록 행에 '실제로 바꿨음'·바뀐 주문 id — 실패해도 옛 값은 이미 남아 있다(로그만).
  if (changeId) {
    const { error: markErr } = await changeLog
      .from('admin_address_changes')
      .update({ applied: true, applied_order_ids: updatedOrderIds })
      .eq('id', changeId)
    if (markErr) console.warn('[admin/address] 바꾼 표시 실패(옛 값은 남음):', markErr.message)
  }

  await recordAdminAction(gate.supabase, {
    action: 'customer_address_change',
    entityType: 'user',
    entityId: id,
    diff: {
      fields: changedFields,
      target,
      alsoPendingOrders: input.alsoPendingOrders,
      pendingOrdersUpdated,
      // 옛 주소 원문은 admin_address_changes(탈퇴 때 지워짐)에 — 여기엔 그 행 id·바뀐 주문 id 만(규칙257·276).
      changeId,
      orderIds: updatedOrderIds,
      ...(pendingOrdersError ? { pendingOrdersError: 'update_failed' } : {}),
    },
    req,
  })

  if (pendingOrdersError) {
    // 배송지는 저장됐는데 결제된 박스 주소는 못 바꿨다 — 라벨이 옛 주소로 찍힌다. 성공으로 말하지 않는다.
    return NextResponse.json(
      {
        code: 'PENDING_ORDERS_FAILED',
        message: '배송지는 저장했지만 발송 대기 박스의 주소는 못 바꿨어요 — 다시 시도해 주세요',
        target,
      },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true, target, changedFields, pendingOrdersUpdated })
}
