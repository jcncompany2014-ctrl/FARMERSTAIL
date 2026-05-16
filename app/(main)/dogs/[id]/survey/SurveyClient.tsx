'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  Check,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import {
  calculateNutrition,
  getSupplements,
  getConditionSupplements,
  type SurveyAnswers,
} from '@/lib/nutrition'
import {
  type BcsKey,
  type McsKey,
  type ChronicConditionKey,
} from '@/lib/nutrition/guidelines'
import { haptic } from '@/lib/haptic'
import { trackSurveyStarted, trackSurveyCompleted } from '@/lib/analytics'
import Body from './steps/Body'
import Muscle from './steps/Muscle'
import Stool from './steps/Stool'
import Diet from './steps/Diet'
import Allergy from './steps/Allergy'
import Status from './steps/Status'
import Pregnancy from './steps/Pregnancy'
import Preferences, { type CareGoal } from './steps/Preferences'
import LoadingStep from './steps/Loading'
import './survey.css'

/**
 * 설문 v3 — Claude Design 핸드오프 (2026-05-03) 적용 + personalization 7 필드.
 *
 *   1. body       : BCS 9-point + 6개월 체중 추세
 *   2. muscle     : MCS 4-grade
 *   3. stool      : Bristol Stool 1~7 + 위장 민감도
 *   4. diet       : 주식 / 브랜드 / 간식 / 식욕 / 산책분 / 실내활동 /
 *                   화식경험 / 만족도 1~5
 *   5. allergy    : 알레르기 모드 + 항목 / 선호 단백질
 *   6. chronic    : 만성질환 + 처방식 / 약
 *   7. status     : 임신·수유 / 모질·피부 / 케어 목표 (★알고리즘 1순위)
 *   8. loading    : 분석 중 → 결과 페이지
 *
 * Personalization 알고리즘 첫 박스 결정에 필요한 7 필드:
 *   weight_trend_6mo, gi_sensitivity, indoor_activity (선택)
 *   home_cooking_experience, current_diet_satisfaction, care_goal (필수)
 *   preferred_proteins (선택, 다중)
 *
 * audit #96 분할 — 각 step JSX 는 ./steps/*.tsx 로 이전. 본 파일은 상태 관리
 * (useState / autosave / 제출) 만 담당.
 */

type Dog = {
  id: string
  name: string
  weight: number
  age_value: number
  age_unit: 'years' | 'months'
  neutered: boolean
  activity_level: 'low' | 'medium' | 'high'
  gender: 'male' | 'female' | null
}

const STEPS = [
  'body',
  'muscle',
  'stool',
  'diet',
  'allergy',
  'chronic',
  'status',
  'loading',
] as const
type Step = (typeof STEPS)[number]

export default function SurveyClient({ dogId }: { dogId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const [dog, setDog] = useState<Dog | null>(null)
  const [currentStep, setCurrentStep] = useState<Step>('body')

  // 설문 step 변경 시 자동 scroll-to-top + 짧은 진동 + 첫 h1 focus (a11y).
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo({ top: 0, behavior: 'smooth' })
    haptic('tick')
    // a11y — 새 step 의 heading 으로 focus 이동 → screen reader 가 다음
    // step 진입을 명확히 알림. 첫 paint 후 timing 안전하도록 rAF.
    requestAnimationFrame(() => {
      const h1 = document.querySelector<HTMLHeadingElement>('.s-page h1')
      if (h1) {
        h1.setAttribute('tabindex', '-1')
        h1.focus({ preventScroll: true })
      }
    })
  }, [currentStep])
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  // 1. body
  const [bcs, setBcs] = useState<BcsKey | null>(null)
  // 2. muscle
  const [mcs, setMcs] = useState<McsKey | null>(null)
  // 3. stool
  const [bristol, setBristol] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | null>(null)
  // 4. diet
  const [foodType, setFoodType] = useState('')
  const [snackFreq, setSnackFreq] = useState('')
  const [taste, setTaste] = useState<'strong' | 'normal' | 'picky' | 'reduced' | ''>('')
  const [walkMinutes, setWalkMinutes] = useState('')
  const [currentBrand, setCurrentBrand] = useState('')
  // 5. allergy
  const [dlMode, setDlMode] = useState<'none' | 'unknown' | 'has' | ''>('')
  const [allergies, setAllergies] = useState<string[]>([])
  // 6. chronic
  const [chronicConditions, setChronicConditions] = useState<ChronicConditionKey[]>([])
  const [prescriptionDiet, setPrescriptionDiet] = useState('')
  const [medications, setMedications] = useState('')
  // v1.3 임상 정밀화 — 만성질환 의존 conditional input.
  // CKD 진단 시 IRIS stage (1-4) — 단백질 처방 분기 (Premium 0% 여부 결정).
  const [irisStage, setIrisStage] = useState<1 | 2 | 3 | 4 | null>(null)
  // 7. status
  const [pregnancy, setPregnancy] = useState<'none' | 'pregnant' | 'lactating' | ''>('')
  const [coat, setCoat] = useState<'healthy' | 'dull' | 'shedding' | 'itchy' | 'lesions' | ''>('')
  // v1.3 — 임신 주차 (1-9) + 산자수. NRC 2006 ch.15 multiplier 분기.
  const [pregnancyWeek, setPregnancyWeek] = useState<number | null>(null)
  const [litterSize, setLitterSize] = useState<number | null>(null)
  // v1.3 — 대형견 puppy Ca cap (AAFCO 2024). <18mo puppy 의 예상 성견 체중.
  const [expectedAdultWeightKg, setExpectedAdultWeightKg] = useState<number | null>(null)

  // ── personalization v3 ──
  const [weightTrend, setWeightTrend] =
    useState<'stable' | 'gained' | 'lost' | 'unknown' | ''>('')
  const [giSensitivity, setGiSensitivity] =
    useState<'rare' | 'sometimes' | 'frequent' | 'always' | ''>('')
  const [indoorActivity, setIndoorActivity] =
    useState<'calm' | 'moderate' | 'active' | ''>('')
  const [homeCookingExp, setHomeCookingExp] =
    useState<'first' | 'occasional' | 'frequent' | ''>('')
  const [dietSatisfaction, setDietSatisfaction] = useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [preferredProteins, setPreferredProteins] = useState<string[]>([])
  const [careGoal, setCareGoal] = useState<CareGoal | ''>('')

  // loading 단계 stage 인디케이터
  const [loadingStage, setLoadingStage] = useState(0)
  // autosave 복원 한 번만 — 진입 시 localStorage 의 이전 진행 상태 복원.
  // ref 사용 — React 19 'set-state-in-effect' 룰 회피 (effect 안에서 setState
  // 직접 호출 금지). 복원은 mount 직후 1회 mutation 이라 ref 충분.
  const restoredRef = useRef(false)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data, error } = await supabase
        .from('dogs')
        .select('id, name, weight, age_value, age_unit, neutered, activity_level, gender')
        .eq('id', dogId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (error || !data) {
        router.push('/dogs')
        return
      }
      // audit #79: generated dogs row nullable cast.
      setDog(data as unknown as Dog)
      trackSurveyStarted(dogId)
    }
    void load()
  }, [dogId, router, supabase])

  // ── Autosave (localStorage) ──────────────────────────────────────────
  // 페이지 떠난 후 다시 들어와도 입력 복원. 7일 만료. dog 별 분리.
  // 모바일에서 잠깐 다른 앱 → 돌아올 때 가장 큰 가치.
  const STORAGE_KEY = `farmerstail-survey:${dogId}`

  // 1) 복원 — dog 로드 후 한 번만. ref 가드라 1회 mutation 안전 — React 19
  // 'set-state-in-effect' 룰은 mount 직후 hydration 패턴엔 과보수.
  /* eslint-disable react-hooks/set-state-in-effect -- mount 1회 ref 가드 복원 */
  useEffect(() => {
    if (!dog || restoredRef.current || typeof window === 'undefined') return
    restoredRef.current = true
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const data = JSON.parse(raw) as Record<string, unknown> & { _ts?: number }
      // 7일 지나면 만료
      if (
        typeof data._ts === 'number' &&
        Date.now() - data._ts > 7 * 24 * 60 * 60 * 1000
      ) {
        localStorage.removeItem(STORAGE_KEY)
        return
      }
      // 핵심 state 만 복원 — undefined 아닌 값만 적용해 partial restore 안전.
      if (data.bcs !== undefined) setBcs(data.bcs as BcsKey | null)
      if (data.mcs !== undefined) setMcs(data.mcs as McsKey | null)
      if (data.bristol !== undefined)
        setBristol(data.bristol as typeof bristol)
      if (typeof data.foodType === 'string') setFoodType(data.foodType)
      if (typeof data.snackFreq === 'string') setSnackFreq(data.snackFreq)
      if (typeof data.taste === 'string') setTaste(data.taste as typeof taste)
      if (typeof data.walkMinutes === 'string') setWalkMinutes(data.walkMinutes)
      if (typeof data.currentBrand === 'string') setCurrentBrand(data.currentBrand)
      if (typeof data.dlMode === 'string') setDlMode(data.dlMode as typeof dlMode)
      if (Array.isArray(data.allergies)) setAllergies(data.allergies as string[])
      if (Array.isArray(data.chronicConditions))
        setChronicConditions(data.chronicConditions as ChronicConditionKey[])
      if (typeof data.prescriptionDiet === 'string')
        setPrescriptionDiet(data.prescriptionDiet)
      if (typeof data.medications === 'string') setMedications(data.medications)
      if (data.irisStage !== undefined)
        setIrisStage(data.irisStage as typeof irisStage)
      if (typeof data.pregnancy === 'string')
        setPregnancy(data.pregnancy as typeof pregnancy)
      if (typeof data.coat === 'string') setCoat(data.coat as typeof coat)
      if (data.pregnancyWeek !== undefined)
        setPregnancyWeek(data.pregnancyWeek as number | null)
      if (data.litterSize !== undefined)
        setLitterSize(data.litterSize as number | null)
      if (data.expectedAdultWeightKg !== undefined)
        setExpectedAdultWeightKg(data.expectedAdultWeightKg as number | null)
      if (typeof data.weightTrend === 'string')
        setWeightTrend(data.weightTrend as typeof weightTrend)
      if (typeof data.giSensitivity === 'string')
        setGiSensitivity(data.giSensitivity as typeof giSensitivity)
      if (typeof data.indoorActivity === 'string')
        setIndoorActivity(data.indoorActivity as typeof indoorActivity)
      if (typeof data.homeCookingExp === 'string')
        setHomeCookingExp(data.homeCookingExp as typeof homeCookingExp)
      if (data.dietSatisfaction !== undefined)
        setDietSatisfaction(data.dietSatisfaction as typeof dietSatisfaction)
      if (Array.isArray(data.preferredProteins))
        setPreferredProteins(data.preferredProteins as string[])
      if (typeof data.careGoal === 'string')
        setCareGoal(data.careGoal as CareGoal | '')
      // currentStep 복원 — 'loading' (제출 중간 종료) 은 'status' 로 fallback
      // 해 사용자가 처음부터 다시 안 하도록.
      if (typeof data.currentStep === 'string') {
        if (data.currentStep === 'loading') {
          setCurrentStep('status')
        } else {
          setCurrentStep(data.currentStep as Step)
        }
      }
      toast.info('이전에 작성하던 내용을 불러왔어요')
    } catch {
      // corrupted — silently ignore
    }
  }, [dog, STORAGE_KEY, toast])
  /* eslint-enable react-hooks/set-state-in-effect */

  // 2) 저장 — state 변경 시. loading step 중엔 저장 안 함 (이미 제출).
  // audit #96: 이전엔 deps 한 변경마다 동기 JSON.stringify + localStorage.setItem
  // 호출 (26개 deps) → 한 글자 칠 때마다 입력 지연. 500ms debounce 로 결정적 저장.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!dog || !restoredRef.current || typeof window === 'undefined') return
    if (currentStep === 'loading') return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            bcs,
            mcs,
            bristol,
            foodType,
            snackFreq,
            taste,
            walkMinutes,
            currentBrand,
            dlMode,
            allergies,
            chronicConditions,
            prescriptionDiet,
            medications,
            irisStage,
            pregnancy,
            coat,
            pregnancyWeek,
            litterSize,
            expectedAdultWeightKg,
            weightTrend,
            giSensitivity,
            indoorActivity,
            homeCookingExp,
            dietSatisfaction,
            preferredProteins,
            careGoal,
            currentStep,
            _ts: Date.now(),
          }),
        )
      } catch {
        // quota exceeded — silently ignore
      }
    }, 500)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [
    dog,
    STORAGE_KEY,
    bcs,
    mcs,
    bristol,
    foodType,
    snackFreq,
    taste,
    walkMinutes,
    currentBrand,
    dlMode,
    allergies,
    chronicConditions,
    prescriptionDiet,
    medications,
    irisStage,
    pregnancy,
    coat,
    pregnancyWeek,
    litterSize,
    expectedAdultWeightKg,
    weightTrend,
    giSensitivity,
    indoorActivity,
    homeCookingExp,
    dietSatisfaction,
    preferredProteins,
    careGoal,
    currentStep,
  ])

  // loading stage 진행 — 4 stage rotating
  useEffect(() => {
    if (currentStep !== 'loading') return
    const t = setInterval(() => setLoadingStage((s) => Math.min(s + 1, 4)), 700)
    return () => clearInterval(t)
  }, [currentStep])

  const stepIdx = STEPS.indexOf(currentStep)
  const totalSteps = STEPS.length - 1
  const progress = Math.min(100, Math.round((stepIdx / totalSteps) * 100))

  function validateStep(): boolean {
    setErr('')
    if (currentStep === 'body' && bcs === null) {
      setErr('체형(BCS)을 선택해 주세요')
      return false
    }
    if (currentStep === 'diet') {
      if (!foodType) {
        setErr('주식 형태를 선택해 주세요')
        return false
      }
      if (!snackFreq) {
        setErr('간식 빈도를 선택해 주세요')
        return false
      }
      if (!taste) {
        setErr('식욕 상태를 선택해 주세요')
        return false
      }
      if (!homeCookingExp) {
        setErr('화식 경험 정도를 선택해 주세요')
        return false
      }
      if (dietSatisfaction === null) {
        setErr('현재 식이 만족도를 선택해 주세요')
        return false
      }
    }
    if (currentStep === 'allergy' && !dlMode) {
      setErr('알레르기 여부를 선택해 주세요')
      return false
    }
    if (currentStep === 'allergy' && dlMode === 'has' && allergies.length === 0) {
      setErr('알레르기 재료를 하나 이상 선택해 주세요')
      return false
    }
    if (currentStep === 'status' && !careGoal) {
      setErr('가장 신경 쓰고 싶은 케어 목표를 선택해 주세요')
      return false
    }
    return true
  }

  async function goNext() {
    if (!validateStep()) return
    const idx = STEPS.indexOf(currentStep)
    if (currentStep === 'status') {
      setCurrentStep('loading')
      setLoadingStage(0)
      // 시각적 분석 단계 보여주기 — 약 2.8초 후 실제 저장 → 결과로 이동
      setTimeout(() => saveAndGoResult(), 2800)
      return
    }
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1]!)
  }

  function goPrev() {
    const idx = STEPS.indexOf(currentStep)
    if (idx > 0) {
      setErr('')
      setCurrentStep(STEPS[idx - 1]!)
    }
  }

  async function saveAndGoResult() {
    if (!dog) return
    setSaving(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const bodyMap: Record<number, SurveyAnswers['bodyCondition']> = {
      1: 'skinny', 2: 'skinny', 3: 'slim', 4: 'slim',
      5: 'ideal',
      6: 'chubby', 7: 'chubby',
      8: 'obese', 9: 'obese',
    }

    const legacyHealthConcerns: string[] = []
    if (chronicConditions.includes('arthritis')) legacyHealthConcerns.push('관절')
    if (chronicConditions.includes('kidney')) legacyHealthConcerns.push('신장')
    if (chronicConditions.includes('allergy_skin') || coat === 'lesions' || coat === 'itchy')
      legacyHealthConcerns.push('피부/털')
    if (chronicConditions.includes('ibd')) legacyHealthConcerns.push('소화')
    if (chronicConditions.includes('dental')) legacyHealthConcerns.push('치아')
    if (bcs && bcs >= 7) legacyHealthConcerns.push('체중')

    const meds = medications
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)

    const answers: SurveyAnswers = {
      bodyCondition: bodyMap[bcs ?? 5]!,
      allergies,
      healthConcerns: legacyHealthConcerns,
      foodType,
      snackFreq,
      taste,
      bcsExact: bcs ?? undefined,
      mcsScore: mcs ?? undefined,
      bristolScore: bristol ?? undefined,
      chronicConditions,
      currentMedications: meds,
      pregnancyStatus: pregnancy || undefined,
      pregnancyWeek: pregnancyWeek ?? null,
      litterSize: litterSize ?? null,
      coatCondition: coat || undefined,
      appetite: taste || undefined,
      // walkMinutes 0-300 clamp (현실적 범위 — 산책 5시간 초과는 입력 오류).
      dailyWalkMinutes: walkMinutes
        ? Math.max(0, Math.min(300, Number(walkMinutes) || 0))
        : undefined,
      currentFoodBrand: currentBrand.trim() || undefined,
      careGoal: careGoal || undefined,
      homeCookingExperience: homeCookingExp || undefined,
      currentDietSatisfaction: dietSatisfaction ?? undefined,
      weightTrend6mo: weightTrend || undefined,
      giSensitivity: giSensitivity || undefined,
      preferredProteins: preferredProteins as SurveyAnswers['preferredProteins'],
      indoorActivity: indoorActivity || undefined,
    }

    const { data: surveyData, error: surveyErr } = await supabase
      .from('surveys')
      .insert({
        dog_id: dogId,
        user_id: user.id,
        answers,
        mcs_score: mcs,
        bristol_stool_score: bristol,
        chronic_conditions: chronicConditions,
        current_medications: meds,
        current_food_brand: currentBrand.trim() || null,
        daily_walk_minutes: walkMinutes
          ? Math.max(0, Math.min(300, Number(walkMinutes) || 0))
          : null,
        coat_condition: coat || null,
        appetite: taste || null,
        pregnancy_status: pregnancy || null,
        care_goal: careGoal || null,
        home_cooking_experience: homeCookingExp || null,
        current_diet_satisfaction: dietSatisfaction,
        weight_trend_6mo: weightTrend || null,
        gi_sensitivity: giSensitivity || null,
        preferred_proteins: preferredProteins,
        indoor_activity: indoorActivity || null,
        // v1.3 임상 정밀화 — conditional 입력. 미입력 시 알고리즘이 보수적 처방.
        iris_stage: chronicConditions.includes('kidney') ? irisStage : null,
        pregnancy_week: pregnancy === 'pregnant' ? pregnancyWeek : null,
        litter_size: pregnancy === 'lactating' ? litterSize : null,
        expected_adult_weight_kg:
          dog && (dog.age_unit === 'years'
            ? dog.age_value * 12 < 18
            : dog.age_value < 18)
            ? expectedAdultWeightKg
            : null,
      })
      .select()
      .single()

    if (surveyErr || !surveyData) {
      toast.error('저장하지 못했어요')
      setErr('저장하지 못했어요')
      setSaving(false)
      // status 로 점프 대신 loading 화면 그대로 — 사용자가 inline retry.
      return
    }

    if (prescriptionDiet.trim()) {
      await supabase
        .from('dogs')
        .update({ prescription_diet: prescriptionDiet.trim() })
        .eq('id', dogId)
        .eq('user_id', user.id)
    }

    const nu = calculateNutrition(
      {
        weight: dog.weight,
        ageValue: dog.age_value,
        ageUnit: dog.age_unit,
        neutered: dog.neutered,
        activityLevel: dog.activity_level,
        gender: dog.gender as 'male' | 'female' | null,
      },
      answers,
    )
    const supps = [
      ...getSupplements(legacyHealthConcerns).map((s) => s.name),
      ...getConditionSupplements(chronicConditions),
    ]
    const uniqueSupps = Array.from(new Set(supps))

    const nextDays = chronicConditions.length > 0 ? 60 : 90
    const nextReview = new Date(Date.now() + nextDays * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10)

    const { error: analysisErr } = await supabase.from('analyses').insert({
      dog_id: dogId,
      survey_id: surveyData.id,
      user_id: user.id,
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
      supplements: uniqueSupps,
      risk_flags: nu.riskFlags,
      vet_consult_recommended: nu.vetConsult,
      next_review_date: nextReview,
      guideline_version: nu.guidelineVersion,
    })

    if (analysisErr) {
      toast.error('분석을 저장하지 못했어요')
      setErr('분석을 저장하지 못했어요')
      setSaving(false)
      return
    }

    // autosave 삭제 — 설문 완료 후 다음 진입은 fresh start.
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* noop */
      }
    }

    // 설문 완료 응원 포인트 — voice-guidelines §10. 강제 보상이 아닌
    // "정성 들였으니 감사" 톤. apply_point_delta 의 partial unique index
    // (user_id, reference_type, reference_id) 가 같은 survey 재적립 차단 →
    // 사용자가 분석 페이지 다시 방문해도 중복 발생 X.
    try {
      const { data: rewardData } = await supabase.rpc('apply_point_delta', {
        p_user_id: user.id,
        p_delta: 1000,
        p_reason: '정성껏 답변해주신 설문 응원 포인트',
        p_reference_type: 'survey_completion',
        p_reference_id: surveyData.id,
      })
      const row = Array.isArray(rewardData) ? rewardData[0] : rewardData
      // already_applied 면 row.ok=true 이지만 message 로 구분 — 토스트 X.
      if (
        row?.ok &&
        row?.message !== 'already_applied' &&
        typeof window !== 'undefined'
      ) {
        sessionStorage.setItem(
          'ft:survey-reward',
          JSON.stringify({
            amount: 1000,
            balanceAfter: row.balance_after ?? null,
            ts: Date.now(),
          }),
        )
      }
    } catch {
      // 보상 적립 실패는 분석 흐름에 영향 X — 조용히 넘어감.
    }

    trackSurveyCompleted(dogId)
    router.push(`/dogs/${dogId}/analysis`)
    router.refresh()
  }

  if (!dog) {
    return (
      <main className="flex items-center justify-center min-h-[80vh]" style={{ background: 'var(--bg)' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--terracotta)' }} strokeWidth={1.6} />
      </main>
    )
  }

  // ── 이전 답변 요약 echo chips ──
  const echoItems: string[] = []
  if (stepIdx > 0 && bcs) echoItems.push(`BCS ${bcs}/9`)
  if (stepIdx > 1 && mcs) echoItems.push(`MCS ${mcs}`)
  if (stepIdx > 2 && bristol) echoItems.push(`변 #${bristol}`)
  if (stepIdx > 3) {
    if (foodType) echoItems.push(foodType)
    if (dietSatisfaction !== null) echoItems.push(`만족도 ${dietSatisfaction}/5`)
  }
  if (stepIdx > 4) {
    if (dlMode === 'none') echoItems.push('알레르기 없음')
    if (dlMode === 'has' && allergies.length) echoItems.push(`알레르기 ${allergies.length}`)
  }
  if (stepIdx > 5 && chronicConditions.length) echoItems.push(`질환 ${chronicConditions.length}`)

  const isLoading = currentStep === 'loading'

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="max-w-md mx-auto" style={{ background: 'var(--bg)' }}>
        {!isLoading && (
          <>
            {/* Step header — STEP nn / TT  +  progress with ticks */}
            <div className="s-stepwrap">
              <div className="s-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Link
                    href={`/dogs/${dogId}`}
                    aria-label="강아지 페이지로 돌아가기"
                    style={{
                      color: 'var(--muted)',
                      display: 'inline-flex',
                      // tap target Apple HIG 44px — visual 16px chevron 유지하면서
                      // hit area 만 음수 마진으로 확장.
                      padding: 8,
                      margin: -8,
                    }}
                  >
                    <ChevronLeft size={16} strokeWidth={2.2} />
                  </Link>
                  <span className="s-step-no">
                    STEP {String(Math.min(stepIdx + 1, totalSteps)).padStart(2, '0')}
                    {' / '}
                    {String(totalSteps).padStart(2, '0')}
                  </span>
                </div>
                <span className="s-step-pct">{progress}%</span>
              </div>
              <div
                className="s-progress"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`전체 ${totalSteps}단계 중 ${stepIdx + 1}단계, 진행률 ${progress}%`}
              >
                <i style={{ width: `${progress}%` }} />
                <div className="s-ticks">
                  {Array.from({ length: totalSteps + 1 }).map((_, i) => (
                    <span key={i} />
                  ))}
                </div>
              </div>
            </div>

            {/* Echo chips — 이전 답변 요약 */}
            {echoItems.length > 0 && (
              <div style={{ padding: '12px 22px 0' }}>
                <div className="s-echo">
                  {echoItems.map((it, i) => (
                    <span key={i} className="s-e">
                      <Check size={11} strokeWidth={2.5} />
                      {it}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Step content — 각 step 은 ./steps/*.tsx 에 분리 */}
        {currentStep === 'body' && (
          <Body
            dogName={dog.name}
            bcs={bcs}
            setBcs={setBcs}
            weightTrend={weightTrend}
            setWeightTrend={setWeightTrend}
          />
        )}

        {currentStep === 'muscle' && (
          <Muscle mcs={mcs} setMcs={setMcs} />
        )}

        {currentStep === 'stool' && (
          <Stool
            dogName={dog.name}
            bristol={bristol}
            setBristol={setBristol}
            giSensitivity={giSensitivity}
            setGiSensitivity={setGiSensitivity}
          />
        )}

        {currentStep === 'diet' && (
          <Diet
            foodType={foodType}
            setFoodType={setFoodType}
            currentBrand={currentBrand}
            setCurrentBrand={setCurrentBrand}
            snackFreq={snackFreq}
            setSnackFreq={setSnackFreq}
            taste={taste}
            setTaste={setTaste}
            walkMinutes={walkMinutes}
            setWalkMinutes={setWalkMinutes}
            indoorActivity={indoorActivity}
            setIndoorActivity={setIndoorActivity}
            homeCookingExp={homeCookingExp}
            setHomeCookingExp={setHomeCookingExp}
            dietSatisfaction={dietSatisfaction}
            setDietSatisfaction={setDietSatisfaction}
          />
        )}

        {currentStep === 'allergy' && (
          <Allergy
            dlMode={dlMode}
            setDlMode={setDlMode}
            allergies={allergies}
            setAllergies={setAllergies}
            preferredProteins={preferredProteins}
            setPreferredProteins={setPreferredProteins}
          />
        )}

        {currentStep === 'chronic' && (
          <Status
            chronicConditions={chronicConditions}
            setChronicConditions={setChronicConditions}
            irisStage={irisStage}
            setIrisStage={setIrisStage}
            prescriptionDiet={prescriptionDiet}
            setPrescriptionDiet={setPrescriptionDiet}
            medications={medications}
            setMedications={setMedications}
          />
        )}

        {currentStep === 'status' && (
          <div className="s-page">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span className="s-kicker">
                STATUS <span className="s-dot">·</span> 현재 상태
              </span>
            </div>
            <h1 className="s-title">마지막 단계예요</h1>
            <p className="s-sub">
              임신·수유나 모질 상태가 있다면 칼로리·미량영양소 권장량이 달라져요.
            </p>

            <Pregnancy
              dog={dog}
              pregnancy={pregnancy}
              setPregnancy={setPregnancy}
              pregnancyWeek={pregnancyWeek}
              setPregnancyWeek={setPregnancyWeek}
              litterSize={litterSize}
              setLitterSize={setLitterSize}
              expectedAdultWeightKg={expectedAdultWeightKg}
              setExpectedAdultWeightKg={setExpectedAdultWeightKg}
            />

            <Preferences
              coat={coat}
              setCoat={setCoat}
              careGoal={careGoal}
              setCareGoal={setCareGoal}
            />
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <LoadingStep
            dogName={dog.name}
            loadingStage={loadingStage}
            err={err}
            saving={saving}
            onRetry={() => {
              setErr('')
              setLoadingStage(0)
              void saveAndGoResult()
            }}
          />
        )}

        {err && !isLoading && (
          <div className="s-errbar" role="alert" aria-live="polite">
            <AlertCircle size={14} strokeWidth={2.2} />
            <span>{err}</span>
          </div>
        )}

        {!isLoading && (
          <div className="s-ctabar">
            <button
              type="button"
              className="s-prev-btn"
              onClick={goPrev}
              disabled={stepIdx === 0}
            >
              <ChevronLeft size={14} strokeWidth={2.4} />
              이전
            </button>
            <button
              type="button"
              className="s-next-btn"
              onClick={goNext}
              disabled={saving}
            >
              {currentStep === 'status' ? '결과 보기' : '다음'}
              <ArrowRight size={14} strokeWidth={2.6} color="var(--bg)" />
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
