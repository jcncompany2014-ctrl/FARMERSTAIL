/**
 * 이 주문이 재고를 미리 잡았나 — 취소·결제 만료 때 되돌릴 재고가 있나. 정본 하나(2026-10-10, 규칙172).
 *
 * 지금 재고를 잡는(reserve_order_stock) 경로는 **없다**:
 *  - 정기배송 청구(subscription-charge)는 재고를 건드리지 않는다.
 *  - 웹 가게 주문(FTS-)도 냉동 재고를 사장님이 직접 관리해 잡지 않는다(기획서 Phase 1).
 * 그래서 둘 다 되돌리지 않는다 — 되돌리면 차감한 적 없는 재고가 유령처럼 는다(2026-08-08 동시성 감사가 정기배송에서 잡은 그 사고).
 * 예전 판정 `subscription_id == null`(= 낱개 주문은 예약함)은 6월 이전 상점 기준이라, 그대로 두면 새 가게 주문을
 * 예약 주문으로 잘못 읽는다. 그 밖(6월 이전 낱개 주문)은 예전처럼 되돌린다.
 */
import { isStoreOrderNumber } from '../store/order-number.ts'

export function orderReservedStock(o: { subscription_id?: string | null; order_number?: string | null }): boolean {
  if (o.subscription_id != null) return false
  if (isStoreOrderNumber(o.order_number)) return false
  return true
}
