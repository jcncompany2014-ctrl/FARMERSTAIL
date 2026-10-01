/**
 * 결제 시점 조회 — 서버 전용(service_role). 판정은 lib/shipping-schedule chargeTimingFor(순수).
 *
 * # 왜 따로 두나 (2026-10-01 일정 변경)
 * 결제일이 고객마다 다르다: 일반 = 발송 3일 전 토요일(조리 직전), 서포터즈 100원·반값 구간 = 발송일(화).
 * getTrialState 는 조회 실패를 "체험 아님"(null)으로 접는다 — 금액엔 맞는 폴백이지만 **결제 요일**에 쓰면
 * 조회가 한 번 실패할 때 서포터즈 화면에 "토요일 결제"가 뜬다. 사장님 "정상가로 바뀔 때까지 서포터즈에게
 * 아무 알림도 띄우지 마". 그래서 여기서는 실패를 **null(모름)** 로 돌려주고, 화면은 모를 때 결제 요일을
 * 단정하지 않는다(발송일만 말한다).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import { chargeTimingFor, type ChargeTiming } from '@/lib/shipping-schedule'

/** 한 사용자의 결제 시점. 조회 실패 = null(모름). 체험 기록이 없으면 일반(before_cooking). */
export async function getChargeTiming(userId: string): Promise<ChargeTiming | null> {
  const map = await getChargeTimings([userId])
  return map ? (map.get(userId) ?? 'before_cooking') : null
}

/** 여러 사용자의 결제 시점. 조회 실패 = null(모름). 체험 기록이 없는 사용자는 일반으로 채운다. */
export async function getChargeTimings(userIds: string[]): Promise<Map<string, ChargeTiming> | null> {
  const out = new Map<string, ChargeTiming>()
  const ids = [...new Set(userIds.filter(Boolean))]
  if (ids.length === 0) return out
  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch {
    return null
  }
  const { data, error } = await supabase
    .from('subscription_trials')
    .select('user_id, cheap_remaining, half_remaining')
    .in('user_id', ids)
  if (error) {
    captureBusinessEvent('warning', 'billing.charge_timing.lookup_failed', {
      dbError: error.message,
      note: '결제 시점(서포터즈 체험 구간 여부) 조회 실패 — 화면은 결제 요일을 단정하지 않는다',
    })
    return null
  }
  for (const id of ids) out.set(id, chargeTimingFor(null))
  for (const r of (data ?? []) as Array<{ user_id: string; cheap_remaining: number; half_remaining: number }>) {
    out.set(r.user_id, chargeTimingFor(r))
  }
  return out
}
