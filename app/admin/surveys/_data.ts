import type { SupabaseClient } from '@supabase/supabase-js'
import { pickSurveyFormula, surveyOrigin, type SurveyOrigin, type SurveyRowMeta, type AnalysisLike, type FormulaRowLike } from '@/lib/survey/labels'

/**
 * 설문 기록 데이터 조립 — surveys 를 축으로 dogs · profiles · analyses · dog_formulas ·
 * subscriptions 를 붙인다. service_role 로 읽는다(고객 간 조회). 규칙1: 모든 조회는
 * `{ data, error }` 를 꺼내고 실패는 "없음"으로 위장하지 않는다.
 */

export type SurveyDog = {
  id: string
  name: string
  breed: string | null
  weight: number | null
  age_value: number | null
  age_unit: 'years' | 'months' | null
  neutered: boolean | null
  gender: 'male' | 'female' | null
  prescription_diet: string | null
  photo_url: string | null
}

export type SurveyRecord = {
  id: string
  dog_id: string
  user_id: string
  created_at: string
  answers: unknown
  origin: SurveyOrigin
  meta: SurveyRowMeta
  dog: SurveyDog | null
  owner: { email: string | null; name: string | null } | null
  analysis: (AnalysisLike & { id: string; created_at: string }) | null
  /**
   * 이 설문으로 계산된 처방 — 이 설문 ~ 같은 강아지의 다음 설문 사이에 계산된 첫 처방('own').
   * 가장 최근 설문인데 자기 처방이 없으면 이전 설문의 처방을 표시('previous', 라벨 필수).
   * 다음 설문이 있는데 자기 처방이 없으면 null — 다음 설문의 박스를 이 설문 것처럼 그리지
   * 않는다(2026-10-01 로아: 간식 답이 다른 두 설문에 같은 박스가 떴다).
   */
  formula: (FormulaRowLike & { id: string }) | null
  formulaSource: 'own' | 'previous' | null
  /** 같은 강아지의 다음 설문 시각 — 이 설문으로 박스가 계산되지 않은 이유 안내용. */
  nextSurveyAt: string | null
  subscriptionStatus: string | null
}

type Loaded = { ok: true; records: SurveyRecord[] } | { ok: false; message: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>

export async function loadSurveyRecords(adminIn: SupabaseClient, onlyId?: string): Promise<Loaded> {
  const admin = adminIn as AnyClient
  let surveysQuery = admin
    .from('surveys')
    .select(
      'id, dog_id, user_id, created_at, answers, iris_stage, expected_adult_weight_kg, pregnancy_week, litter_size, current_medications, daily_walk_minutes, current_food_brand',
    )
    .order('created_at', { ascending: false })
    .limit(500)
  if (onlyId) surveysQuery = surveysQuery.eq('id', onlyId)
  const { data: surveys, error: sErr } = await surveysQuery
  if (sErr) return { ok: false, message: `설문을 불러오지 못했어요: ${sErr.message}` }
  const rows = (surveys ?? []) as Array<Record<string, unknown>>
  if (rows.length === 0) return { ok: true, records: [] }

  const dogIds = [...new Set(rows.map((r) => String(r.dog_id)))]
  const userIds = [...new Set(rows.map((r) => String(r.user_id)))]
  const surveyIds = rows.map((r) => String(r.id))

  const [dogsRes, profilesRes, analysesRes, formulasRes, subsRes, siblingsRes] = await Promise.all([
    admin.from('dogs').select('id, name, breed, weight, age_value, age_unit, neutered, gender, prescription_diet, photo_url').in('id', dogIds),
    admin.from('profiles').select('id, email, name').in('id', userIds),
    admin
      .from('analyses')
      .select('id, survey_id, dog_id, created_at, rer, mer, factor, factor_breakdown, feed_g, bcs_score, stage, protein_pct, fat_pct, carb_pct, risk_flags, vet_consult_recommended, supplements, next_review_date')
      .in('survey_id', surveyIds),
    admin
      .from('dog_formulas')
      .select('id, dog_id, cycle_number, formula, reasoning, daily_kcal, daily_grams, computed_at, algorithm_version, approval_status, user_adjusted')
      .in('dog_id', dogIds)
      .order('computed_at', { ascending: true }),
    admin.from('subscriptions').select('dog_id, status, created_at').in('dog_id', dogIds).order('created_at', { ascending: false }),
    // 같은 강아지의 모든 설문 시각 — 처방을 "어느 설문의 것인지" 가르는 경계. 상세(onlyId)는
    // 설문 한 건만 읽으므로 다음 설문을 여기서 따로 알아야 한다.
    admin.from('surveys').select('dog_id, created_at').in('dog_id', dogIds),
  ])
  for (const [label, res] of [['강아지', dogsRes], ['보호자', profilesRes], ['분석', analysesRes], ['처방', formulasRes], ['구독', subsRes], ['설문 순서', siblingsRes]] as const) {
    if (res.error) return { ok: false, message: `${label} 정보를 불러오지 못했어요: ${res.error.message}` }
  }

  const dogById = new Map<string, SurveyDog>()
  for (const d of (dogsRes.data ?? []) as Array<Record<string, unknown>>) {
    dogById.set(String(d.id), {
      id: String(d.id),
      name: String(d.name ?? ''),
      breed: (d.breed as string | null) ?? null,
      weight: d.weight == null ? null : Number(d.weight),
      age_value: (d.age_value as number | null) ?? null,
      age_unit: (d.age_unit as 'years' | 'months' | null) ?? null,
      neutered: (d.neutered as boolean | null) ?? null,
      gender: (d.gender as 'male' | 'female' | null) ?? null,
      prescription_diet: (d.prescription_diet as string | null) ?? null,
      photo_url: (d.photo_url as string | null) ?? null,
    })
  }
  const ownerById = new Map<string, { email: string | null; name: string | null }>()
  for (const p of (profilesRes.data ?? []) as Array<Record<string, unknown>>) {
    ownerById.set(String(p.id), { email: (p.email as string | null) ?? null, name: (p.name as string | null) ?? null })
  }
  const analysisBySurvey = new Map<string, SurveyRecord['analysis']>()
  for (const a of (analysesRes.data ?? []) as Array<Record<string, unknown>>) {
    const sid = a.survey_id == null ? null : String(a.survey_id)
    if (sid) analysisBySurvey.set(sid, a as unknown as SurveyRecord['analysis'])
  }
  const formulasByDog = new Map<string, Array<FormulaRowLike & { id: string; dog_id: string }>>()
  for (const f of (formulasRes.data ?? []) as Array<Record<string, unknown>>) {
    const did = String(f.dog_id)
    const list = formulasByDog.get(did) ?? []
    list.push(f as unknown as FormulaRowLike & { id: string; dog_id: string })
    formulasByDog.set(did, list)
  }
  const subByDog = new Map<string, string>()
  for (const s of (subsRes.data ?? []) as Array<Record<string, unknown>>) {
    const did = String(s.dog_id)
    // 최신순 정렬이라 먼저 본 것이 최신. 활성이 하나라도 있으면 활성 우선.
    const prev = subByDog.get(did)
    const st = String(s.status ?? '')
    if (!prev || (prev !== 'active' && st === 'active')) subByDog.set(did, st)
  }

  const surveyTimesByDog = new Map<string, number[]>()
  for (const s of (siblingsRes.data ?? []) as Array<Record<string, unknown>>) {
    const did = String(s.dog_id)
    const list = surveyTimesByDog.get(did) ?? []
    list.push(new Date(String(s.created_at)).getTime())
    surveyTimesByDog.set(did, list)
  }

  const records: SurveyRecord[] = rows.map((r) => {
    const dogId = String(r.dog_id)
    const createdMs = new Date(String(r.created_at)).getTime()
    const list = formulasByDog.get(dogId) ?? []
    // 다음 설문을 경계로 처방을 고른다 — 없으면 다음 설문의 박스가 이 카드에 붙는다(로아).
    const nextMs = (surveyTimesByDog.get(dogId) ?? []).filter((t) => t > createdMs).sort((a, b) => a - b)[0] ?? null
    const { formula, source } = pickSurveyFormula(list, createdMs, nextMs)
    const dog = dogById.get(dogId) ?? null
    return {
      id: String(r.id),
      dog_id: dogId,
      user_id: String(r.user_id),
      created_at: String(r.created_at),
      answers: r.answers,
      origin: surveyOrigin(r.answers),
      meta: {
        iris_stage: (r.iris_stage as number | null) ?? null,
        expected_adult_weight_kg: (r.expected_adult_weight_kg as number | string | null) ?? null,
        pregnancy_week: (r.pregnancy_week as number | null) ?? null,
        litter_size: (r.litter_size as number | null) ?? null,
        current_medications: (r.current_medications as string[] | null) ?? null,
        daily_walk_minutes: (r.daily_walk_minutes as number | null) ?? null,
        current_food_brand: (r.current_food_brand as string | null) ?? null,
        prescription_diet: dog?.prescription_diet ?? null,
      },
      dog,
      owner: ownerById.get(String(r.user_id)) ?? null,
      analysis: analysisBySurvey.get(String(r.id)) ?? null,
      formula: formula ? { ...formula } : null,
      formulaSource: source,
      nextSurveyAt: nextMs === null ? null : new Date(nextMs).toISOString(),
      subscriptionStatus: subByDog.get(dogId) ?? null,
    }
  })
  return { ok: true, records }
}

export function fmtKst(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function dogLine(d: SurveyDog | null): string {
  if (!d) return ''
  const parts: string[] = []
  if (d.breed) parts.push(d.breed)
  if (d.weight != null) parts.push(`${d.weight}kg`)
  if (d.age_value != null) parts.push(`${d.age_value}${d.age_unit === 'months' ? '개월' : '살'}`)
  if (d.gender) parts.push(d.gender === 'male' ? '남아' : '여아')
  if (d.neutered != null) parts.push(d.neutered ? '중성화' : '중성화 안 함')
  return parts.join(' · ')
}
