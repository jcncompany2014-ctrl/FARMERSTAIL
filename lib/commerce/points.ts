/**
 * Farmer's Tail — 포인트 ledger 헬퍼.
 *
 * 구조: `point_ledger` 테이블에 append-only 로그. 각 row는 {delta,
 * balance_after, reason, reference_*}. 최신 row의 balance_after가 현재 잔액.
 *
 * 동시성 안전: `apply_point_delta` Postgres RPC (migration
 * 20260425000000) 를 통해 사용자별 advisory lock + 단일 트랜잭션 안에서 처리.
 * 같은 reference (예: 같은 주문) 에 대한 중복 적립은 partial unique index 로
 * DB 레벨에서 차단되며, 함수가 `already_applied` 메시지로 멱등 응답.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

/** ledger에 기록되는 참조 타입. 문자열 enum이 DB 컬럼 값과 일치해야 함. */
export type PointReferenceType =
  | 'order'
  /**
   * 환급/회수 분리 (audit #64).
   * - `order_refund_credit`: 사용자가 결제 시 쓴 points_used 환급
   * - `order_refund_revoke`: 결제 적립된 points_earned 회수 (음수 delta)
   * 같은 reference_id (order.id) 로 두 row 가 필요해 reference_type 으로 분리.
   *
   * `order_refund` 는 legacy — 새 코드는 위 둘을 사용. 기존 row 호환을 위해 유지.
   */
  | 'order_refund'
  | 'order_refund_credit'
  | 'order_refund_revoke'
  | 'review'
  | 'signup_bonus'
  | 'referral'
  | 'admin_adjustment'
  | 'account_deletion'

export interface AppendLedgerInput {
  userId: string
  /** 양수면 적립, 음수면 차감. 0도 허용(메모성 로그). */
  delta: number
  /** 사용자에게 보여줄 한글 설명. ex) "주문 결제 포인트 사용" */
  reason: string
  referenceType: PointReferenceType
  /** 참조되는 리소스 id (order.id 등). null 허용 — 메모성 기록일 때. */
  referenceId: string | null
}

/**
 * 현재 포인트 잔액 조회. ledger에 row가 없으면 0.
 */
export async function getCurrentBalance(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data } = await supabase
    .from('point_ledger')
    .select('balance_after')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.balance_after ?? 0
}

/**
 * ledger 에 항목을 추가하고 balance_after 를 자동 계산. 성공 시 새 잔액 반환.
 *
 * 내부적으로 `apply_point_delta` RPC 호출. RPC 안에서:
 *   1) 사용자별 advisory lock 획득 (동시성 차단)
 *   2) 최신 잔액 SELECT
 *   3) prev + delta 계산 — 음수면 거부
 *   4) INSERT (멱등성 unique 제약 위반시 already_applied 로 ok)
 *
 * 호출처는 RPC 의 결과를 그대로 반환받음 — 기존 호출 시그니처 호환.
 */
export async function appendLedger(
  supabase: SupabaseClient,
  input: AppendLedgerInput,
): Promise<{ ok: true; balanceAfter: number } | { ok: false; reason: string }> {
  const { data, error } = await supabase.rpc('apply_point_delta', {
    p_user_id: input.userId,
    p_delta: input.delta,
    p_reason: input.reason,
    p_reference_type: input.referenceType,
    p_reference_id: input.referenceId,
  })

  if (error) return { ok: false, reason: error.message }

  // RPC 는 TABLE(balance_after INT, ok BOOLEAN, message TEXT) 반환.
  // PostgREST 는 단일행 TABLE 도 array 로 직렬화 — 첫 row 추출.
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { ok: false, reason: 'rpc_returned_no_row' }

  if (row.ok === false) {
    return { ok: false, reason: row.message ?? '포인트 처리에 실패했어요' }
  }

  return { ok: true, balanceAfter: row.balance_after }
}

/**
 * 편의 wrapper — 적립만 하는 경우. "최소 1000P 부터 사용 가능" 같은 제약을
 * 여기서 걸어 볼까 했지만 reason 문구가 워낙 다양해서 호출처에 맡김.
 */
export async function creditPoints(
  supabase: SupabaseClient,
  input: Omit<AppendLedgerInput, 'delta'> & { amount: number },
) {
  if (input.amount <= 0) {
    return { ok: false as const, reason: '적립 금액은 양수여야 해요' }
  }
  return appendLedger(supabase, { ...input, delta: input.amount })
}

/**
 * 편의 wrapper — 차감만 하는 경우.
 *
 * audit #29: 이전엔 getCurrentBalance 로 사전 검증 후 RPC 호출 → 두 단계가
 * lock 밖이라 동시 debit 시 둘 다 통과 가능 (RPC 내부에서 두 번째는 음수
 * 잔액으로 거부). 사용자에게 보이는 메시지가 RPC 내부 에러로 새서 UX 깨짐.
 *
 * 새: 사전 read 제거 — RPC 의 advisory_lock + balance < 0 검증이 단일 진실.
 * RPC 가 음수 시 ok=false + "포인트 잔액이 부족해요" 메시지 반환 → 호출처는
 * 그대로 매핑.
 */
export async function debitPoints(
  supabase: SupabaseClient,
  input: Omit<AppendLedgerInput, 'delta'> & { amount: number },
) {
  if (input.amount <= 0) {
    return { ok: false as const, reason: '차감 금액은 양수여야 해요' }
  }
  return appendLedger(supabase, { ...input, delta: -input.amount })
}
