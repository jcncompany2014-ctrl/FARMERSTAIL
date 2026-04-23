/**
 * Farmer's Tail — 포인트 ledger 헬퍼.
 *
 * 현재 구조: `point_ledger` 테이블에 append-only 로그. 각 row는 {delta,
 * balance_after, reason, reference_*}. 최신 row의 balance_after가 현재 잔액.
 *
 * 이 패턴은 단순하지만 **동시성 위험**이 있다. 두 요청이 동시에 최신 balance를
 * 읽으면 같은 balance_after를 계산해서 두 row를 insert할 수 있다. D2C 규모와
 * user-scoped 사용 패턴(한 유저가 동시 결제/환불 요청을 보내는 경우가 거의 없음)
 * 에서는 사실상 발생 확률이 낮지만, 이상적으로는 Postgres 함수로 SELECT + INSERT
 * 를 트랜잭션으로 감싸는 RPC 마이그레이션으로 이관해야 한다. 이 파일은 그때까지
 * 의 중간 정류장 — 최소한 모든 호출처가 **같은 읽기-쓰기 패턴** 을 공유하도록.
 *
 * 미래 작업 (out of scope):
 *   - `CREATE FUNCTION apply_point_delta(uuid, int, text, text, uuid)` RPC 추가.
 *   - 이 파일의 appendLedger를 RPC 호출로 교체.
 *   - point_ledger에 (user_id, reference_id, reference_type) unique
 *     partial index를 걸어 "같은 주문에 대한 같은 종류 적립이 두 번" 일어나는
 *     멱등성 버그를 방어.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

/** ledger에 기록되는 참조 타입. 문자열 enum이 DB 컬럼 값과 일치해야 함. */
export type PointReferenceType =
  | 'order'
  | 'order_refund'
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
 * ledger에 항목을 추가하고 balance_after를 자동 계산. 성공 시 새 잔액 반환.
 *
 * 포인트가 음수로 떨어지지는 않도록 방어 — delta가 음수이고 현재 잔액보다 크면
 * 호출처가 보통 미리 막지만, 여기서도 최종 방어선으로 보정하지는 않고 **그대로
 * 음수 balance_after 를 기록** 한다. 음수 잔액이 나왔다는 것 자체가 버그
 * 신호이므로 조용히 보정하면 debug가 어렵다. 호출처가 사전 차단하는 게 정답.
 */
export async function appendLedger(
  supabase: SupabaseClient,
  input: AppendLedgerInput,
): Promise<{ ok: true; balanceAfter: number } | { ok: false; reason: string }> {
  const prev = await getCurrentBalance(supabase, input.userId)
  const next = prev + input.delta
  const { error } = await supabase.from('point_ledger').insert({
    user_id: input.userId,
    delta: input.delta,
    balance_after: next,
    reason: input.reason,
    reference_type: input.referenceType,
    reference_id: input.referenceId,
  })
  if (error) return { ok: false, reason: error.message }
  return { ok: true, balanceAfter: next }
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
 * 편의 wrapper — 차감만 하는 경우. 현재 잔액을 미리 확인해 부족하면 실패.
 */
export async function debitPoints(
  supabase: SupabaseClient,
  input: Omit<AppendLedgerInput, 'delta'> & { amount: number },
) {
  if (input.amount <= 0) {
    return { ok: false as const, reason: '차감 금액은 양수여야 해요' }
  }
  const balance = await getCurrentBalance(supabase, input.userId)
  if (balance < input.amount) {
    return { ok: false as const, reason: '포인트 잔액이 부족해요' }
  }
  return appendLedger(supabase, { ...input, delta: -input.amount })
}
