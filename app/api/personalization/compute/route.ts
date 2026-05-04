import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { zPersonalizationCompute } from '@/lib/api/schemas'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { decideFirstBox } from '@/lib/personalization/firstBox'
import type { AlgorithmInput, Formula } from '@/lib/personalization/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/personalization/compute
 *
 * 강아지 ID 받아 첫 박스 처방을 결정 + 저장 후 반환. cycle_number=1 의
 * dog_formulas row 가 이미 있으면 새로 계산 안 하고 그대로 반환 (idempotent
 * — 같은 분석 페이지를 여러 번 열어도 같은 처방).
 *
 * # 흐름
 *  1. auth + rate limit
 *  2. dogs row 로 user 소유 검증
 *  3. dog_formulas (cycle_number=1) 이미 있으면 그대로 반환
 *  4. 없으면 → 최신 surveys + analyses 조회
 *  5. AlgorithmInput 조립 → decideFirstBox()
 *  6. dog_formulas insert (UNIQUE 충돌은 다른 탭 동시 클릭 — race 처리)
 *  7. Formula JSON 반환
 *
 * # 보안
 *  - 본인 강아지만 (dogs.user_id = auth.uid())
 *  - rate limit 분당 10 (정상 페이지 진입은 1회면 충분, 새로고침 5번도 여유)
 *
 * # 에러
 *  - 401 UNAUTHORIZED
 *  - 404 DOG_NOT_FOUND
 *  - 400 NO_SURVEY (설문 안 받았거나 분석 미생성)
 *  - 500 DB_ERROR / COMPUTE_ERROR
 */
export async function POST(req: Request) {
  const rl = rateLimit({
    bucket: 'personalization-compute',
    key: ipFromRequest(req),
    limit: 10,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rl.headers },
    )
  }

  const parsed = await parseRequest(req, zPersonalizationCompute)
  if (!parsed.ok) return parsed.response
  const { dogId } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요합니다' },
      { status: 401 },
    )
  }

  // 1) 강아지 소유 검증 — RLS 가 한 번 더 거르지만 명시적 4xx 응답 위해 직접 확인.
  const { data: dog, error: dogErr } = await supabase
    .from('dogs')
    .select(
      'id, name, weight, age_value, age_unit, neutered, activity_level, breed',
    )
    .eq('id', dogId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (dogErr || !dog) {
    return NextResponse.json(
      { code: 'DOG_NOT_FOUND', message: '강아지를 찾을 수 없어요' },
      { status: 404 },
    )
  }

  // 2) 이미 cycle 1 처방이 있으면 그대로 반환 — 같은 결과를 매번 재계산할
  //    필요 없음. 출력이 deterministic 이라 안전.
  const { data: existing } = await supabase
    .from('dog_formulas')
    .select(
      'formula, reasoning, transition_strategy, algorithm_version, daily_kcal, daily_grams, user_adjusted, cycle_number',
    )
    .eq('dog_id', dogId)
    .eq('cycle_number', 1)
    .maybeSingle()
  if (existing) {
    const formula: Formula = {
      // 타입 단언 — DB 의 jsonb 는 unknown 으로 들어옴. 우리가 넣은 거라 형식 보장.
      lineRatios: (existing.formula as { lineRatios: Formula['lineRatios'] }).lineRatios,
      toppers: (existing.formula as { toppers: Formula['toppers'] }).toppers,
      reasoning: existing.reasoning as Formula['reasoning'],
      transitionStrategy: existing.transition_strategy as Formula['transitionStrategy'],
      dailyKcal: existing.daily_kcal,
      dailyGrams: existing.daily_grams,
      cycleNumber: existing.cycle_number,
      algorithmVersion: existing.algorithm_version,
      userAdjusted: existing.user_adjusted,
    }
    return NextResponse.json({ ok: true, formula, cached: true })
  }

  // 3) 최신 survey + analysis 조회 — 한 번에 쿼리.
  //
  // 새로 추가된 컬럼 (care_goal / home_cooking_experience 등) 은 supabase 의
  // 자동 생성 타입에 아직 없음 — 마이그레이션을 dashboard 에서 직접 적용하면
  // typegen 이 안 돌아서. 호출 결과를 명시적 SurveyRow 형태로 단언해 통과.
  // 추후 supabase CLI 셋업 + `supabase gen types` 돌리면 단언 제거 가능.
  type SurveyRow = {
    id: string
    answers: unknown
    chronic_conditions: string[] | null
    pregnancy_status: string | null
    care_goal: string | null
    home_cooking_experience: string | null
    current_diet_satisfaction: number | null
    weight_trend_6mo: string | null
    gi_sensitivity: string | null
    preferred_proteins: string[] | null
    indoor_activity: string | null
    daily_walk_minutes: number | null
    // v1.3 임상 정밀화 — 마이그레이션 20260504000000 에 추가됨.
    pregnancy_week: number | null
    litter_size: number | null
    expected_adult_weight_kg: number | null
    iris_stage: number | null
  }

  const [surveyResp, analysisResp] = await Promise.all([
    supabase
      .from('surveys')
      .select(
        'id, answers, chronic_conditions, pregnancy_status, care_goal, ' +
          'home_cooking_experience, current_diet_satisfaction, ' +
          'weight_trend_6mo, gi_sensitivity, preferred_proteins, indoor_activity, ' +
          'daily_walk_minutes, pregnancy_week, litter_size, ' +
          'expected_adult_weight_kg, iris_stage',
      )
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // analysis 는 survey 와 1:1 — 최신 survey id 모르니 dog_id 로 최신 1개.
    supabase
      .from('analyses')
      .select('mer, feed_g')
      .eq('dog_id', dogId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const survey = surveyResp.data as unknown as SurveyRow | null
  const analysis = analysisResp.data as unknown as {
    mer: number
    feed_g: number
  } | null

  if (!survey || !analysis) {
    return NextResponse.json(
      {
        code: 'NO_SURVEY',
        message: '설문과 분석이 먼저 필요해요',
      },
      { status: 400 },
    )
  }

  // 3.5) admin override fetch — algorithm_food_lines + breed_predispose.
  const [{ data: foodLineRows }, { data: breedRows }] = await Promise.all([
    supabase
      .from('algorithm_food_lines')
      .select(
        'line, kcal_per_100g, protein_pct_dm, fat_pct_dm, calcium_pct_dm, ' +
          'phosphorus_pct_dm, sodium_pct_dm, subtitle_override, benefit_override',
      ),
    supabase
      .from('algorithm_breed_predispose')
      .select(
        'breed_key, korean_label, breed_keywords, predispose_conditions, cautions',
      )
      .eq('enabled', true),
  ])

  const foodLineMetaOverride: AlgorithmInput['foodLineMetaOverride'] = {}
  // typegen 이 새 테이블 모름 — unknown 으로 캐스팅. 추후 supabase gen types 적용 시 제거.
  for (const r of ((foodLineRows ?? []) as unknown) as Array<{
    line: 'basic' | 'weight' | 'skin' | 'premium' | 'joint'
    kcal_per_100g: number
    protein_pct_dm: number
    fat_pct_dm: number
    calcium_pct_dm: number | null
    phosphorus_pct_dm: number | null
    sodium_pct_dm: number | null
    subtitle_override: string | null
    benefit_override: string | null
  }>) {
    foodLineMetaOverride[r.line] = {
      kcalPer100g: r.kcal_per_100g,
      proteinPctDM: r.protein_pct_dm,
      fatPctDM: r.fat_pct_dm,
      calciumPctDM: r.calcium_pct_dm,
      phosphorusPctDM: r.phosphorus_pct_dm,
      sodiumPctDM: r.sodium_pct_dm,
      subtitle: r.subtitle_override,
      benefit: r.benefit_override,
    }
  }

  // 4) AlgorithmInput 조립.
  const ageMonths =
    dog.age_unit === 'years' ? dog.age_value * 12 : dog.age_value
  // answers JSONB 의 bcsExact 가 5점 척도 BCS. 없으면 null.
  const answers =
    (survey.answers as { bcsExact?: number; allergies?: string[] }) ?? {}
  const bcs =
    typeof answers.bcsExact === 'number' &&
    answers.bcsExact >= 1 &&
    answers.bcsExact <= 9
      ? (answers.bcsExact as AlgorithmInput['bcs'])
      : null

  const input: AlgorithmInput = {
    dogId: dog.id,
    dogName: dog.name,
    ageMonths,
    weightKg: dog.weight,
    neutered: dog.neutered,
    activityLevel: dog.activity_level,
    bcs,
    allergies: Array.isArray(answers.allergies) ? answers.allergies : [],
    chronicConditions: Array.isArray(survey.chronic_conditions)
      ? survey.chronic_conditions
      : [],
    pregnancy: (survey.pregnancy_status as AlgorithmInput['pregnancy']) ?? null,
    careGoal: (survey.care_goal as AlgorithmInput['careGoal']) ?? null,
    homeCookingExperience:
      (survey.home_cooking_experience as AlgorithmInput['homeCookingExperience']) ??
      null,
    currentDietSatisfaction:
      (survey.current_diet_satisfaction as AlgorithmInput['currentDietSatisfaction']) ??
      null,
    weightTrend6mo:
      (survey.weight_trend_6mo as AlgorithmInput['weightTrend6mo']) ?? null,
    giSensitivity:
      (survey.gi_sensitivity as AlgorithmInput['giSensitivity']) ?? null,
    preferredProteins: Array.isArray(survey.preferred_proteins)
      ? survey.preferred_proteins
      : [],
    indoorActivity:
      (survey.indoor_activity as AlgorithmInput['indoorActivity']) ?? null,
    dailyWalkMinutes: survey.daily_walk_minutes ?? null,
    pregnancyWeek: survey.pregnancy_week ?? null,
    litterSize: survey.litter_size ?? null,
    expectedAdultWeightKg: survey.expected_adult_weight_kg ?? null,
    irisStage:
      (survey.iris_stage as AlgorithmInput['irisStage']) ?? null,
    breed: (dog as { breed?: string | null }).breed ?? null,
    breedPredisposeMap: ((breedRows ?? []) as unknown as Array<{
      breed_key: string
      korean_label: string
      breed_keywords: string[]
      predispose_conditions: string[]
      cautions: string[]
    }>).map((r) => ({
      breedKey: r.breed_key,
      koreanLabel: r.korean_label,
      breedKeywords: r.breed_keywords,
      predisposeConditions: r.predispose_conditions,
      cautions: r.cautions,
    })),
    foodLineMetaOverride: Object.keys(foodLineMetaOverride).length
      ? foodLineMetaOverride
      : undefined,
    dailyKcal: analysis.mer,
    dailyGrams: analysis.feed_g,
  }

  // 5) 알고리즘 실행 — pure function, throw 안 함.
  const formula = decideFirstBox(input)

  // 6) Persist — UNIQUE (dog_id, cycle_number) 충돌 시 race condition (다른 탭).
  //    select 한 번 더 해서 그쪽 결과 반환. 사용자 입장 idempotent.
  const { error: insErr } = await supabase.from('dog_formulas').insert({
    dog_id: dogId,
    user_id: user.id,
    cycle_number: 1,
    formula: {
      lineRatios: formula.lineRatios,
      toppers: formula.toppers,
    },
    reasoning: formula.reasoning,
    transition_strategy: formula.transitionStrategy,
    algorithm_version: formula.algorithmVersion,
    user_adjusted: false,
    daily_kcal: formula.dailyKcal,
    daily_grams: formula.dailyGrams,
  })

  if (insErr) {
    // 23505 = unique violation. 이미 누가 만들었으니 select.
    if ((insErr as unknown as { code?: string }).code === '23505') {
      const { data: raced } = await supabase
        .from('dog_formulas')
        .select(
          'formula, reasoning, transition_strategy, algorithm_version, daily_kcal, daily_grams, user_adjusted, cycle_number',
        )
        .eq('dog_id', dogId)
        .eq('cycle_number', 1)
        .maybeSingle()
      if (raced) {
        return NextResponse.json({
          ok: true,
          formula,
          cached: true,
          raced: true,
        })
      }
    }
    return NextResponse.json(
      { code: 'DB_ERROR', message: insErr.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, formula, cached: false })
}
