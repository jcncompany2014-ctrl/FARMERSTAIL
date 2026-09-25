/**
 * 정기배송 **배송지 결정** — 청구 크론과 어드민 피킹 리스트가 함께 쓰는 단일 진실
 * (2026-09-25 출시 전 점검 3차).
 *
 * # 왜 한 곳으로 모았나
 * 청구 크론은 주문에 `기본 배송지 → 프로필` 순서로 정한 주소를 적는데, 피킹
 * 리스트(배송 라벨·CSV)는 `subscriptions.address`(가입 때 굳은 값)를 찍고 있었다.
 * 이사한 고객이 새 주소를 기본 배송지로 바꾸면 **청구·주문은 새 주소, 박스 라벨은
 * 옛 주소**가 됐다. 판정이 한 곳이면 두 화면이 갈릴 수 없다.
 *
 * # 우선순위
 *   1) 기본 배송지(addresses.is_default) — 고객이 명시적으로 고른 것
 *   2) 프로필(profiles) — 가입·첫 주문 때 저장한 것
 *   3) 구독 신청서(subscriptions 의 recipient_name·recipient_phone·zip·address) —
 *      **마지막 대안**. 신청 화면에서 주소를 치고 "다음에도 이 주소 사용"을 끈
 *      신규 고객은 1)·2)가 비어 있어 예전엔 결제가 매일 NO_SHIPPING_ADDRESS 로
 *      건너뛰어졌다(박스도 결제도 없이 멈춤). 신청서 주소는 그 고객이 **이
 *      구독을 위해 직접 적은 주소**라 1)·2)가 없을 때 쓰는 게 맞다. 이사한 고객은
 *      1)·2)를 갱신하므로 이 값이 그들을 옛 주소에 묶지 않는다.
 *
 * 필수 4칸(받는 분·전화·우편번호·주소)이 다 있어야 후보로 인정한다.
 */

export type ShippingTarget = {
  name: string
  phone: string
  zip: string
  address: string
  addressDetail: string | null
}

export type ShippingCandidate = {
  name?: string | null
  phone?: string | null
  zip?: string | null
  address?: string | null
  addressDetail?: string | null
} | null | undefined

function filled(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

/** 우선순위대로 받은 후보 중 **필수 4칸이 다 찬 첫 번째**. 없으면 null. */
export function pickShippingTarget(
  candidates: ReadonlyArray<ShippingCandidate>,
): ShippingTarget | null {
  for (const c of candidates) {
    if (!c) continue
    if (filled(c.name) && filled(c.phone) && filled(c.zip) && filled(c.address)) {
      return {
        name: c.name,
        phone: c.phone,
        zip: c.zip,
        address: c.address,
        addressDetail: filled(c.addressDetail) ? c.addressDetail : null,
      }
    }
  }
  return null
}
