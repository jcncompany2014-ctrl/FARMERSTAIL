/**
 * 체험 상태 조회 — 서버 전용(service_role). 판정 순수함수는 lib/payments/trial.ts.
 * (분리 이유: node --test 는 @/ 별칭을 못 읽는다 — promotions.ts 무-import 관례와 동일)
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import type { TrialState } from './trial'

/**
 * 체험 상태 조회 — service_role. 조회 실패는 "체험 아님"으로 접되 반드시 남긴다
 * (auto-discount 의 안전 폴백 원칙: 실패를 할인 대상으로 오해하지 않는다.
 *  단 체험단은 정가 청구가 나가면 100원 약속이 깨지므로 이벤트로 즉시 보인다).
 */
export async function getTrialState(userId: string): Promise<TrialState | null> {
  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch {
    return null
  }
  const { data, error } = await supabase
    .from('subscription_trials')
    .select('cheap_remaining, half_remaining, cheap_price, half_rate')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    captureBusinessEvent('error', 'billing.trial.lookup_failed', {
      userId,
      dbError: error.message,
      note: '체험단 조회 실패 — 이번 청구가 정가로 나갔을 수 있음. 확인 필요.',
    })
    return null
  }
  return (data as TrialState | null) ?? null
}
