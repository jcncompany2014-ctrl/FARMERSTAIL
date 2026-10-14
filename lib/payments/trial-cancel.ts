/**
 * 서포터즈 도장 취소·다시 찍기 — 판정 순수 함수 (2026-10-15 어드민 수정 F-a, 규칙260).
 *
 * # 왜
 * '도장 취소'가 subscription_trials 행을 지웠다. 청구 크론의 인상 동의 장치(priceRiseGate)는 체험 도장(행)이 있는 사람만
 * 보므로, 이미 100원으로 결제된 서포터즈의 도장을 취소하면 동의 장치를 건너뛰고 그 주 토요일에 정가가 바로 결제됐다
 * (앞 결제 100원 → 이번 정가 = 인상인데 동의 확인 없음). 체험단 화면에서도 사라져 동의를 기록할 곳이 없었고, 다시 찍으면
 * 남은 3회가 아니라 100원 4회 + 반값 4회로 새로 시작했다.
 *
 * # 규칙
 *  · 서포터즈 가격으로 결제된 박스가 있는 사람 = '취소 기록'(soft): 남은 회차 0 + 취소 시각 + 취소 때 남은 회차 보관.
 *    → 청구 크론은 '앞 결제 100원·반값 → 이번 정가 = 정가 인상(to_full)'으로 보고 정가 동의가 기록돼야만 결제한다.
 *    → 체험단 화면에 남아 동의를 기록할 수 있다. 결제일은 정상 규칙(chargeTimingFor — 남은 회차 0 = 조리 직전 토요일).
 *  · 서포터즈 가격 결제가 한 번도 없는 사람(잘못 찍은 도장) = 지금처럼 행을 지운다(delete).
 *  · 이미 취소된 도장 = 다시 취소하지 않는다(already).
 *  · 다시 찍기(restore) = 취소 때 남겨 둔 회차로 되살린다(새로 4+4 가 아니다).
 *
 * 순수 함수 — DB·시간 없이 재현·테스트 가능해야 돈 판단을 믿을 수 있다(lib/payments/trial.ts 와 같은 원칙).
 */

/** 도장 행의 판정용 부분집합 — subscription_trials. 취소 칸은 마이그레이션 전엔 없을 수 있다(undefined = 취소 안 됨). */
export type TrialCancelRow = {
  cheap_remaining: number
  half_remaining: number
  cancelled_at?: string | null
  cancelled_cheap_remaining?: number | null
  cancelled_half_remaining?: number | null
}

export type TrialCancelPlan = 'soft' | 'delete' | 'already'

/** 도장이 취소된 상태인가 — 취소 시각이 있으면 취소. */
export function isTrialCancelled(row: Pick<TrialCancelRow, 'cancelled_at'> | null | undefined): boolean {
  return !!row && typeof row.cancelled_at === 'string' && row.cancelled_at.length > 0
}

/**
 * 도장 취소를 어떻게 하나.
 * hasSupporterPaid = 서포터즈 가격(100원·반값)으로 결제된(돈이 남아 있는) 정기배송 주문이 있나 — 모르면 호출부가 막는다.
 */
export function trialCancelPlan(input: { row: TrialCancelRow; hasSupporterPaid: boolean }): TrialCancelPlan {
  if (isTrialCancelled(input.row)) return 'already'
  return input.hasSupporterPaid ? 'soft' : 'delete'
}

/** 취소 기록으로 바꿀 값 — DB 모양 제약(subscription_trials_cancel_shape_check)과 같다. */
export function softCancelPatch(
  row: TrialCancelRow,
  nowIso: string,
  adminId: string,
): {
  cheap_remaining: 0
  half_remaining: 0
  cancelled_at: string
  cancelled_by: string
  cancelled_cheap_remaining: number
  cancelled_half_remaining: number
} {
  return {
    cheap_remaining: 0,
    half_remaining: 0,
    cancelled_at: nowIso,
    cancelled_by: adminId,
    cancelled_cheap_remaining: Math.max(0, Math.trunc(row.cheap_remaining)),
    cancelled_half_remaining: Math.max(0, Math.trunc(row.half_remaining)),
  }
}

/** 다시 찍기 — 취소 때 남겨 둔 회차로 되살린다. 취소된 도장이 아니면 null. */
export function restorePatch(row: TrialCancelRow): {
  cheap_remaining: number
  half_remaining: number
  cancelled_at: null
  cancelled_by: null
  cancelled_cheap_remaining: null
  cancelled_half_remaining: null
} | null {
  if (!isTrialCancelled(row)) return null
  return {
    cheap_remaining: Math.max(0, Math.trunc(Number(row.cancelled_cheap_remaining ?? 0))),
    half_remaining: Math.max(0, Math.trunc(Number(row.cancelled_half_remaining ?? 0))),
    cancelled_at: null,
    cancelled_by: null,
    cancelled_cheap_remaining: null,
    cancelled_half_remaining: null,
  }
}
