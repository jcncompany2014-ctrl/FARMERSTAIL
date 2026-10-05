/**
 * 홈 '박스 진행' 카드 판정 — 결제된 정기배송 박스가 지금 어디쯤인가(순수 함수).
 *
 * # 왜 (2026-10-01 사장님)
 * "홈 화면에 결제한 사람들 중에 발송 시작한 사람한테는 그 가는 과정이 이쁘게 시각적으로 잘 담기게 하나 떴으면
 *  좋겠어. 발송 준비, 발송, 배송 중, 배송 완료" — 같은 날 일정이 토·일 조리 → 월 포장 → 화 발송으로 바뀌어,
 *  일반 고객은 토요일 아침에 결제되고 박스는 사흘 뒤에 나간다. 그 사이 '돈은 나갔는데 아무 소식이 없는'
 *  구간을 이 카드가 채운다.
 *
 * 단계 근거(orders — lib/commerce/order-fsm):
 *  · preparing  = 결제 완료·출고 준비 (order_status 'preparing')
 *  · shipped    = 택배사에 넘긴 **그날** (order_status 'shipping', shipped_at 의 KST 날짜 = 오늘)
 *  · in_transit = 그다음 날부터 배송 완료 전 (order_status 'shipping')
 *  · delivered  = 배송 완료 (order_status 'delivered' 또는 delivered_at) — 완료 뒤 이틀만 보인다
 * 도착 요일은 약속하지 않는다(지역·택배사 사정 — 사장님 "수요일 도착이라는 말을 쓰지 말고").
 */

export type BoxStage = 'preparing' | 'shipped' | 'in_transit' | 'delivered'

export const BOX_STAGES: ReadonlyArray<{ key: BoxStage; label: string }> = [
  { key: 'preparing', label: '발송 준비' },
  { key: 'shipped', label: '발송' },
  { key: 'in_transit', label: '배송 중' },
  { key: 'delivered', label: '배송 완료' },
]

/** 배송 완료 뒤 홈에 남겨 두는 기간(일). */
export const DELIVERED_SHOW_DAYS = 2

export type BoxOrderLike = {
  order_status: string | null
  payment_status: string | null
  shipped_at: string | null
  delivered_at: string | null
}

/** ISO 시각 → KST yyyy-mm-dd. */
function kstDay(iso: string): string {
  return new Date(Date.parse(iso) + 9 * 3600 * 1000).toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/** 지금 단계. 결제 전·취소·환불이거나 완료 뒤 이틀이 지났으면 null(카드 없음). */
export function boxStage(o: BoxOrderLike, todayKst: string): BoxStage | null {
  if (o.payment_status !== 'paid' && o.payment_status !== 'partially_refunded') return null
  if (o.order_status === 'cancelled' || o.order_status === 'pending') return null
  if (o.order_status === 'delivered' || o.delivered_at) {
    const day = o.delivered_at ? kstDay(o.delivered_at) : null
    if (day && daysBetween(day, todayKst) > DELIVERED_SHOW_DAYS) return null
    // 완료 시각을 모르는 옛 완료 건은 띄우지 않는다(언제 끝났는지 모르면 계속 남는다).
    return day ? 'delivered' : null
  }
  if (o.order_status === 'shipping') {
    if (o.shipped_at && kstDay(o.shipped_at) === todayKst) return 'shipped'
    return 'in_transit'
  }
  if (o.order_status === 'preparing') return 'preparing'
  return null
}

/**
 * 발송 준비 단계의 한 줄 — 주간 리듬(lib/shipping-schedule SHIP_WEEK)과 같은 말로.
 * shipIso = 그 박스가 나갈 화요일. 모르면 일반 문구.
 */
export function preparingDetail(shipIso: string | null, todayKst: string): string {
  if (!shipIso) return '박스를 준비하고 있어요'
  const d = daysBetween(todayKst, shipIso)
  // 발송일이 지났는데 아직 준비 중(화요일 발송이 늦어진 박스) — '오늘 보내드려요'를 매일 반복하지 않는다(10차 점검 D).
  //   shipTimingLabel 원칙: 지난 약속은 다시 하지 않고 확인 중이라고 말한다.
  if (d < 0) return '발송 일정을 확인하고 있어요'
  if (d === 0) return '오늘 보내드려요'
  if (d === 1) return '포장하고 있어요 · 내일 보내드려요'
  if (d <= 3) return `주방에서 만들고 있어요 · ${d}일 뒤 보내드려요`
  return `원료를 준비하고 있어요 · ${d}일 뒤 보내드려요`
}

/** 단계별 한 줄. */
export function stageDetail(stage: BoxStage, shipIso: string | null, todayKst: string): string {
  switch (stage) {
    case 'preparing':
      return preparingDetail(shipIso, todayKst)
    case 'shipped':
      return '오늘 택배로 보냈어요 · 지역에 따라 하루나 이틀 걸려요'
    case 'in_transit':
      return '택배가 오고 있어요'
    case 'delivered':
      return '도착했어요 · 받으신 박스는 바로 보관해 주세요'
  }
}
