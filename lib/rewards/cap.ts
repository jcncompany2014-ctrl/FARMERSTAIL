/**
 * Reward cap helper — abuse 차단.
 *
 * 설계 의도:
 *   - 설문/측정도구 업그레이드/사진 업로드 등 "행동 보상" 은 강아지를 추가
 *     등록하거나 다른 설문을 작성해 무한 적립이 가능했음 (점검 1-3, 1-4).
 *   - 계정당 연(年) 누적 보상을 ledger 에서 SUM 으로 합산해 cap 을 초과하면
 *     보상 호출 자체를 차단.
 *   - 상품 구매 리뷰처럼 "실 구매가 동반된" 보상은 cap 대상에서 제외 — 호출
 *     시 reference_type 화이트리스트로 분리.
 *
 * 한도 (KRW 환산 P, 1P=1원):
 *   - survey_completion:      연 5,000P  (5번의 설문)
 *   - measurement_upgrade:    연 3,000P  (3종 × 1회씩 정도)
 *   - photo_evidence_upload:  연 3,000P
 *   - 그 외:                   cap 없음 (구매/리뷰 등 실 구매 동반)
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type CappedReferenceType =
  | 'survey_completion'
  | 'measurement_upgrade'
  | 'photo_evidence_upload'

const ANNUAL_CAPS: Record<CappedReferenceType, number> = {
  survey_completion: 5_000,
  measurement_upgrade: 3_000,
  photo_evidence_upload: 3_000,
}

/**
 * 올해 누적된 해당 reference_type 의 양수 delta 합계.
 *
 * NB: balance_after 가 아니라 delta 의 합 — 환급/회수 row 와 섞이지 않도록
 * `delta > 0` 양수만 합산. created_at 은 KST 기준 연도로 자르려면 timezone
 * 캐스팅이 필요하지만 cap 운영 정확도가 ±몇 시간 정도면 충분해 UTC 1/1 기준.
 */
export async function annualEarnedFor(
  supabase: SupabaseClient,
  userId: string,
  referenceType: CappedReferenceType,
): Promise<number> {
  const startOfYear = new Date(
    Date.UTC(new Date().getUTCFullYear(), 0, 1),
  ).toISOString()

  const { data } = await supabase
    .from('point_ledger')
    .select('delta')
    .eq('user_id', userId)
    .eq('reference_type', referenceType)
    .gt('delta', 0)
    .gte('created_at', startOfYear)
    .limit(10_000)

  if (!data) return 0
  return data.reduce((sum, r) => sum + (r.delta ?? 0), 0)
}

/**
 * cap 확인 — 보상 적용 가능한 amount 를 반환. 한도를 이미 넘었으면 0.
 *
 * 사용 예:
 *   const allowed = await capAllowance(supabase, userId, 'survey_completion', 1000)
 *   if (allowed === 0) return { ok: false, reason: '올해 받을 수 있는 보상 한도에 도달했어요' }
 *   // allowed < requested 인 경우 — 부분 적립 (남은 한도만큼만)
 *   await appendLedger({ delta: allowed, ... })
 */
export async function capAllowance(
  supabase: SupabaseClient,
  userId: string,
  referenceType: CappedReferenceType,
  requested: number,
): Promise<number> {
  if (requested <= 0) return 0
  const cap = ANNUAL_CAPS[referenceType]
  const earned = await annualEarnedFor(supabase, userId, referenceType)
  const remaining = Math.max(0, cap - earned)
  return Math.min(requested, remaining)
}

export function annualCapFor(referenceType: CappedReferenceType): number {
  return ANNUAL_CAPS[referenceType]
}
