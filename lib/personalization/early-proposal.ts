/**
 * 새 식단 제안 앞당기기 — 재제안 크론이 읽는 요청(formula_proposal_requests, 2026-10-14 C5, 규칙258).
 *
 * # 왜
 * 어드민이 고객 말(카톡)을 듣고 알레르기를 고치면(관리자 수정 설문 행) 박스 계산은 바로 그 값을 읽는다 — 지금 식단에 새
 * 알레르기 레시피가 있으면 포장 목록이 그 박스를 '알레르기 확인 필요 — 보내지 마세요'로 멈춘다. 레시피·금액을 바꾸려면
 * 고객 동의가 필요하고(금액 변경 동의 모달·3일 타임아웃), 그 제안을 만드는 곳은 재제안 크론 하나다. 크론은 박스 3개마다만
 * 제안하므로, 이 요청이 있는 강아지는 박스 수를 기다리지 않고 다음 실행에서 같은 경로로 제안을 만든다.
 * 어드민은 식단·금액을 계산하지도 쓰지도 않는다 — 크론의 정본 경로를 그대로 탄다.
 *
 * 요청은 7일까지만 유효하다(그 사이 크론이 꺼져 있었으면 다시 눌러야 한다 — 오래된 요청이 엉뚱한 때 제안을 만들지 않게).
 * 조회 실패면 ok:false — 크론은 앞당김만 건너뛰고 정기 재제안은 그대로 돈다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, 'public', any>

export const EARLY_PROPOSAL_TTL_DAYS = 7

export type EarlyProposalLookup =
  | { ok: true; byDog: Map<string, string[]> }
  | { ok: false; error: string }

/** 아직 처리 안 된(7일 안) 요청 — 강아지별 요청 id 들. */
export async function loadEarlyProposalRequests(
  supabase: AnyClient,
  now: Date = new Date(),
): Promise<EarlyProposalLookup> {
  const since = new Date(now.getTime() - EARLY_PROPOSAL_TTL_DAYS * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('formula_proposal_requests')
    .select('id, dog_id')
    .is('processed_at', null)
    .gte('requested_at', since)
    .limit(200)
  if (error) return { ok: false, error: error.message }
  const byDog = new Map<string, string[]>()
  for (const r of (data ?? []) as Array<{ id: string; dog_id: string }>) {
    const list = byDog.get(r.dog_id) ?? []
    list.push(r.id)
    byDog.set(r.dog_id, list)
  }
  return { ok: true, byDog }
}

/** 앞당김 요청이 있는 강아지를 앞으로 — 한 번에 처리하는 수(MAX_PER_RUN)에 밀려 빠지지 않게. 순서는 그 외 그대로. */
export function earlyFirst(dogIds: readonly string[], early: ReadonlySet<string>): string[] {
  return [...dogIds.filter((d) => early.has(d)), ...dogIds.filter((d) => !early.has(d))]
}

/** 크론이 살펴본 요청을 닫는다 — 제안을 만든 강아지는 proposed, 나머지(승인 대기 중·구독 아님 등)는 not_proposed. */
export async function closeEarlyProposalRequests(
  supabase: AnyClient,
  byDog: ReadonlyMap<string, readonly string[]>,
  proposedDogIds: ReadonlySet<string>,
): Promise<{ error: string | null }> {
  const proposed: string[] = []
  const notProposed: string[] = []
  for (const [dogId, ids] of byDog) (proposedDogIds.has(dogId) ? proposed : notProposed).push(...ids)
  const at = new Date().toISOString()
  for (const [ids, outcome] of [
    [proposed, 'proposed'],
    [notProposed, 'not_proposed'],
  ] as const) {
    if (ids.length === 0) continue
    const { error } = await supabase
      .from('formula_proposal_requests')
      .update({ processed_at: at, outcome })
      .in('id', ids)
      .is('processed_at', null)
    if (error) return { error: error.message }
  }
  return { error: null }
}
