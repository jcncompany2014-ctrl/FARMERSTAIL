/**
 * 강아지별 **최신 설문 알레르기 → 막힌 라인** — 박스 계산(computeBoxItems·priceForFormula·quoteBox)에 넘기는 값.
 *
 * # 왜 (2026-10-13 점검 E1)
 * 박스 계산이 알레르기를 몰라서, 판매 중지 레시피를 대체(치킨↔오리, 그 외→오리)할 때 알레르기 레시피로 옮길 수 있었다.
 * 이제 computeBoxItems 는 blockedLines 를 **필수**로 받는다. 서버 호출처(주문 신청·승인·피킹·청구 대조·화식 비율 변경)는
 * 여기서 같은 규칙(정본 skuMap.blockedLinesForAllergies)으로 만든다 — 호출처마다 따로 짜면 또 갈라진다.
 *
 * 조회 실패는 '알레르기 없음'이 아니다(AGENTS 규칙1) — ok:false 를 돌려주고 호출처가 멈추거나 건너뛴다.
 * 클라이언트 종류는 묻지 않는다: 크론은 service_role 을, 고객 라우트는 쿠키 클라이언트(소유 확인 뒤)를 넘긴다(규칙8).
 */
import type { FoodLine } from './types.ts'
import { blockedLinesForAllergies } from './skuMap.ts'

/** surveys 한 행에서 쓰는 부분. */
export type SurveyAllergyRow = {
  dog_id: string
  answers: unknown
  created_at?: string | null
}

/** 설문 answers(jsonb) → 알레르기 라벨 배열. 모양이 이상하면 빈 배열. */
export function allergiesFromAnswers(answers: unknown): string[] {
  const raw = (answers as { allergies?: unknown } | null)?.allergies
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
}

/**
 * 설문 행들(강아지 여러 마리 섞여도 됨) → 강아지별 **최신** 설문의 막힌 라인.
 * created_at 내림차순으로 정렬해 첫 행을 쓴다 — 호출처 정렬에 기대지 않는다.
 * 설문이 없는 강아지는 맵에 없다(= 막힌 라인 없음).
 */
export function blockedLinesByDogFromSurveys(
  rows: readonly SurveyAllergyRow[],
): Map<string, FoodLine[]> {
  const sorted = [...rows].sort(
    (a, b) => Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? ''),
  )
  const out = new Map<string, FoodLine[]>()
  for (const r of sorted) {
    if (!r.dog_id || out.has(r.dog_id)) continue
    out.set(r.dog_id, blockedLinesForAllergies(allergiesFromAnswers(r.answers)))
  }
  return out
}

type SurveyReader = {
  from: (table: 'surveys') => {
    select: (cols: string) => {
      in: (col: 'dog_id', ids: string[]) => {
        order: (
          col: 'created_at',
          opts: { ascending: boolean },
        ) => PromiseLike<{ data: unknown; error: { message: string } | null }>
      }
    }
  }
}

export type BlockedLinesLookup =
  | { ok: true; byDog: Map<string, FoodLine[]> }
  | { ok: false; error: string }

/** 강아지 여러 마리의 막힌 라인을 한 번에. 실패면 ok:false(규칙1). */
export async function loadBlockedLinesByDog(
  supabase: unknown,
  dogIds: readonly string[],
): Promise<BlockedLinesLookup> {
  const ids = [...new Set(dogIds.filter(Boolean))]
  if (ids.length === 0) return { ok: true, byDog: new Map() }
  const { data, error } = await (supabase as SurveyReader)
    .from('surveys')
    .select('dog_id, answers, created_at')
    .in('dog_id', ids)
    .order('created_at', { ascending: false })
  if (error) return { ok: false, error: error.message }
  return { ok: true, byDog: blockedLinesByDogFromSurveys((data ?? []) as SurveyAllergyRow[]) }
}

/** 한 마리. 실패면 ok:false(규칙1). */
export async function loadDogBlockedLines(
  supabase: unknown,
  dogId: string,
): Promise<{ ok: true; blockedLines: FoodLine[] } | { ok: false; error: string }> {
  const r = await loadBlockedLinesByDog(supabase, [dogId])
  if (!r.ok) return r
  return { ok: true, blockedLines: r.byDog.get(dogId) ?? [] }
}
