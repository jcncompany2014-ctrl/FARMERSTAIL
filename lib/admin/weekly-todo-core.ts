/**
 * '이번 주 할 일' — 순수 판정(테스트 가능) (2026-10-14 어드민 B2, 규칙249).
 *
 * 어드민 홈 맨 위 '이번 주 할 일'과 아침 브리핑 푸시(daily-briefing)가 **같은 함수로** 센다. 예전엔 브리핑이 박스·결제를
 * 따로 셌고 홈은 또 따로 셌다(미발송 판정 복사 3벌 — 규칙154 의 같은 병). 여기 순수 함수 + lib/admin/weekly-todo 의 조회 하나.
 *
 * # 한 주(발송 화요일 T 기준) — 2026-10-01 일정
 *  토(T−3) 일반 고객 결제·조리 시작 → 월(T−1) 포장 → 화(T) 발송(서포터즈 체험 구간은 화요일 09:10 결제).
 */
import { addDaysKst, kstDateOf } from '../datetime-kst.ts'
import { storeShipDate } from '../store/shipping.ts'
import {
  paidBoxShipIso,
  chargeDateFor,
  weekdayOf as weekdayOfIso,
  SHIP_WEEKDAY,
  CHARGE_BEFORE_SHIP_DAYS,
  type ChargeTiming,
} from '../shipping-schedule.ts'

/** 눈앞의 발송 화요일 — 오늘이 화요일이면 오늘. */
export function upcomingShipIso(todayIso: string): string {
  return addDaysKst(todayIso, (SHIP_WEEKDAY - weekdayOfIso(todayIso) + 7) % 7)
}

/** 그 발송분의 일반 고객 결제일(토)·포장일(월). */
export function weekAnchors(shipIso: string): { saturday: string; monday: string } {
  return { saturday: addDaysKst(shipIso, -CHARGE_BEFORE_SHIP_DAYS), monday: addDaysKst(shipIso, -1) }
}

export type PaidPrepRow = { id: string; subscription_id: string | null; paid_at: string | null; created_at: string }

/**
 * 결제됨 + 발송 대기(preparing) 정기배송 박스를 발송일로 가른다 — 박스 발송일 = paidBoxShipIso(그 구독의 지금 날짜, 결제 시각).
 *  · overdueUnshipped: 발송 화요일이 **지났는데** 아직 안 나간 박스(진짜 미발송).
 *  · paidForShip: 이번 발송 화요일(shipIso)에 나갈 결제된 박스.
 *  · dueBySubId: 이번 화요일까지 나가야 할(= 송장을 넣어야 할) 박스.
 */
export function classifyPaidBoxes(
  rows: readonly PaidPrepRow[],
  nextBySub: ReadonlyMap<string, string | null>,
  shipIso: string,
  todayIso: string,
): { paidForShip: number; overdueUnshipped: number; dueToShip: number; paidForShipSubIds: Set<string> } {
  let paidForShip = 0
  let overdueUnshipped = 0
  let dueToShip = 0
  const paidForShipSubIds = new Set<string>()
  for (const o of rows) {
    const boxShip = paidBoxShipIso(
      o.subscription_id ? (nextBySub.get(o.subscription_id) ?? null) : null,
      o.paid_at ?? o.created_at,
    )
    if (boxShip <= shipIso) dueToShip++
    if (boxShip < todayIso) {
      overdueUnshipped++
    } else if (boxShip === shipIso) {
      paidForShip++
      if (o.subscription_id) paidForShipSubIds.add(o.subscription_id)
    }
  }
  return { paidForShip, overdueUnshipped, dueToShip, paidForShipSubIds }
}

export type StorePrepRow = { id: string; paid_at: string | null; created_at: string; order_number: string | null }

/**
 * 결제됨 + 발송 대기(preparing) **웹 가게(단품) 주문**을 출고일로 가른다 (2026-10-15 F-b, 규칙273).
 * 출고일 = 결제한 날(KST) 다음의 첫 화·목 — 손님 화면이 약속한 날과 같은 정본(lib/store/shipping storeShipDate).
 *  · overdue: 출고일이 **지났는데** 아직 안 나간 주문(정기배송의 '발송일 지난 미발송'과 같은 뜻 — 빨강).
 *  · dueToday: 오늘이 출고일인 주문.
 * 10/14 배포에서 정기배송만 미발송 판정을 받고 가게 주문은 개수만 셌다 — 출고일이 지나도 아무 경보가 없었다.
 */
export function classifyStoreOrders(
  rows: readonly StorePrepRow[],
  todayIso: string,
): { outgoing: number; overdue: StorePrepRow[]; dueToday: number } {
  const overdue: StorePrepRow[] = []
  let dueToday = 0
  for (const o of rows) {
    const ship = storeShipDate(kstDateOf(o.paid_at ?? o.created_at))
    if (ship < todayIso) overdue.push(o)
    else if (ship === todayIso) dueToday++
  }
  return { outgoing: rows.length, overdue, dueToday }
}

/**
 * 이번 발송일 날짜가 남아 있는(= 아직 결제 안 된) 구독을 결제일로 가른다 — 결제일이 아직이면 '결제 예정', 지났으면 '결제 안 됨'.
 * 결제 시점(서포터즈 여부)을 모르면 가장 늦은 결제일(발송일)로 본다 — 서포터즈를 '결제 실패'로 단정하지 않는다(timingUnknown 으로 알린다).
 */
export function classifyUnchargedSubs(
  pending: ReadonlyArray<{ id: string; user_id: string }>,
  timings: ReadonlyMap<string, ChargeTiming> | null,
  shipIso: string,
  todayIso: string,
): { toCharge: number; notCharged: number; timingUnknown: boolean; notChargedSubIds: string[] } {
  let toCharge = 0
  let notCharged = 0
  const notChargedSubIds: string[] = []
  for (const s of pending) {
    const timing = timings?.get(s.user_id) ?? 'ship_day'
    if (chargeDateFor(shipIso, timing) > todayIso) toCharge++
    else {
      notCharged++
      notChargedSubIds.push(s.id)
    }
  }
  return { toCharge, notCharged, timingUnknown: pending.length > 0 && !timings, notChargedSubIds }
}

export type ChargeAttempt = { subscription_id: string; status: string; attempted_at: string | null; scheduled_for: string; error_code: string | null }

/**
 * 이번 회차(토 결제 ~ 화 발송) 결제 결과 — 구독마다 **마지막 시도**로 판정(토요일 실패 → 일요일 재시도 성공이면 성공).
 */
export function cycleChargeResults(attempts: readonly ChargeAttempt[]): {
  succeeded: string[]
  failed: Array<{ subscriptionId: string; errorCode: string | null }>
  pending: string[]
} {
  const last = new Map<string, ChargeAttempt>()
  for (const a of attempts) {
    const prev = last.get(a.subscription_id)
    const key = (x: ChargeAttempt) => `${x.scheduled_for}|${x.attempted_at ?? ''}`
    if (!prev || key(a) > key(prev)) last.set(a.subscription_id, a)
  }
  const succeeded: string[] = []
  const failed: Array<{ subscriptionId: string; errorCode: string | null }> = []
  const pending: string[] = []
  for (const [subId, a] of last) {
    if (a.status === 'succeeded') succeeded.push(subId)
    else if (a.status === 'failed') failed.push({ subscriptionId: subId, errorCode: a.error_code })
    else pending.push(subId)
  }
  return { succeeded, failed, pending }
}

/** 오늘이 이 주의 어느 칸인가 — 화면에서 오늘 칸을 앞에 둔다. */
export function todayColumn(todayIso: string): 'sat' | 'sun' | 'mon' | 'tue' | 'other' {
  const w = weekdayOfIso(todayIso)
  return w === 6 ? 'sat' : w === 0 ? 'sun' : w === 1 ? 'mon' : w === 2 ? 'tue' : 'other'
}

/** 'M/D(요일)' — 화면·브리핑 공용. */
export function mdLabel(iso: string): string {
  const w = ['일', '월', '화', '수', '목', '금', '토'][weekdayOfIso(iso)]
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}(${w})`
}
