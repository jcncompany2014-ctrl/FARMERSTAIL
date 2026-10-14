import { describeBillingError, isMerchantConfigError } from '../payments/billing-error-classify.ts'

/**
 * 어드민 자동결제 이력의 '문제 행' 설명 — 순수 함수(2026-10-14 A2).
 *
 * 실패·보류·결과 불명(pending) 행에 사장님이 바로 판단할 수 있는 쉬운 말을 붙인다. 토스 코드는 고객 화면과 같은
 * describeBillingError(정본)로, 청구 크론이 스스로 남기는 코드(배송지·주문 만들기 등)는 여기서 우리 말로 바꾼다.
 */

export type ChargeStatus = 'pending' | 'succeeded' | 'failed' | 'skipped'

/** 사장님이 손써야 할 수 있는 행 — 성공 말고 전부. */
export function isProblemCharge(status: string): boolean {
  return status === 'failed' || status === 'pending' || status === 'skipped'
}

/** 청구 크론·결과 불명 확인이 직접 남기는 코드 — 토스 코드가 아니다. */
const OUR_CODES: Record<string, string> = {
  ADDRESS_LOOKUP_FAILED: '배송지 조회 일시 오류 — 우리 쪽 문제예요. 다음 실행에서 다시 시도해요',
  NO_SHIPPING_ADDRESS: '배송지가 없어요 — 고객에게 기본 배송지 등록을 안내해 주세요',
  ORDER_INSERT_FAILED: '주문 만들기 실패 — 우리 쪽 문제라 카드는 긁지 않았어요',
  ORDER_LINK_FAILED: '주문 연결 실패 — 우리 쪽 문제예요. 결제 여부를 주문에서 확인해 주세요',
  INTERRUPTED_NOT_CHARGED: '청구 도중 끊겼는데 토스 확인 결과 결제는 안 됐어요',
}

export function chargeProblemReason(row: {
  status: string
  error_code: string | null
  error_message: string | null
}): string {
  if (row.status === 'pending') {
    return '결과 확인 중 — 카드사 응답을 기다려요. 다음 실행에서 토스에 확인하고, 두 번 결제되지 않아요'
  }
  const code = row.error_code?.trim() ?? ''
  if (code && OUR_CODES[code.toUpperCase()]) return OUR_CODES[code.toUpperCase()]!
  if (row.status === 'skipped') return row.error_message?.trim() || '이번 회차는 건너뛰었어요'
  if (isMerchantConfigError(code)) return '결제 시스템 설정 오류 — 고객 카드 문제가 아니에요. 키·요청값을 확인해 주세요'
  if (!code) return row.error_message?.trim() || '결제 처리 실패'
  return describeBillingError(code).short
}
