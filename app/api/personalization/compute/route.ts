import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { zPersonalizationCompute } from '@/lib/api/schemas'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { decideFirstBox } from '@/lib/personalization/firstBox'
import { treatCalorieFraction } from '@/lib/nutrition'
import {
  dailyGramsFromMix,
  FOOD_LINE_META,
  ALL_LINES,
} from '@/lib/personalization/lines'
import { collapseToSingle } from '@/lib/personalization/boxComposition'
import {
  deriveAvailableLines,
  deriveAvailableToppers,
  gateAvailability,
  LINE_TO_SLUG,
  TOPPER_TO_SLUG,
} from '@/lib/personalization/skuMap'
import { SKU_MODEL, LEGACY_LINE_TO_PROTEIN } from '@/lib/personalization/skuModel'
import type { AlgorithmInput, Formula } from '@/lib/personalization/types'
import {
  buildV3Recommendation,
  v3PicksToLineRatios,
} from '@/lib/personalization/v3/integrate'
import type { RecommendationResult } from '@/lib/personalization/v3/types'
import type { V3SourceInput } from '@/lib/personalization/v3/profile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 레거시(또는 v3 이전 생성) cycle-1 formula 에 v3 가 없을 때, survey + analysis
 * 를 다시 읽어 v3 를 **lazy 백필**(재계산)하는 best-effort 헬퍼.
 *
 * Q2 결정("재계산, 마이그레이션 X")에 부합 — 옛 formula 를 일괄 변환하지 않고,
 * 분석 페이지를 다시 열 때 그 강아지의 v3 만 그 자리에서 채운다. v3 만 읽는
 * slim 입력(V3SourceInput)이라 v2 전체 입력 재조립이 불필요. 실패/데이터 없음
 * 이면 null(표시 측이 카드 숨김) — 라이브 v2 에 영향 없음.
 */
async function backfillV3(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  dog: {
    id: string
    weight: number | null
    age_value: number | null
    age_unit: string | null
    activity_level: string | null
  },
): Promise<RecommendationResult | null> {
  const [surveyResp, analysisResp] = await Promise.all([
    supabase
      .from('surveys')
      .select('answers, chronic_conditions, care_goal, gi_sensitivity')
      .eq('dog_id', dog.id)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('analyses')
      .select('mer')
      .eq('dog_id', dog.id)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  const survey = surveyResp.data as unknown as {
    answers: unknown
    chronic_conditions: string[] | null
    care_goal: string | null
    gi_sensitivity: string | null
  } | null
  const analysis = analysisResp.data as unknown as { mer: number } | null
  if (!survey || !analysis) return null

  const answers =
    (survey.answers as {
      bcsExact?: number
      allergies?: string[]
      snackFreq?: string
      appetite?: string
    }) ?? {}
  const ageMonths =
    dog.age_unit === 'years' ? (dog.age_value ?? 0) * 12 : dog.age_value ?? 0
  const bcs =
    typeof answers.bcsExact === 'number' &&
    answers.bcsExact >= 1 &&
    answers.bcsExact <= 9
      ? (answers.bcsExact as V3SourceInput['bcs'])
      : null

  // v3 베이스 4종 slug 중 활성 제품 — 게이트 입력.
  const { data: activeProd } = await supabase
    .from('products')
    .select('slug')
    .eq('is_active', true)
    .in('slug', ['chicken-basic', 'duck-weight', 'pork-joint', 'beef-premium'])
  const activeSlugs = ((activeProd ?? []) as Array<{ slug: string }>).map(
    (p) => p.slug,
  )

  const v3Input: V3SourceInput = {
    careGoal: (survey.care_goal as V3SourceInput['careGoal']) ?? null,
    bcs,
    allergies: Array.isArray(answers.allergies) ? answers.allergies : [],
    activityLevel:
      (dog.activity_level as 'low' | 'medium' | 'high' | null) ?? 'medium',
    ageMonths,
    weightKg: dog.weight ?? 0,
    chronicConditions: Array.isArray(survey.chronic_conditions)
      ? survey.chronic_conditions
      : [],
    giSensitivity:
      (survey.gi_sensitivity as V3SourceInput['giSensitivity']) ?? null,
    dailyKcal: analysis.mer,
    treatReductionPct: treatCalorieFraction(answers.snackFreq),
  }
  return buildV3Recommendation(v3Input, {
    appetite: answers.appetite,
    activeSlugs,
  })
}

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
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
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
      'formula, reasoning, transition_strategy, algorithm_version, daily_kcal, daily_grams, user_adjusted, cycle_number, created_at',
    )
    .eq('dog_id', dogId)
    .eq('cycle_number', 1)
    .maybeSingle()
  if (existing) {
    // 점검 high(임상 안전): 재설문/재분석으로 더 새로운 analysis 가 생기면 이
    // cycle-1 formula 는 stale 이다 — 옛 알레르기 게이팅·체중·비율을 그대로 캐시
    // 반환하면 새 알레르기가 박스 처방에 반영되지 않는다. 최신 analysis 가
    // formula 보다 새로우면 캐시를 무효화하고 아래에서 재계산(삭제 후 재삽입).
    const { data: latestAna } = await supabase
      .from('analyses')
      .select('created_at')
      .eq('dog_id', dogId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const formulaAt = existing.created_at
      ? new Date(existing.created_at as string).getTime()
      : 0
    const analysisAt = latestAna?.created_at
      ? new Date(latestAna.created_at as string).getTime()
      : 0
    const isStale = analysisAt > formulaAt

    if (isStale) {
      // 아래 재계산 경로가 새 analysis 기준으로 다시 만들어 **덮어쓴다**(upsert).
      // (user_adjusted 도 새 분석이 기준이므로 재계산 — 임상 안전 우선.)
      //
      // ⚠️ 여기서 delete 하면 안 된다 — dog_formulas 에는 DELETE RLS 정책이 없어
      //    사용자 클라이언트의 delete 는 **에러 없이 0행**이 된다(2026-07-15 발견).
      //    그래서 옛 행이 남고 → 아래 insert 가 unique(dog_id,cycle_number) 위반 →
      //    23505 를 '경쟁 삽입'으로 오해해 ok 를 반환 → **API 는 새 처방을 주는데
      //    테이블엔 낡은 처방이 영구히 남았다.** 화면(분석·플랜)은 compute 응답을,
      //    /order·개요·admin 피킹 리스트는 테이블을 읽으니 같은 강아지인데 레시피가
      //    서로 달랐다(사장님 "닭으로 추천받았는데 배송 정보엔 오리랑 소").
      //    피킹 리스트가 낡은 값을 보면 **실제로 다른 음식을 포장**하게 된다.
    } else {
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
    // v3 추천(shadow) — formula jsonb 에 같이 저장돼 있으면 반환.
    let v3 = (existing.formula as { v3?: RecommendationResult }).v3 ?? null
    // 레거시 row(v3 이전 생성)면 lazy 백필(재계산) — 그 자리에서 v3 채우고 저장.
    // best-effort: 실패해도 v3=null 로 두고 라이브엔 무영향.
    if (!v3) {
      try {
        v3 = await backfillV3(supabase, user.id, dog)
        if (v3) {
          await supabase
            .from('dog_formulas')
            .update({
              formula: {
                ...(existing.formula as Record<string, unknown>),
                v3,
              },
            })
            .eq('dog_id', dogId)
            .eq('cycle_number', 1)
        }
      } catch {
        v3 = null
      }
    }
    // 안전 게이트 — 저장 정본에 심어둔 상담 플래그를 캐시 응답에도 surface.
    const stored = existing.formula as {
      needsConsultation?: boolean
      consultationReason?: string | null
    }
      return NextResponse.json({
        ok: true,
        formula,
        v3,
        needsConsultation: stored.needsConsultation ?? false,
        consultationReason: stored.consultationReason ?? null,
        cached: true,
      })
    }
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
  // ★ service-role(admin) 로 읽는다(2026-07-17 보안): 이 계수 테이블은 준영업비밀이라
  // RLS 를 admin 전용으로 조였다(유저 세션으론 못 읽음). 전역 알고리즘 설정이라 유저
  // 데이터가 아니므로 service-role 사용 안전. service-role 키 부재/읽기 실패 시엔
  // override 없이(기본값) 진행 — 보안 잠금 때문에 추천이 통째로 멈추면 안 되므로 방어.
  let foodLineRows: Record<string, unknown>[] | null = null
  let breedRows: Record<string, unknown>[] | null = null
  try {
    const algoAdmin = createAdminClient()
    const [flRes, brRes] = await Promise.all([
      algoAdmin
        .from('algorithm_food_lines')
        .select(
          'line, kcal_per_100g, protein_pct_dm, fat_pct_dm, calcium_pct_dm, ' +
            'phosphorus_pct_dm, sodium_pct_dm, omega3_pct_dm, omega6_pct_dm, ' +
            'vitamin_d_iu_per_100g_dm, subtitle_override, benefit_override',
        ),
      algoAdmin
        .from('algorithm_breed_predispose')
        .select(
          'breed_key, korean_label, breed_keywords, predispose_conditions, cautions',
        )
        .eq('enabled', true),
    ])
    foodLineRows = flRes.data as Record<string, unknown>[] | null
    breedRows = brRes.data as Record<string, unknown>[] | null
  } catch (e) {
    console.error('[compute] algorithm override fetch 실패 — 기본값으로 진행', e)
  }

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
    omega3_pct_dm: number | null
    omega6_pct_dm: number | null
    vitamin_d_iu_per_100g_dm: number | null
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
      omega3PctDM: r.omega3_pct_dm,
      omega6PctDM: r.omega6_pct_dm,
      vitaminDIuPer100gDM: r.vitamin_d_iu_per_100g_dm,
      subtitle: r.subtitle_override,
      benefit: r.benefit_override,
    }
  }

  // 4) AlgorithmInput 조립.
  // audit #79: dog.age_value / weight / neutered / activity_level 가 generated
  // types 에서 nullable — 필수 입력이라 default fallback.
  const ageMonths =
    dog.age_unit === 'years'
      ? (dog.age_value ?? 0) * 12
      : dog.age_value ?? 0
  // answers JSONB 의 bcsExact 가 5점 척도 BCS. 없으면 null.
  const answers =
    (survey.answers as {
      bcsExact?: number
      allergies?: string[]
      snackFreq?: string
      // 설문 식욕(taste): 'strong'|'normal'|'picky'|'reduced'. v3 NeedProfile 입력.
      appetite?: string
      diagnosedSeverity?: Record<string, 'mild' | 'moderate' | 'severe'>
    }) ?? {}
  const bcs =
    typeof answers.bcsExact === 'number' &&
    answers.bcsExact >= 1 &&
    answers.bcsExact <= 9
      ? (answers.bcsExact as AlgorithmInput['bcs'])
      : null

  // 가용성 — 활성 제품 있는 라인/토퍼만 추천 (skuMap 게이트 입력).
  const boxSlugs = [
    ...Object.values(LINE_TO_SLUG).filter((s): s is string => s !== null),
    ...Object.values(TOPPER_TO_SLUG),
  ]
  const { data: activeProd } = await supabase
    .from('products')
    .select('slug')
    .eq('is_active', true)
    .in('slug', boxSlugs)
  const activeSlugs = ((activeProd ?? []) as Array<{ slug: string }>).map(
    (p) => p.slug,
  )

  const input: AlgorithmInput = {
    dogId: dog.id,
    dogName: dog.name,
    ageMonths,
    weightKg: dog.weight ?? 0,
    neutered: dog.neutered ?? false,
    activityLevel:
      (dog.activity_level as 'low' | 'medium' | 'high' | null) ?? 'medium',
    bcs,
    allergies: Array.isArray(answers.allergies) ? answers.allergies : [],
    chronicConditions: Array.isArray(survey.chronic_conditions)
      ? survey.chronic_conditions
      : [],
    // [H1] 임신/수유 게이트 (방어심층) — 중성화견은 임신 불가. nutrition.ts
    // MER 게이트와 일관되게 firstBox 임신 chip 도 안 뜨게 route 에서 차단.
    // (수컷 미중성화 edge 는 설문 Pregnancy 스텝 UI 가 입력 자체를 막음.)
    pregnancy: dog.neutered
      ? null
      : ((survey.pregnancy_status as AlgorithmInput['pregnancy']) ?? null),
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
    availableLines: deriveAvailableLines(activeSlugs),
    availableToppers: deriveAvailableToppers(activeSlugs),
    // 간식 빈도 → 칼로리 차감 비율 (간식 위에 풀 밥 = 비만 방지, 10% 룰).
    treatReductionPct: treatCalorieFraction(answers.snackFreq),
    // 수의사 진단 중증도 (췌장염 급성/중증 하드 게이트 입력).
    diagnosedSeverity: answers.diagnosedSeverity,
  }

  // 5) v3 추천을 **먼저** 계산 — 베이스 단백질 선택(근거 기반) + 기능성 소스.
  // pure function, throw 안 함. 실패해도 폴백되게 try 로 감싼다.
  let v3: RecommendationResult | null = null
  try {
    v3 = buildV3Recommendation(input, {
      appetite: answers.appetite,
      activeSlugs,
    })
  } catch {
    v3 = null
  }

  // 5.1) v3 picks → 시작 라인 비율 시드 주입. v3 가 베이스 단백질을 고르고,
  //      이어지는 decideFirstBox 의 임상 안전 룰(알레르기·췌장염·CKD·임신·퍼피·
  //      심장 등)이 그 위에서 그대로 적용된다 → "v3 추천 + v2 안전망".
  //      v3 실패/상담 라우팅(후보 0)이면 미주입 → decideFirstBox 가 기존 케어목표
  //      레시피로 안전 폴백(완전 하위호환).
  if (v3 && !v3.layerA.needsConsultation && v3.layerA.picks.length > 0) {
    input.baseRatiosOverride = v3PicksToLineRatios(v3.layerA.picks)
  }

  // 5.5) 알고리즘 실행 — v3 시드 + v2 임상 안전 룰. pure function, throw 안 함.
  const formula = decideFirstBox(input)

  // 5.5a) 판매중 제품으로 게이트 — **저장 전에** 한 번(2026-07-24 퍼저 발견).
  // 임상 룰이 만든 lineRatios 는 연어(deferred·미판매)를 낼 수 있는데(예: v3
  // 실패한 skin_coat 폴백 → applyCareGoal 이 skin=연어 0.7), 지금까지는
  // computeBoxItems(박스 계산)만 gateAvailability 를 돌려 실제 박스는 오리로
  // 바뀌지만, **저장·표시되는 처방엔 연어가 그대로 남아** 분석카드가 "연어
  // 100%" 를 보여주고 박스는 오리를 보내는 불일치가 났다(연어는 고객 완전
  // 비노출 원칙 위반). 정본 하나(=저장 처방)를 여기서 게이트하면 분석·플랜·
  // 주문·박스가 전부 같은 걸 본다 — line 546 의 교훈을 게이트에도 적용.
  {
    const gated = gateAvailability(formula.lineRatios, formula.toppers, {
      availableLines: deriveAvailableLines(activeSlugs),
      availableToppers: deriveAvailableToppers(activeSlugs),
      reasoning: formula.reasoning,
    })
    formula.lineRatios = gated.lineRatios
    formula.toppers = gated.toppers
  }

  // 5.5b) 첫 박스는 무조건 단일 단백질 (사장님 확정 2026-07-15).
  // 새 음식에 반응이 났을 때 단백질이 둘이면 원인을 좁힐 수 없다 — 그래서 첫
  // 박스만큼은 한 가지로 시작한다(제거식이와 같은 원리). 임상 룰(알레르기 차단
  // 등)이 다 돈 **뒤**에 합치므로 안전 판정은 그대로 살아 있고, 남은 것 중
  // 1순위만 남는다. 보호자가 레시피 시트에서 직접 2종을 고르는 건 그대로 가능 —
  // 여긴 '추천'을 단일로 만드는 것이다. cycle 2+ 는 손대지 않는다.
  //
  // ⚠️ 여기서(처방 자체를) 합쳐야 분석·플랜·주문·레시피 시트가 전부 같은 걸
  //    본다. 화면마다 따로 합치면 또 갈린다 — 방금 그 버그를 겪었다.
  const singleRatios = collapseToSingle(formula.lineRatios)
  const collapsedFrom = ALL_LINES.filter((l) => (formula.lineRatios[l] ?? 0) > 0)
  formula.lineRatios = singleRatios
  if (collapsedFrom.length > 1) {
    const kept = ALL_LINES.find((l) => singleRatios[l] === 1)
    formula.reasoning = [
      ...formula.reasoning,
      {
        trigger: '첫 박스',
        action: `${kept ? FOOD_LINE_META[kept].nameKo : '한 가지'} 단독 100%`,
        chipLabel: '첫 박스는 한 가지로',
        priority: 2,
        ruleId: 'first-box-single-protein',
      },
    ]
  }

  // 5.5c) ★안전 게이트 — 판매 단백질이 전부 알레르기면 상담 라우팅(2026-07-24).
  //   퍼저 발견: 4종(닭·오리·소·돼) 전부 알레르기로 고르면 안전한 박스가 없는데,
  //   normalize 최후 fallback 이 차단된 라인을 100% 로 강제 → 알레르기 성분 배송.
  //   원인 불문 "출고 라인의 차단성분이 선언 알레르기와 겹치면" 상담으로 돌린다
  //   (v3.needsConsultation 과 별개 최종 방어선 — 그 강아지는 우리 제품을 하나도
  //   못 먹으므로 결제 대신 상담이 유일하게 안전한 답이다).
  const shippedAllergenLeak = ALL_LINES.some(
    (l) =>
      (formula.lineRatios[l] ?? 0) > 0 &&
      SKU_MODEL[LEGACY_LINE_TO_PROTEIN[l]].blockingAllergies.some((b) =>
        input.allergies.includes(b),
      ),
  )
  const needsConsultation =
    shippedAllergenLeak || (v3?.layerA?.needsConsultation ?? false)
  const consultationReason = needsConsultation
    ? (v3?.layerA?.consultationReason ??
      '입력하신 알레르기로 지금 판매하는 레시피가 모두 제외됐어요. 맞춤 상담을 도와드릴게요.')
    : null

  // 5.6) daily_grams 재계산 — 결정된 라인 mix 의 kcalPer100g 가중평균 기준.
  // nutrition.ts 의 feed_g 는 평균 1.45 kcal/g 추정 (레시피 v2.1). 라인 mix
  // 결정 후엔 실제 가중평균으로 재계산해 정확도 ↑.
  const dailyGramsByMix = dailyGramsFromMix(
    formula.lineRatios,
    formula.dailyKcal,
    foodLineMetaOverride,
  )
  formula.dailyGrams = dailyGramsByMix

  // 6) Persist — UNIQUE (dog_id, cycle_number) 충돌 시 race condition (다른 탭).
  //    select 한 번 더 해서 그쪽 결과 반환. 사용자 입장 idempotent.
  // upsert — insert 가 아니다. 이유 두 가지:
  //  1. 재계산(stale) 경로: 옛 행을 지울 수 없으므로(DELETE RLS 정책 없음) 덮어써야
  //     한다. insert 였을 때 23505 가 나서 저장이 조용히 실패했다.
  //  2. 경쟁 삽입: 두 화면이 동시에 compute 를 호출해도 마지막 값으로 수렴한다.
  //     (출력이 deterministic 이라 어느 쪽이 이기든 같은 값)
  // created_at 을 반드시 갱신해야 위쪽 staleness 판정(analysis > formula)이 풀린다.
  // 이게 없으면 매 호출마다 stale 로 판정돼 영원히 재계산한다.
  const { error: insErr } = await supabase.from('dog_formulas').upsert(
    {
      dog_id: dogId,
      user_id: user.id,
      cycle_number: 1,
      formula: {
        lineRatios: formula.lineRatios,
        toppers: formula.toppers,
        v3,
        // 안전 게이트 — 저장 정본에 심어 주문·플랜·추천이 전부 같은 판단을 본다.
        needsConsultation,
        consultationReason,
      },
      reasoning: formula.reasoning,
      transition_strategy: formula.transitionStrategy,
      algorithm_version: formula.algorithmVersion,
      user_adjusted: false,
      daily_kcal: formula.dailyKcal,
      daily_grams: dailyGramsByMix,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'dog_id,cycle_number' },
  )

  if (insErr) {
    // audit #69: 원본 DB message 클라이언트 노출 제거 — 서버 로그만(2026-06-20).
    // 조용히 ok 를 반환하면 안 된다 — 화면과 테이블이 갈라지는 바로 그 버그다.
    console.error('[personalization/compute] upsert error:', insErr.message)
    return NextResponse.json(
      { code: 'DB_ERROR', message: '분석을 저장하지 못했어요' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    formula,
    v3,
    needsConsultation,
    consultationReason,
    cached: false,
  })
}
