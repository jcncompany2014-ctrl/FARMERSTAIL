'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Dog as DogIcon,
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  Check,
  HelpCircle,
  AlertTriangle,
  Smile,
  Meh,
  Frown,
  Stethoscope,
  Sparkles,
  Sparkle,
  ShieldAlert,
  MoonStar,
  Moon,
  Sun,
  CloudSun,
  Cloud,
  Dumbbell,
  Activity,
  TrendingDown,
  TrendingUp,
  Minus,
  Plus,
  PlusCircle,
  Circle,
  CircleDashed,
  CircleDot,
  CircleCheck,
  CircleEllipsis,
  Droplet,
  Droplets,
  Wheat,
  CookingPot,
  Combine,
  Flame,
  Wind,
  Scissors,
  Baby,
  Heart,
  Loader2,
  Bone,
  Star,
  Scale,
  Pause,
  Soup,
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
  BCS_DESCRIPTIONS,
  MCS_DESCRIPTIONS,
  CHRONIC_CONDITION_LABELS,
  BRISTOL_INTERPRETATION,
  type BcsKey,
  type McsKey,
  type ChronicConditionKey,
} from '@/lib/nutrition/guidelines'
import { detectChronicFromMedications } from '@/lib/nutrition/drugs'
import { haptic } from '@/lib/haptic'
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
 */

type Dog = {
  id: string
  name: string
  weight: number
  age_value: number
  age_unit: 'years' | 'months'
  neutered: boolean
  activity_level: 'low' | 'medium' | 'high'
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

const ALLERGY_OPTIONS = [
  '닭·칠면조',
  '소고기',
  '양고기',
  '연어·생선',
  '오리',
  '흰살생선',
  '돼지고기',
  '유제품',
  '계란',
  '곡물 (밀/옥수수)',
  '대두',
  '감자',
  '견과류',
]

type CareGoal =
  | 'weight_management'
  | 'skin_coat'
  | 'joint_senior'
  | 'allergy_avoid'
  | 'general_upgrade'

const CARE_GOAL_OPTIONS: Array<{
  v: CareGoal
  label: string
  desc: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number; color?: string; size?: number }>
}> = [
  {
    v: 'weight_management',
    label: '체중 관리',
    desc: '감량 / 유지 / 증량 — BCS 가 5점에서 멀수록 적극 조정',
    Icon: Scale,
  },
  {
    v: 'skin_coat',
    label: '피부·털 개선',
    desc: '윤기 부족, 가려움, 푸석함 — 오메가-3 비중 강화',
    Icon: Sparkles,
  },
  {
    v: 'joint_senior',
    label: '관절·시니어 케어',
    desc: '7세 이상 또는 관절 신호 — B1·콜린·콜라겐 중심',
    Icon: Bone,
  },
  {
    v: 'allergy_avoid',
    label: '알레르기·민감 회피',
    desc: '특정 단백질 차단 + 노블 프로틴 우선',
    Icon: ShieldAlert,
  },
  {
    v: 'general_upgrade',
    label: '일반 영양 업그레이드',
    desc: '특별 이슈 없음 — 균형식 + 기호성 중심',
    Icon: Star,
  },
]

const PROTEIN_OPTIONS: Array<{ v: string; label: string }> = [
  { v: 'chicken', label: '닭/칠면조' },
  { v: 'duck', label: '오리' },
  { v: 'beef', label: '소고기' },
  { v: 'salmon', label: '연어/생선' },
  { v: 'pork', label: '돼지고기' },
  { v: 'lamb', label: '양고기' },
]

// BCS 9-point — 디자인의 시각 위계 그대로 (group + icon + tag)
const BCS_VIEW: Record<
  BcsKey,
  {
    group: 'under' | 'ideal' | 'over'
    Icon: React.ComponentType<{ className?: string; strokeWidth?: number; color?: string; size?: number }>
    tag: string
    tagTone: 'good' | 'warn' | 'bad'
  }
> = {
  1: { group: 'under', Icon: MoonStar, tag: '위험', tagTone: 'bad' },
  2: { group: 'under', Icon: Moon, tag: '주의', tagTone: 'warn' },
  3: { group: 'under', Icon: MoonStar, tag: '주의', tagTone: 'warn' },
  4: { group: 'ideal', Icon: Sparkle, tag: '양호', tagTone: 'good' },
  5: { group: 'ideal', Icon: Sparkles, tag: '이상적', tagTone: 'good' },
  6: { group: 'over', Icon: Sun, tag: '주의', tagTone: 'warn' },
  7: { group: 'over', Icon: Sun, tag: '주의', tagTone: 'warn' },
  8: { group: 'over', Icon: CloudSun, tag: '위험', tagTone: 'bad' },
  9: { group: 'over', Icon: Cloud, tag: '위험', tagTone: 'bad' },
}

const MCS_VIEW: Record<
  McsKey,
  {
    Icon: React.ComponentType<{ className?: string; strokeWidth?: number; color?: string; size?: number }>
    tag: string
    tagTone: 'good' | 'warn' | 'bad'
  }
> = {
  1: { Icon: Dumbbell, tag: '양호', tagTone: 'good' },
  2: { Icon: Activity, tag: '경도', tagTone: 'warn' },
  3: { Icon: TrendingDown, tag: '주의', tagTone: 'warn' },
  4: { Icon: AlertTriangle, tag: '위험', tagTone: 'bad' },
}

const STOOL_VIEW: Record<
  1 | 2 | 3 | 4 | 5 | 6 | 7,
  {
    Icon: React.ComponentType<{ className?: string; strokeWidth?: number; color?: string; size?: number }>
    tag: string
    tagTone: 'good' | 'warn' | 'bad'
  }
> = {
  1: { Icon: Circle, tag: '변비', tagTone: 'bad' },
  2: { Icon: CircleDashed, tag: '변비', tagTone: 'bad' },
  3: { Icon: CircleDot, tag: '경계', tagTone: 'warn' },
  4: { Icon: CircleCheck, tag: '이상적', tagTone: 'good' },
  5: { Icon: CircleEllipsis, tag: '경계', tagTone: 'warn' },
  6: { Icon: Droplet, tag: '설사', tagTone: 'bad' },
  7: { Icon: Droplets, tag: '설사', tagTone: 'bad' },
}

export default function SurveyPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const toast = useToast()
  const dogId = params.id as string

  const [dog, setDog] = useState<Dog | null>(null)
  const [currentStep, setCurrentStep] = useState<Step>('body')

  // 설문 step 변경 시 자동 scroll-to-top + 짧은 진동 (모바일 즉각 피드백).
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo({ top: 0, behavior: 'smooth' })
    haptic('tick')
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
        .select('id, name, weight, age_value, age_unit, neutered, activity_level')
        .eq('id', dogId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (error || !data) {
        router.push('/dogs')
        return
      }
      setDog(data)
    }
    load()
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
      if (typeof data.currentStep === 'string' && data.currentStep !== 'loading')
        setCurrentStep(data.currentStep as Step)
      toast.info('이전에 작성하던 내용을 불러왔어요')
    } catch {
      // corrupted — silently ignore
    }
  }, [dog, STORAGE_KEY, toast])
  /* eslint-enable react-hooks/set-state-in-effect */

  // 2) 저장 — state 변경 시. loading step 중엔 저장 안 함 (이미 제출).
  useEffect(() => {
    if (!dog || !restoredRef.current || typeof window === 'undefined') return
    if (currentStep === 'loading') return
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

  function toggleArr<T>(arr: T[], v: T, setter: (x: T[]) => void) {
    if (arr.includes(v)) setter(arr.filter((x) => x !== v))
    else setter([...arr, v])
  }

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
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1])
  }

  function goPrev() {
    const idx = STEPS.indexOf(currentStep)
    if (idx > 0) {
      setErr('')
      setCurrentStep(STEPS[idx - 1])
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
      bodyCondition: bodyMap[bcs ?? 5],
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
      coatCondition: coat || undefined,
      appetite: taste || undefined,
      dailyWalkMinutes: walkMinutes ? Number(walkMinutes) : undefined,
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
        daily_walk_minutes: walkMinutes ? Number(walkMinutes) : null,
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
      toast.error('저장 실패: ' + surveyErr?.message)
      setSaving(false)
      setCurrentStep('status')
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
      toast.error('분석 저장 실패: ' + analysisErr.message)
      setSaving(false)
      setCurrentStep('status')
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
                    style={{ color: 'var(--muted)', display: 'inline-flex' }}
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
              <div className="s-progress">
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

        {/* Step content */}
        {currentStep === 'body' && (
          <div className="s-page">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span className="s-kicker">
                BODY <span className="s-dot">·</span> WSAVA
              </span>
            </div>
            <h1 className="s-title">
              {dog.name}의 체형을<br />선택해 주세요
            </h1>
            <p className="s-sub">
              위에서 봤을 때 허리, 옆에서 봤을 때 배 라인 기준{' '}
              <strong>9점 척도</strong>예요. 5번이 이상적이에요.
            </p>

            <div className="s-grid-3">
              {([1, 2, 3, 4, 5, 6, 7, 8, 9] as BcsKey[]).map((s) => {
                const active = bcs === s
                const view = BCS_VIEW[s]
                const Icon = view.Icon
                const stroke = s === 5 ? 2.2 : 1.6
                const color = active
                  ? 'var(--bg)'
                  : view.group === 'ideal'
                    ? '#566729'
                    : view.group === 'under'
                      ? '#A6BEDA'
                      : view.tagTone === 'bad'
                        ? 'var(--terracotta)'
                        : '#D4B872'
                return (
                  <button
                    key={s}
                    type="button"
                    className="s-pickcard"
                    aria-pressed={active}
                    onClick={() => setBcs(s)}
                  >
                    {s === 5 && <span className="s-ideal">IDEAL</span>}
                    <div className="s-num">{s}/9</div>
                    <div className="s-swatch">
                      <Icon size={28} strokeWidth={stroke} color={color} />
                    </div>
                    <div className="s-lbl">{BCS_DESCRIPTIONS[s].label.replace('BCS ', '')}</div>
                  </button>
                )
              })}
            </div>

            {bcs !== null && (
              <div className="s-hint">
                <div className="s-iconwrap">
                  {(() => {
                    const Icon = BCS_VIEW[bcs].Icon
                    return <Icon size={14} strokeWidth={2} />
                  })()}
                </div>
                <div>
                  <div className="s-row">
                    <strong>{BCS_DESCRIPTIONS[bcs].label}</strong>
                    <span className={'s-tag s-' + BCS_VIEW[bcs].tagTone}>
                      {BCS_VIEW[bcs].tag}
                    </span>
                  </div>
                  {BCS_DESCRIPTIONS[bcs].desc}
                </div>
              </div>
            )}

            <div className="s-sect">
              <div className="s-sect-lbl">
                <span className="s-label-text">최근 6개월 체중 변화</span>
                <span className="s-opt">선택</span>
              </div>
              <div className="s-chiprow">
                {[
                  { v: 'stable', label: '비슷', Icon: Minus },
                  { v: 'gained', label: '늘었음', Icon: TrendingUp },
                  { v: 'lost', label: '빠졌음', Icon: TrendingDown },
                  { v: 'unknown', label: '잘 모름', Icon: HelpCircle },
                ].map(({ v, label, Icon }) => {
                  const active = weightTrend === v
                  return (
                    <button
                      key={v}
                      type="button"
                      className={'s-chip' + (active ? ' s-on' : '')}
                      aria-pressed={active}
                      onClick={() => setWeightTrend(v as typeof weightTrend)}
                    >
                      <Icon size={13} strokeWidth={2} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {currentStep === 'muscle' && (
          <div className="s-page">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span className="s-kicker">
                MUSCLE <span className="s-dot">·</span> WSAVA
              </span>
              <span className="s-opt-badge">선택</span>
            </div>
            <h1 className="s-title">근육 상태는<br />어떤가요?</h1>
            <p className="s-sub">
              척추뼈 / 견갑골 / 골반 위 근육을 만져 평가해요. 노령견 근감소증 조기
              발견에 중요해요.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {([1, 2, 3, 4] as McsKey[]).map((s) => {
                const active = mcs === s
                const view = MCS_VIEW[s]
                const Icon = view.Icon
                const meta = MCS_DESCRIPTIONS[s]
                return (
                  <button
                    key={s}
                    type="button"
                    className="s-listbtn"
                    aria-pressed={active}
                    onClick={() => setMcs(active ? null : s)}
                  >
                    <span className="s-lb-num">MCS {s}</span>
                    <span
                      className="s-lb-icon"
                      style={{
                        background: active
                          ? 'rgba(255,255,255,.12)'
                          : view.tagTone === 'good'
                            ? '#E6EBD2'
                            : view.tagTone === 'warn'
                              ? '#F5E5C7'
                              : '#F0D8CF',
                      }}
                    >
                      <Icon
                        size={20}
                        strokeWidth={1.8}
                        color={
                          active
                            ? 'var(--bg)'
                            : view.tagTone === 'good'
                              ? '#566729'
                              : view.tagTone === 'warn'
                                ? '#7A5B1B'
                                : 'var(--terracotta)'
                        }
                      />
                    </span>
                    <span className="s-lb-body">
                      <span className="s-lb-title">{meta.label}</span>
                      <span className="s-lb-sub">{meta.desc}</span>
                    </span>
                    <span className={'s-tag s-' + view.tagTone}>{view.tag}</span>
                  </button>
                )
              })}
              <button
                type="button"
                className={'s-skipbtn' + (mcs === null ? ' s-active' : '')}
                onClick={() => setMcs(null)}
              >
                {mcs === null ? '✓ 잘 모르겠어요 — 건너뛸게요' : '잘 모르겠어요 — 건너뛸게요'}
              </button>
            </div>
          </div>
        )}

        {currentStep === 'stool' && (
          <div className="s-page">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span className="s-kicker">
                STOOL <span className="s-dot">·</span> BRISTOL SCALE
              </span>
              <span className="s-opt-badge">선택</span>
            </div>
            <h1 className="s-title">
              {dog.name}의 평소 변은<br />어떻게 보이나요?
            </h1>
            <p className="s-sub">
              장 건강과 식이섬유·수분 흡수 신호예요.
              <span className="s-pill">이상: #4</span>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {([1, 2, 3, 4, 5, 6, 7] as const).map((s) => {
                const active = bristol === s
                const view = STOOL_VIEW[s]
                const Icon = view.Icon
                const meta = BRISTOL_INTERPRETATION[s]
                return (
                  <button
                    key={s}
                    type="button"
                    className="s-listbtn"
                    aria-pressed={active}
                    onClick={() => setBristol(active ? null : s)}
                  >
                    <span className="s-lb-num">#{s}</span>
                    <span
                      className="s-lb-icon"
                      style={{
                        background: active
                          ? 'rgba(255,255,255,.12)'
                          : view.tagTone === 'good'
                            ? '#E6EBD2'
                            : view.tagTone === 'warn'
                              ? '#F5E5C7'
                              : '#F0D8CF',
                      }}
                    >
                      <Icon
                        size={20}
                        strokeWidth={1.8}
                        color={
                          active
                            ? 'var(--bg)'
                            : view.tagTone === 'good'
                              ? '#566729'
                              : view.tagTone === 'warn'
                                ? '#7A5B1B'
                                : 'var(--terracotta)'
                        }
                      />
                    </span>
                    <span className="s-lb-body">
                      <span className="s-lb-title">{meta.label}</span>
                      <span className="s-lb-sub">{meta.signal}</span>
                    </span>
                    <span className={'s-tag s-' + view.tagTone}>{view.tag}</span>
                  </button>
                )
              })}
              <button
                type="button"
                className={'s-skipbtn' + (bristol === null ? ' s-active' : '')}
                onClick={() => setBristol(null)}
              >
                {bristol === null ? '✓ 잘 모르겠어요 — 건너뛸게요' : '잘 모르겠어요 — 건너뛸게요'}
              </button>
            </div>

            <div className="s-sect">
              <div className="s-sect-lbl">
                <span className="s-label-text">사료를 바꿀 때 변이 자주 무르나요?</span>
                <span className="s-opt">선택</span>
              </div>
              <div className="s-chiprow">
                {[
                  { v: 'rare', label: '거의 없음', Icon: Check },
                  { v: 'sometimes', label: '가끔', Icon: Meh },
                  { v: 'frequent', label: '자주', Icon: AlertTriangle },
                  { v: 'always', label: '매번', Icon: AlertCircle },
                ].map(({ v, label, Icon }) => {
                  const active = giSensitivity === v
                  return (
                    <button
                      key={v}
                      type="button"
                      className={'s-chip' + (active ? ' s-on' : '')}
                      aria-pressed={active}
                      onClick={() => setGiSensitivity(v as typeof giSensitivity)}
                    >
                      <Icon size={13} strokeWidth={2} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {currentStep === 'diet' && (
          <div className="s-page">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span className="s-kicker">EATING HABITS</span>
            </div>
            <h1 className="s-title">식생활을<br />알려주세요</h1>
            <p className="s-sub">현재 식이 패턴이 영양 권장량 계산의 기준이 돼요.</p>

            <div className="s-sect">
              <div className="s-sect-lbl"><span className="s-label-text">주식 형태</span></div>
              <div className="s-tilerow">
                {[
                  { v: '건식 사료', label: '건식', meta: '사료/킵블', Icon: Wheat },
                  { v: '습식/화식', label: '습식·화식', meta: '캔/홈쿡', Icon: CookingPot },
                  { v: '반반', label: '반반', meta: '혼합', Icon: Combine },
                ].map(({ v, label, meta, Icon }) => {
                  const active = foodType === v
                  return (
                    <button
                      key={v}
                      type="button"
                      className={'s-tile' + (active ? ' s-on' : '')}
                      aria-pressed={active}
                      onClick={() => setFoodType(v)}
                    >
                      <span className="s-ic">
                        <Icon
                          size={20}
                          strokeWidth={1.7}
                          color={active ? 'var(--bg)' : 'var(--ink)'}
                        />
                      </span>
                      <span className="s-tile-lb">{label}</span>
                      <span className="s-meta">{meta}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="s-sect">
              <div className="s-sect-lbl">
                <span className="s-label-text">현재 사용 중인 브랜드</span>
                <span className="s-opt">선택</span>
              </div>
              <input
                type="text"
                className="s-inp"
                value={currentBrand}
                onChange={(e) => setCurrentBrand(e.target.value)}
                placeholder="예: 로얄캐닌 미니어처닥스훈트"
              />
            </div>

            <div className="s-sect">
              <div className="s-sect-lbl"><span className="s-label-text">간식 빈도</span></div>
              <div className="s-chiprow">
                {[
                  { v: '거의 안 줌', label: '거의 안 줌', Icon: Minus },
                  { v: '가끔', label: '가끔', Icon: Plus },
                  { v: '매일', label: '매일', Icon: PlusCircle },
                ].map(({ v, label, Icon }) => {
                  const active = snackFreq === v
                  return (
                    <button
                      key={v}
                      type="button"
                      className={'s-chip' + (active ? ' s-on' : '')}
                      aria-pressed={active}
                      onClick={() => setSnackFreq(v)}
                    >
                      <Icon size={13} strokeWidth={2} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="s-sect">
              <div className="s-sect-lbl"><span className="s-label-text">식욕</span></div>
              <div className="s-chiprow">
                {[
                  { v: 'strong', label: '왕성', Icon: Flame },
                  { v: 'normal', label: '정상', Icon: Smile },
                  { v: 'picky', label: '까다로움', Icon: Meh },
                  { v: 'reduced', label: '식욕 감퇴', Icon: Frown },
                ].map(({ v, label, Icon }) => {
                  const active = taste === v
                  return (
                    <button
                      key={v}
                      type="button"
                      className={'s-chip' + (active ? ' s-on' : '')}
                      aria-pressed={active}
                      onClick={() => setTaste(v as typeof taste)}
                    >
                      <Icon size={13} strokeWidth={2} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="s-sect">
              <div className="s-sect-lbl">
                <span className="s-label-text">하루 산책 시간</span>
                <span className="s-opt">선택</span>
              </div>
              <div className="s-input-suffix">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={300}
                  className="s-inp"
                  value={walkMinutes}
                  onChange={(e) => setWalkMinutes(e.target.value)}
                  placeholder="30"
                />
                <span className="s-unit">분 / 일</span>
              </div>
            </div>

            <div className="s-sect">
              <div className="s-sect-lbl">
                <span className="s-label-text">산책 외 실내 활동</span>
                <span className="s-opt">선택</span>
              </div>
              <div className="s-chiprow">
                {[
                  { v: 'calm', label: '차분', Icon: Pause },
                  { v: 'moderate', label: '보통', Icon: Activity },
                  { v: 'active', label: '활발', Icon: Heart },
                ].map(({ v, label, Icon }) => {
                  const active = indoorActivity === v
                  return (
                    <button
                      key={v}
                      type="button"
                      className={'s-chip' + (active ? ' s-on' : '')}
                      aria-pressed={active}
                      onClick={() => setIndoorActivity(v as typeof indoorActivity)}
                    >
                      <Icon size={13} strokeWidth={2} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="s-sect">
              <div className="s-sect-lbl"><span className="s-label-text">화식 경험</span></div>
              <div className="s-tilerow">
                {[
                  { v: 'first', label: '처음', meta: '첫 도입', Icon: Sparkles },
                  { v: 'occasional', label: '가끔', meta: '경험 있음', Icon: Soup },
                  { v: 'frequent', label: '자주', meta: '매일/익숙', Icon: Check },
                ].map(({ v, label, meta, Icon }) => {
                  const active = homeCookingExp === v
                  return (
                    <button
                      key={v}
                      type="button"
                      className={'s-tile' + (active ? ' s-on' : '')}
                      aria-pressed={active}
                      onClick={() => setHomeCookingExp(v as typeof homeCookingExp)}
                    >
                      <span className="s-ic">
                        <Icon
                          size={20}
                          strokeWidth={1.7}
                          color={active ? 'var(--bg)' : 'var(--ink)'}
                        />
                      </span>
                      <span className="s-tile-lb">{label}</span>
                      <span className="s-meta">{meta}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="s-sect">
              <div className="s-sect-lbl"><span className="s-label-text">지금 식이 만족도</span></div>
              <div className="s-rate-row">
                {([1, 2, 3, 4, 5] as const).map((s) => {
                  const active = dietSatisfaction === s
                  const labels = ['매우 불만', '불만', '보통', '만족', '매우 만족']
                  return (
                    <button
                      key={s}
                      type="button"
                      className="s-rate"
                      aria-pressed={active}
                      onClick={() => setDietSatisfaction(s)}
                    >
                      <span className="s-rate-num">{s}</span>
                      <span className="s-rate-lb">{labels[s - 1]}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {currentStep === 'allergy' && (
          <div className="s-page">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span className="s-kicker">ALLERGIES</span>
            </div>
            <h1 className="s-title">피해야 할<br />재료가 있나요?</h1>
            <p className="s-sub">알레르기 + 선호 단백질을 함께 알려주시면 정확도가 올라가요.</p>

            <div className="s-sect">
              <div className="s-sect-lbl"><span className="s-label-text">알레르기 유무</span></div>
              <div className="s-seg">
                <button
                  type="button"
                  aria-pressed={dlMode === 'none'}
                  onClick={() => {
                    setDlMode('none')
                    setAllergies([])
                  }}
                >
                  <Check size={16} strokeWidth={2} />
                  없어요
                </button>
                <button
                  type="button"
                  aria-pressed={dlMode === 'unknown'}
                  onClick={() => {
                    setDlMode('unknown')
                    setAllergies([])
                  }}
                >
                  <HelpCircle size={16} strokeWidth={2} />
                  잘 몰라요
                </button>
                <button
                  type="button"
                  className="s-danger"
                  aria-pressed={dlMode === 'has'}
                  onClick={() => setDlMode('has')}
                >
                  <AlertTriangle size={16} strokeWidth={2} />
                  있어요
                </button>
              </div>
              {dlMode === 'has' && (
                <div className="s-chiprow" style={{ marginTop: 12 }}>
                  {ALLERGY_OPTIONS.map((v) => {
                    const active = allergies.includes(v)
                    return (
                      <button
                        key={v}
                        type="button"
                        className={'s-chip' + (active ? ' s-on' : '')}
                        aria-pressed={active}
                        onClick={() => toggleArr(allergies, v, setAllergies)}
                      >
                        {v}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="s-sect">
              <div className="s-sect-lbl">
                <span className="s-label-text">잘 먹는 단백질</span>
                <span className="s-opt">선택 · 복수</span>
              </div>
              <div className="s-chiprow">
                {PROTEIN_OPTIONS.map(({ v, label }) => {
                  const active = preferredProteins.includes(v)
                  return (
                    <button
                      key={v}
                      type="button"
                      className={'s-chip' + (active ? ' s-on' : '')}
                      aria-pressed={active}
                      onClick={() => toggleArr(preferredProteins, v, setPreferredProteins)}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {currentStep === 'chronic' && (
          <div className="s-page">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span className="s-kicker">
                HEALTH <span className="s-dot">·</span> 만성질환
              </span>
              <span className="s-opt-badge">선택</span>
            </div>
            <h1 className="s-title">현재 진단받은<br />질환이 있나요?</h1>
            <p className="s-sub">
              식이가 핵심 치료의 일부인 질환은 분기에 꼭 필요해요.
              <span className="s-pill">없으면 건너뛰세요</span>
            </p>

            <div className="s-chiprow">
              {(Object.keys(CHRONIC_CONDITION_LABELS) as ChronicConditionKey[]).map((k) => {
                const active = chronicConditions.includes(k)
                return (
                  <button
                    key={k}
                    type="button"
                    className={'s-chip s-terra' + (active ? ' s-on' : '')}
                    aria-pressed={active}
                    onClick={() => toggleArr(chronicConditions, k, setChronicConditions)}
                  >
                    {active && <Check size={13} strokeWidth={2.4} color="#fff" />}
                    {CHRONIC_CONDITION_LABELS[k]}
                  </button>
                )
              })}
            </div>

            {/* v1.3 — CKD 진단 시 IRIS stage. Stage 1-2 는 단백질 정상 처방,
                Stage 3+ 는 단백질 제한. 미입력 시 보수적 (Stage 3+) 처방. */}
            {chronicConditions.includes('kidney') && (
              <div className="s-sect">
                <div className="s-sect-lbl">
                  <span className="s-label-text">CKD IRIS 단계</span>
                  <span className="s-opt">선택</span>
                </div>
                <p className="s-sub" style={{ fontSize: 11, marginBottom: 8 }}>
                  수의사가 알려준 단계가 있으면 골라 주세요. 미입력 시 보수적
                  처방 (단백질 제한) 적용.
                </p>
                <div className="s-chiprow">
                  {([1, 2, 3, 4] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={
                        's-chip s-terra' + (irisStage === s ? ' s-on' : '')
                      }
                      aria-pressed={irisStage === s}
                      onClick={() =>
                        setIrisStage(irisStage === s ? null : s)
                      }
                    >
                      {irisStage === s && (
                        <Check size={13} strokeWidth={2.4} color="#fff" />
                      )}
                      Stage {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="s-sect">
              <div className="s-sect-lbl">
                <span className="s-label-text">처방식</span>
                <span className="s-opt">선택</span>
              </div>
              <input
                type="text"
                className="s-inp"
                value={prescriptionDiet}
                onChange={(e) => setPrescriptionDiet(e.target.value)}
                placeholder="예: Royal Canin Renal RF14"
              />
            </div>

            <div className="s-sect">
              <div className="s-sect-lbl">
                <span className="s-label-text">복용 중인 약 / 보충제</span>
                <span className="s-opt">선택</span>
              </div>
              <textarea
                className="s-inp"
                rows={2}
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                placeholder="예: 갑상선 호르몬, 글루코사민, 오메가-3"
              />
              {/* 약물 키워드 → 만성질환 자동 제안 (사용자 confirm 후 추가) */}
              {(() => {
                const matches = detectChronicFromMedications(medications)
                  .filter((m) => !chronicConditions.includes(m.condition))
                if (matches.length === 0) return null
                return (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      background: 'var(--bg-2)',
                      borderRadius: 10,
                      fontSize: 11.5,
                      color: 'var(--muted)',
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ marginBottom: 6 }}>
                      💡 입력한 약물에서 진단 가능성을 발견했어요. 해당하면 추가:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {matches.map((m) => (
                        <button
                          key={m.condition}
                          type="button"
                          onClick={() =>
                            setChronicConditions([...chronicConditions, m.condition])
                          }
                          style={{
                            appearance: 'none',
                            border: '1px solid var(--terracotta)',
                            background: '#fff',
                            color: 'var(--terracotta)',
                            padding: '4px 10px',
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 700,
                            fontFamily: 'inherit',
                            cursor: 'pointer',
                          }}
                        >
                          + {m.label}
                          <span
                            style={{
                              fontSize: 9,
                              fontFamily: 'var(--font-mono), monospace',
                              marginLeft: 4,
                              color: 'var(--muted)',
                              fontWeight: 500,
                            }}
                          >
                            {m.keyword}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>

            {chronicConditions.length > 0 && (
              <div className="s-note">
                <span className="s-ic-warn">
                  <ShieldAlert size={13} strokeWidth={2.2} color="#fff" />
                </span>
                <span>
                  분석 결과는 <strong>가이드라인 기반 권장</strong>이에요. 처방식·약물
                  변경은 반드시 주치 수의사와 상담 후 진행해 주세요.
                </span>
              </div>
            )}
          </div>
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

            <div className="s-sect">
              <div className="s-sect-lbl"><span className="s-label-text">임신 / 수유 상태</span></div>
              <div className="s-chiprow">
                {[
                  { v: 'none', label: '해당 없음', Icon: Check },
                  { v: 'pregnant', label: '임신 중', Icon: Baby },
                  { v: 'lactating', label: '수유 중', Icon: Heart },
                ].map(({ v, label, Icon }) => {
                  const active = pregnancy === v
                  return (
                    <button
                      key={v}
                      type="button"
                      className={'s-chip' + (active ? ' s-on' : '')}
                      aria-pressed={active}
                      onClick={() => setPregnancy(v as typeof pregnancy)}
                    >
                      <Icon size={13} strokeWidth={2} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* v1.3 — 임신 주차 (1-9). NRC 2006 ch.15 — 후기 (≥6주차) RER × 1.6-2.0 */}
            {pregnancy === 'pregnant' && (
              <div className="s-sect">
                <div className="s-sect-lbl">
                  <span className="s-label-text">임신 주차</span>
                  <span className="s-opt">선택</span>
                </div>
                <p className="s-sub" style={{ fontSize: 11, marginBottom: 8 }}>
                  6주차 이후가 영양 요구량이 본격적으로 ↑. 미입력 시 보수적
                  multiplier (×1.5).
                </p>
                <input
                  type="number"
                  className="s-inp"
                  min={1}
                  max={9}
                  step={1}
                  value={pregnancyWeek ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setPregnancyWeek(v === '' ? null : Math.max(1, Math.min(9, Number(v))))
                  }}
                  placeholder="1-9"
                />
              </div>
            )}

            {/* v1.3 — 수유 산자수. NRC 2006 Table 15-3 — RER × (2.0+0.25n) */}
            {pregnancy === 'lactating' && (
              <div className="s-sect">
                <div className="s-sect-lbl">
                  <span className="s-label-text">산자 수</span>
                  <span className="s-opt">선택</span>
                </div>
                <p className="s-sub" style={{ fontSize: 11, marginBottom: 8 }}>
                  수유 영양 요구량은 산자 수에 비례 (×2.0~4.0). 미입력 시 ×2.0.
                </p>
                <input
                  type="number"
                  className="s-inp"
                  min={1}
                  max={15}
                  step={1}
                  value={litterSize ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setLitterSize(v === '' ? null : Math.max(1, Math.min(15, Number(v))))
                  }}
                  placeholder="1-15"
                />
              </div>
            )}

            {/* v1.3 — 대형견 puppy Ca cap. <18mo puppy 만 노출. AAFCO 2024. */}
            {dog &&
              (dog.age_unit === 'years'
                ? dog.age_value * 12 < 18
                : dog.age_value < 18) && (
                <div className="s-sect">
                  <div className="s-sect-lbl">
                    <span className="s-label-text">예상 성견 체중 (kg)</span>
                    <span className="s-opt">선택</span>
                  </div>
                  <p className="s-sub" style={{ fontSize: 11, marginBottom: 8 }}>
                    18개월 미만 강아지 — 25kg+ 대형견은 Ca 1.8% DM 상한
                    (AAFCO 2024) 권고. 정확한 처방을 위해 입력해 주세요.
                  </p>
                  <input
                    type="number"
                    className="s-inp"
                    min={0.5}
                    max={100}
                    step={0.5}
                    value={expectedAdultWeightKg ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      setExpectedAdultWeightKg(
                        v === ''
                          ? null
                          : Math.max(0.5, Math.min(100, Number(v))),
                      )
                    }}
                    placeholder="예: 30 (대형견)"
                  />
                </div>
              )}

            <div className="s-sect">
              <div className="s-sect-lbl">
                <span className="s-label-text">모질·피부 상태</span>
                <span className="s-opt">선택</span>
              </div>
              <div className="s-chiprow">
                {[
                  { v: 'healthy', label: '건강', Icon: Sparkles },
                  { v: 'dull', label: '푸석', Icon: Wind },
                  { v: 'shedding', label: '심한 탈모', Icon: Scissors },
                  { v: 'itchy', label: '가려움', Icon: AlertTriangle },
                  { v: 'lesions', label: '병변', Icon: Stethoscope },
                ].map(({ v, label, Icon }) => {
                  const active = coat === v
                  return (
                    <button
                      key={v}
                      type="button"
                      className={'s-chip' + (active ? ' s-on' : '')}
                      aria-pressed={active}
                      onClick={() => setCoat(active ? '' : (v as typeof coat))}
                    >
                      <Icon size={13} strokeWidth={2} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="s-sect">
              <div className="s-sect-lbl">
                <span className="s-label-text">가장 신경 쓰고 싶은 케어 목표</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {CARE_GOAL_OPTIONS.map(({ v, label, desc, Icon }) => {
                  const active = careGoal === v
                  return (
                    <button
                      key={v}
                      type="button"
                      className="s-listbtn"
                      aria-pressed={active}
                      onClick={() => setCareGoal(v)}
                    >
                      <span
                        className="s-lb-icon"
                        style={{
                          background: active
                            ? 'rgba(255,255,255,.12)'
                            : 'var(--bg-2)',
                        }}
                      >
                        <Icon
                          size={20}
                          strokeWidth={1.8}
                          color={active ? 'var(--bg)' : 'var(--terracotta)'}
                        />
                      </span>
                      <span className="s-lb-body">
                        <span className="s-lb-title">{label}</span>
                        <span className="s-lb-sub">{desc}</span>
                      </span>
                      {active && (
                        <Check
                          size={16}
                          strokeWidth={2.5}
                          color="var(--bg)"
                          style={{ flex: '0 0 auto' }}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
              <p style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
                이 답이 첫 박스의 화식 라인 메인을 결정해요. 이후 매월 체크인으로 비율이 조정됩니다.
              </p>
            </div>

            <div className="s-hint" style={{ marginTop: 24 }}>
              <div className="s-iconwrap">
                <Sparkles size={14} strokeWidth={2} />
              </div>
              <div>
                <strong>준비 끝!</strong> 결과 보기를 누르면 NRC·AAFCO·FEDIAF·WSAVA
                가이드라인에 맞춰 맞춤 영양 분석이 시작돼요.
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="s-loading-page">
            <div className="s-orb">
              <DogIcon size={38} strokeWidth={1.4} />
            </div>
            <span className="s-kicker">ANALYZING</span>
            <h2 className="s-title" style={{ fontSize: 24, margin: '6px 0 8px' }}>
              {dog.name} 맞춤 영양<br />설계 중이에요
            </h2>
            <p
              style={{
                fontSize: 11.5,
                color: 'var(--muted)',
                lineHeight: 1.7,
                fontFamily: 'var(--font-mono), JetBrains Mono, monospace',
                letterSpacing: 0.04,
              }}
            >
              NRC 2006 · AAFCO 2024
              <br />
              FEDIAF 2021 · WSAVA
            </p>
            <ul className="s-stages">
              {[
                '체형 평가 처리',
                'RER · MER 계산 중',
                'AAFCO 매크로 비교',
                '맞춤 보충제 매핑',
              ].map((s, i) => {
                const cls =
                  i < loadingStage ? 's-done' : i === loadingStage ? 's-active' : ''
                return (
                  <li key={i} className={cls}>
                    <span className="s-ic-stage">
                      {i < loadingStage ? (
                        <Check size={11} strokeWidth={3} color="#fff" />
                      ) : i === loadingStage ? (
                        <Loader2 size={11} strokeWidth={2.5} color="#fff" />
                      ) : null}
                    </span>
                    {s}
                  </li>
                )
              })}
            </ul>
            <div className="s-dots" style={{ marginTop: 24 }}>
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        {err && !isLoading && (
          <div className="s-errbar">
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
