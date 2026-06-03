import type { Formula } from './types'

/**
 * formulaCache — 첫 박스(cycle 1) 처방 fetch 의 단일화 레이어.
 *
 * # 왜
 * 분석 페이지에서 AnalysisView 와 (Magazine 안의) RecommendationBox 가
 * 각각 마운트되며 같은 강아지에 대해 POST /api/personalization/compute 를
 * 독립적으로 호출했다 (audit P0: double-compute). compute 라우트는 항상
 * cycle_number=1 처방을 read-or-create 하므로 두 호출 결과가 완전히 동일 —
 * 순수 중복이다.
 *
 * # 어떻게
 * (dogId, cycleNumber) 키로 in-flight promise 를 공유하고, 완료 후 짧은
 * TTL 동안 결과를 캐시한다. 두 컴포넌트의 상태 머신(loading/ready/error/
 * no_survey)은 그대로 두고 네트워크 요청만 1회로 합친다 — 리스크 최소.
 *
 * AdjustSheet 로 비율을 조정하면 dog_formulas 가 갱신되므로
 * invalidateComputedFormula 로 캐시를 비워 다음 마운트가 새 처방을 받게 한다.
 */

export type ComputeResponse =
  | { ok: true; formula: Formula }
  | { ok?: false; code?: string; message?: string }

export type ComputeResult = { httpOk: boolean; body: ComputeResponse }

type Entry = { at: number; value: ComputeResult }

const TTL_MS = 30_000
const inflight = new Map<string, Promise<ComputeResult>>()
const cache = new Map<string, Entry>()

function keyOf(dogId: string, cycleNumber: number): string {
  return `${dogId}:${cycleNumber}`
}

/**
 * 단일 fetch. 같은 (dogId, cycleNumber) 동시 호출은 같은 promise 를 공유하고,
 * 성공 결과는 TTL_MS 동안 캐시한다. 네트워크 오류는 reject (호출부 try/catch).
 */
export function fetchComputedFormula(
  dogId: string,
  cycleNumber = 1,
): Promise<ComputeResult> {
  const key = keyOf(dogId, cycleNumber)

  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) {
    return Promise.resolve(hit.value)
  }

  const existing = inflight.get(key)
  if (existing) return existing

  const p = (async (): Promise<ComputeResult> => {
    const res = await fetch('/api/personalization/compute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dogId, cycleNumber }),
    })
    const body = (await res.json().catch(() => ({}))) as ComputeResponse
    const value: ComputeResult = { httpOk: res.ok, body }
    // 성공/실패 응답 모두 캐시 (no_survey 같은 결정적 결과도 재호출 불필요).
    // 단 네트워크 throw 는 캐시하지 않음 (아래 async 밖으로 전파).
    cache.set(key, { at: Date.now(), value })
    return value
  })().finally(() => {
    inflight.delete(key)
  })

  inflight.set(key, p)
  return p
}

/** AdjustSheet 등으로 처방이 바뀌면 호출 — 다음 fetch 가 새 결과를 받도록. */
export function invalidateComputedFormula(dogId: string, cycleNumber = 1): void {
  cache.delete(keyOf(dogId, cycleNumber))
}
