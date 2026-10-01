import { calculateNutrition, stageFromKR, type NutritionResult, type SurveyAnswers } from '../nutrition.ts'
import { ageWeeksFromBirth, estimateGrowth, projectWeightKg } from '../growth-curve.ts'
import { deriveAgeFromBirth } from '../dog-age.ts'
import { petName } from '../korean.ts'

/**
 * 자견 월간 성장 재계산 — 판단·계산·알림 문구 (순수 함수, 실행은 dog-age-update 크론).
 *
 * # 왜 (2026-10-01 사장님)
 * "자동으로 한 달씩 지나면서 계산해, 앱 네이티브 알림으로 무게가 얼마나 달라졌는지 귀찮지 않게
 *  한 달에 한 번 정도만". 자견 칼로리는 설문한 날의 체중·나이에 고정돼 있었다 — 4개월에 설문한
 * 강아지가 10개월이 돼도 4개월 몫을 먹었다(크면서 모자람). 재제안도 박스 3개마다라 성장을 못 따라갔다.
 *
 * # 규칙
 *  · 대상 = 마지막 분석이 성장기이고 30일 이상 지난 강아지(설문·분석이 있어야 함). 새 분석 행 자체가
 *    "이번 달 처리함" 표식 — 크론이 하루 두 번 돌아도 두 번째는 30일 안이라 건너뛴다(알림 중복 없음).
 *  · 몸무게: 마지막 분석 뒤에 기록한 체중이 있으면 그 값(실측). 없으면 마지막 실측에서 성장곡선
 *    (FEDIAF 2025, lib/growth-curve)으로 이번 달 체중을 추정 — 실측보다 작게 추정하지 않는다.
 *    추정치로 dogs.weight 를 덮지 않는다(실측만 실측).
 *  · 칼로리 = calculateNutrition(정본) — 다 컸으면(성장기 임계 통과) 성견 기준으로 넘어가고, 그 달이
 *    마지막 자동 재계산이다(다음 달엔 마지막 분석이 성견이라 대상 아님).
 */
export const GROWTH_RECOMPUTE_DAYS = 30
const DAY_MS = 86_400_000

export type GrowthDog = {
  id: string
  name: string
  weight: number | null
  birth_date: string | null
  neutered: boolean | null
  activity_level: string | null
  gender: string | null
  breed: string | null
  weight_measured_at: string | null
}
export type GrowthLastAnalysis = {
  created_at: string
  stage: string | null
  weight_kg: number | null
}
export type GrowthWeightLog = { weight: number; measured_at: string }

export type GrowthPlan =
  | { due: false; reason: 'no_birth' | 'no_analysis' | 'not_due' | 'not_puppy' | 'no_weight' }
  | {
      due: true
      weightKg: number
      weightSource: 'logged' | 'estimated'
      /** 지난 분석에 쓴 몸무게 — 알림 "○kg → ○kg". 모르면 null. */
      prevWeightKg: number | null
      adultKg: number
      ageWeeks: number
      nutrition: NutritionResult
      /** 이번 계산으로 성장기를 지났다(성견 기준으로 넘어감). */
      grownUp: boolean
    }

const kg1 = (n: number) => Math.round(n * 10) / 10

export function planMonthlyGrowth(i: {
  dog: GrowthDog
  lastAnalysis: GrowthLastAnalysis | null
  surveyAnswers: unknown
  latestWeightLog: GrowthWeightLog | null
  nowMs: number
}): GrowthPlan {
  const { dog, lastAnalysis, latestWeightLog, nowMs } = i
  const ageWeeks = ageWeeksFromBirth(dog.birth_date, nowMs)
  const age = deriveAgeFromBirth(dog.birth_date?.slice(0, 10), nowMs)
  if (ageWeeks === null || !age) return { due: false, reason: 'no_birth' }
  if (!lastAnalysis || !i.surveyAnswers) return { due: false, reason: 'no_analysis' }
  const lastMs = Date.parse(lastAnalysis.created_at)
  if (!Number.isFinite(lastMs) || nowMs - lastMs < GROWTH_RECOMPUTE_DAYS * DAY_MS) {
    return { due: false, reason: 'not_due' }
  }
  if (stageFromKR(lastAnalysis.stage) !== 'puppy') return { due: false, reason: 'not_puppy' }

  // 실측 후보 — 체중 기록(날짜) · dogs.weight(측정일 없으면 마지막 분석일). 가장 최근 것이 기준점.
  const lastDay = lastAnalysis.created_at.slice(0, 10)
  const logDay = latestWeightLog?.measured_at?.slice(0, 10) ?? null
  const loggedSinceLast = !!latestWeightLog && !!logDay && logDay > lastDay && latestWeightLog.weight > 0
  const dogDay = (dog.weight_measured_at ?? lastAnalysis.created_at).slice(0, 10)
  type Anchor = { weight: number; day: string }
  const anchors: Anchor[] = []
  if (latestWeightLog && logDay && latestWeightLog.weight > 0) anchors.push({ weight: latestWeightLog.weight, day: logDay })
  if (dog.weight && dog.weight > 0) anchors.push({ weight: dog.weight, day: dogDay })
  if (anchors.length === 0) return { due: false, reason: 'no_weight' }
  const anchor = anchors.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))[0]!
  const anchorWeeks = ageWeeksFromBirth(dog.birth_date, Date.parse(`${anchor.day}T00:00:00Z`)) ?? ageWeeks
  const adultKg = estimateGrowth(anchor.weight, anchorWeeks).adultKg

  const weightSource: 'logged' | 'estimated' = loggedSinceLast ? 'logged' : 'estimated'
  const weightKg = loggedSinceLast
    ? kg1(latestWeightLog!.weight)
    : kg1(Math.max(anchor.weight, projectWeightKg(adultKg, ageWeeks)))
  const prevWeightKg = lastAnalysis.weight_kg != null ? Number(lastAnalysis.weight_kg) : loggedSinceLast ? null : kg1(anchor.weight)

  // 옛 설문 행엔 healthConcerns·allergies 가 없을 수 있다 — 계산이 배열을 기대한다.
  const answers = { healthConcerns: [], allergies: [], ...(i.surveyAnswers as object) } as unknown as SurveyAnswers
  const nutrition = calculateNutrition(
    {
      weight: weightKg,
      ageValue: age.value,
      ageUnit: age.unit,
      neutered: !!dog.neutered,
      activityLevel: (dog.activity_level as 'low' | 'medium' | 'high') ?? 'medium',
      gender: (dog.gender as 'male' | 'female' | null) ?? null,
      breed: dog.breed,
      // 추정 체중엔 측정 신뢰도 보정을 걸지 않는다(그 자체가 추정).
      weightReliability: null,
      // 기준점에서 고정한 성견 추정 — p 가 성장곡선을 따라 한 달씩 오른다.
      expectedAdultWeight: adultKg,
      ageWeeks,
    },
    answers,
  )
  return {
    due: true,
    weightKg,
    weightSource,
    prevWeightKg,
    adultKg,
    ageWeeks,
    nutrition,
    grownUp: nutrition.stage !== 'puppy',
  }
}

const fmtKg = (n: number) => `${Number(n.toFixed(1))}kg`

/**
 * 월 1회 앱 알림 — 몸무게가 얼마나 달라졌는지 중심(사장님). 비율%·전문용어 금지(브랜드 보이스).
 * 추정이면 "약 ○kg쯤"이라 말하고 체중 기록 화면(?weight=open)을 연다 — 실측이 들어오면 다음 달이 정확해진다.
 */
export function growthPushCopy(
  dog: { id: string; name: string },
  plan: Extract<GrowthPlan, { due: true }>,
): { title: string; body: string; url: string } {
  const title = `${petName(dog.name)} 한 달 성장 소식`
  if (plan.grownUp) {
    return {
      title,
      body: '이제 다 자랐어요! 성견 기준으로 하루 권장 급여량을 다시 계산했어요.',
      url: `/dogs/${dog.id}/analysis`,
    }
  }
  const now = fmtKg(plan.weightKg)
  const prev = plan.prevWeightKg != null && plan.prevWeightKg !== plan.weightKg ? fmtKg(plan.prevWeightKg) : null
  if (plan.weightSource === 'logged') {
    return {
      title,
      body: prev
        ? `몸무게가 ${prev}에서 ${now}이 됐어요. 자란 만큼 하루 권장 급여량을 다시 계산했어요.`
        : `지금 몸무게 ${now} 기준으로 하루 권장 급여량을 다시 계산했어요.`,
      url: `/dogs/${dog.id}/analysis`,
    }
  }
  return {
    title,
    body: `이맘때면 ${prev ? `${prev}에서 ` : ''}약 ${now}쯤 컸을 거예요. 자란 만큼 하루 권장 급여량을 다시 계산했어요. 몸무게를 재서 기록해 주시면 더 정확해져요.`,
    url: `/dogs/${dog.id}?weight=open`,
  }
}

/** analyses 에 넣을 자동 갱신 행 — SurveyClient 설문 분석 행과 같은 칸(규칙: 같은 계산 → 같은 저장). */
export function growthAnalysisRow(a: {
  dogId: string
  userId: string
  surveyId: string
  plan: Extract<GrowthPlan, { due: true }>
  supplements: string[] | null
  nextReviewDate: string | null
}): Record<string, unknown> {
  const nu = a.plan.nutrition
  return {
    dog_id: a.dogId,
    survey_id: a.surveyId,
    user_id: a.userId,
    source: 'growth_auto',
    weight_kg: a.plan.weightKg,
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
    supplements: a.supplements ?? [],
    risk_flags: nu.riskFlags,
    vet_consult_recommended: nu.vetConsult,
    next_review_date: a.nextReviewDate,
    guideline_version: nu.guidelineVersion,
    factor_breakdown: nu.factorBreakdown,
  }
}
