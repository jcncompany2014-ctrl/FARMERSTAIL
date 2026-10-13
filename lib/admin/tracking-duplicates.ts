/**
 * 송장 중복 경고 — 같은 택배사·송장번호가 다른 주문에 이미 있는지 (2026-10-13 사장님 결정, 규칙198).
 *
 * # 왜
 * 10/12 점검에서 송장 하나가 두 주문에 들어간 건이 나왔다. 한 박스에 두 주문을 합쳐 보낸 정상 경우도
 * 있어서(다견 가정) DB 제약으로 막지는 않는다 — 사장님 결정: **화면 경고만**. 같은 번호가 다른 주문에
 * 있으면 저장 전에 알려 주고, 사장님이 확인(confirmDuplicate: true)해야 저장된다.
 * 확인 조회가 실패하면 '중복 없음'으로 넘기지 않고 같은 확인을 받는다(모르면 묻는다).
 *
 * 쓰는 곳: app/api/admin/orders/[id]/tracking(송장 수정) · app/api/admin/orders/[id]/status(발송 처리).
 * 화면: app/admin/orders/[id]/ShippingControl — 409 를 받으면 확인 창을 띄우고 다시 보낸다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

/** API 가 409 와 함께 돌려주는 코드 — 화면이 이 둘이면 확인 창을 띄운다. */
export const DUPLICATE_TRACKING = 'DUPLICATE_TRACKING'
export const DUPLICATE_TRACKING_CHECK_FAILED = 'DUPLICATE_TRACKING_CHECK_FAILED'

/** 경고 문구 — 주문번호는 3개까지만 적고 나머지는 '외 n건'. */
export function duplicateTrackingMessage(orderNumbers: readonly string[]): string {
  const shown = orderNumbers.slice(0, 3).join(', ')
  const more = orderNumbers.length > 3 ? ` 외 ${orderNumbers.length - 3}건` : ''
  return `같은 택배사·송장번호가 다른 주문(${shown}${more})에 이미 있어요. 한 박스에 합쳐 보낸 게 맞으면 그대로 저장해 주세요.`
}

export const DUPLICATE_CHECK_FAILED_MESSAGE =
  '같은 송장번호가 다른 주문에 있는지 확인하지 못했어요. 번호를 한 번 더 확인하고 저장해 주세요.'

/**
 * 다른 주문의 주문번호들(최대 10건). 조회 실패면 { error }.
 * 관리자 확인이 끝난 서버 라우트에서 부른다(쿠키 클라이언트여도 관리자 RLS 로 전 주문을 본다).
 */
export async function findTrackingDuplicates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any, 'public', any>,
  input: { orderId: string; carrier: string; trackingNumber: string },
): Promise<{ orderNumbers: string[]; error: null } | { orderNumbers: null; error: { message: string } }> {
  const { data, error } = await client
    .from('orders')
    .select('order_number')
    .eq('carrier', input.carrier)
    .eq('tracking_number', input.trackingNumber)
    .neq('id', input.orderId)
    .limit(10)
  if (error) return { orderNumbers: null, error }
  const orderNumbers = ((data ?? []) as Array<{ order_number: string | null }>)
    .map((r) => r.order_number ?? '(번호 없음)')
  return { orderNumbers, error: null }
}
