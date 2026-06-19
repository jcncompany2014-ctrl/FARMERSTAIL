// 트랙B B5-1b — 익명 설문 초안(localStorage) → 계정 이관.
//
// 이메일확인 ON: 메일 인증 후 **첫 로그인** 시 호출(login handleLogin 훅 = B5-2).
// 이 시점 세션 존재(방금 로그인). saveAndGoResult(SurveyClient 574-730)의
// dogs/surveys/analyses 생성을 mirror하되, 익명이라 dogs INSERT가 선행한다.
// dogInfo/answers 는 draftToNutritionInput(공유) 사용 → 사용자가 본 티저 수치 = 저장 분석.
//
// ★멱등: user 에 dog 이 이미 있으면 그 id 반환·스킵(중복 이관/추가 강아지 충돌 방지).
// ★전체 성공(dog+survey+analysis) 시에만 dogId 반환 — 호출측이 그때만 draft clear + /analysis 이동.
// 부분 실패 → null(orphan dog 가능 = R6, RLS-authed insert 실패는 드묾. 후속 보강 여지).

import { createClient } from '@/lib/supabase/client'
import { calculateNutrition, getSupplements } from '@/lib/nutrition'
import { draftToNutritionInput } from '@/lib/start-teaser'
import { isDogDraftComplete, type AutosignupDraft } from '@/lib/autosignup-draft'

// 라이트 건강 관심사 키 → saveAndGoResult legacyHealthConcerns 한글 라벨(보충제 매핑).
const HEALTH_KR: Record<string, string> = {
  joint: '관절', skin: '피부/털', digest: '소화', dental: '치아', weight: '체중',
}

/**
 * 초안 → 계정 이관. 전체 성공 시 dogId, 실패/불완전 시 null.
 * @param userId 방금 로그인한 사용자 id (RLS user_id)
 */
export async function applyAutosignupDraft(
  userId: string,
  draft: AutosignupDraft,
): Promise<string | null> {
  const dog = draft.dog
  if (!isDogDraftComplete(dog)) return null
  const m = draftToNutritionInput(draft)
  if (!m) return null

  const supabase = createClient()

  // ① 멱등 가드 — 이미 dog 있으면(이관 완료/수동 등록) 그 id 반환·재이관 스킵.
  try {
    const { data: existing } = await supabase
      .from('dogs')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    if (existing?.id) return existing.id as string
  } catch {
    /* 조회 실패는 아래 INSERT 가 권위 — 진행 */
  }

  // ② dogs INSERT (NewDogClient 필드. 측정 도구는 라이트라 'unknown'/오늘).
  const nowIso = new Date().toISOString()
  const { data: inserted, error: dogErr } = await supabase
    .from('dogs')
    .insert({
      user_id: userId,
      name: (dog.name || '').trim(),
      breed: dog.breed!,
      gender: dog.gender as 'male' | 'female',
      neutered: dog.neutered === true,
      age_value: parseInt(dog.ageValue!, 10),
      age_unit: dog.ageUnit as 'years' | 'months',
      weight: parseFloat(dog.weight!),
      activity_level: dog.activityLevel as 'low' | 'medium' | 'high',
      weight_method: 'unknown',
      weight_measured_at: nowIso,
      activity_method: 'unknown',
      feed_method: 'unknown',
    })
    .select('id')
    .single()
  if (dogErr || !inserted) return null
  const dogId = (inserted as { id: string }).id

  // ③ surveys INSERT (saveAndGoResult 컬럼 mirror — 임상 필드는 라이트라 null/기본).
  //    budget_tier 등 typegen 미반영 컬럼 → saveAndGoResult 동일 cast 패턴.
  const surveyPayload = {
    dog_id: dogId,
    user_id: userId,
    answers: m.answers,
    mcs_score: null,
    bristol_stool_score: null,
    chronic_conditions: [] as string[],
    current_medications: [] as string[],
    current_food_brand: null,
    daily_walk_minutes: null,
    coat_condition: null,
    appetite: m.answers.appetite ?? null,
    pregnancy_status: null,
    care_goal: null,
    home_cooking_experience: null,
    current_diet_satisfaction: null,
    weight_trend_6mo: null,
    gi_sensitivity: null,
    preferred_proteins: [] as string[],
    indoor_activity: null,
    iris_stage: null,
    pregnancy_week: null,
    litter_size: null,
    expected_adult_weight_kg: null,
    budget_tier: null,
  }
  const { data: surveyData, error: surveyErr } = await (
    supabase.from('surveys') as unknown as {
      insert: (v: typeof surveyPayload) => {
        select: () => {
          single: () => Promise<{
            data: { id: string } | null
            error: { message?: string } | null
          }>
        }
      }
    }
  )
    .insert(surveyPayload)
    .select()
    .single()
  if (surveyErr || !surveyData) return null

  // ④ 영양 계산(티저와 동일 입력) + 보충제(건강 관심사 한글 라벨).
  const nu = calculateNutrition(m.dogInfo, m.answers)
  const healthKr = m.health.map((h) => HEALTH_KR[h]).filter((x): x is string => !!x)
  const supps = Array.from(new Set(getSupplements(healthKr).map((s) => s.name)))
  const nextReview = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 10)

  // ⑤ analyses INSERT (saveAndGoResult 704-730 컬럼 1:1).
  const { error: analysisErr } = await supabase.from('analyses').insert({
    dog_id: dogId,
    survey_id: surveyData.id,
    user_id: userId,
    rer: nu.rer,
    mer: nu.mer,
    factor: nu.factor,
    stage: nu.stageKR,
    bcs_label: nu.bcs.label,
    bcs_score: nu.bcs.score,
    protein_pct: nu.protein.pct,
    protein_g: nu.protein.g,
    fat_pct: nu.fat.pct,
    fat_g: nu.fat.g,
    carb_pct: nu.carb.pct,
    carb_g: nu.carb.g,
    fiber_pct: nu.fiber.pct,
    fiber_g: nu.fiber.g,
    feed_g: nu.feedG,
    micronutrients: nu.micro,
    ca_p_ratio: parseFloat(nu.caPRatio),
    supplements: supps,
    risk_flags: nu.riskFlags,
    vet_consult_recommended: nu.vetConsult,
    next_review_date: nextReview,
    guideline_version: nu.guidelineVersion,
  })
  if (analysisErr) return null

  return dogId
}
