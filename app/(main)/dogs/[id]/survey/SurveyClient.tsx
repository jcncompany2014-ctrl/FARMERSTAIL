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
import { todayKstIsoDate, addDaysKst } from '@/lib/datetime-kst'
import { weightReliability } from '@/lib/personalization/reliability'
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
import Body, { type BodyAssessmentState } from './steps/Body'
import { deriveBCS } from '@/lib/calorie-v2/engine'
import { detectBcsWeightConflict } from '@/lib/bcs-consistency'
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
 *     (muscle(MCS) 스텝은 2026-07-23 사장님 지시로 완전 제거 — 노령견 조건부
 *      노출도 폐지. mcs 상태/저장 배선은 하위호환으로 유지, 신규는 항상 null.)
 *   3. stool      : Bristol Stool 1~7 + 위장 민감도
 *   4. meal       : 주식 / 브랜드(+사료kcal) / 간식(+간식kcal) / 화식경험
 *   5. life       : 산책(리드) / 활동·격운동(조건부) / 주거(+한랭)
 *     (정돈 P2: 옛 diet 스텝을 식사/생활 2스텝으로 분리. 식욕·만족도 삭제됨.)
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

// 2026-07-14 사장님: 'budget'(권장가격/예산) step 폐기 — 설문에서 가격을 묻지
// 않는다. status 가 마지막 입력 step → loading. (surveys.budget_tier 은 null 로
// 저장, feeding-plan 은 null fallback 이라 무영향.)
const STEPS = [
  'body',
  'stool',
  'meal',
  'life',
  'allergy',
  'chronic',
  'status',
  'loading',
] as const
type Step = (typeof STEPS)[number]

export default function SurveyClient({
  dogId,
  previous,
}: {
  dogId: string
  /** 직전 분석 스냅샷 — 체중↔체형 모순 검증의 비교 기준. 첫 설문이면 null. */
  previous?: { bcs: number; weightKg: number } | null
}) {
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

  // 1. body — 칼로리 v2 M2a: 체형 3분해(갈비뼈·허리·배) → deriveBCS 역산.
  // bcs 는 파생값으로 유지(저장·검증·결과 파이프라인 하위호환 — 옛 초안의
  // 직접선택 bcs 복원도 그대로 유효).
  const [bodyAssess, setBodyAssess] = useState<BodyAssessmentState>({
    ribs: '',
    waist: '',
    abdomen: '',
  })
  const [bcs, setBcs] = useState<BcsKey | null>(null)
  const onBodyAssess = (patch: Partial<BodyAssessmentState>) => {
    const next = { ...bodyAssess, ...patch }
    setBodyAssess(next)
    if (next.ribs && next.waist && next.abdomen) {
      setBcs(
        deriveBCS({
          ribs: next.ribs,
          waist: next.waist,
          abdomen: next.abdomen,
        }) as BcsKey,
      )
    }
  }
  // [발명 모듈 D] 체중 측정 방법 — 신뢰도(W_method) 입력. 미입력 시 dog 프로필
  // 값 사용. 새로 고르면 dogs 갱신 + 측정일=오늘.
  const [weightMethod, setWeightMethod] = useState<
    'vet_scale' | 'home_digital' | 'hold' | 'eyeball' | 'unknown' | ''
  >('')
  // 칼로리 v2 2b — 사다리 감산·가산 신호 4종 ('' = 미응답 → 무보정).
  const [easyKeeper, setEasyKeeper] = useState<'' | 'yes' | 'no'>('')
  const [vigorous, setVigorous] = useState<'' | 'none' | 'self' | 'objective'>('')
  const [housing, setHousing] = useState<
    '' | 'indoor' | 'indoor_outdoor' | 'outdoor'
  >('')
  const [coldOutdoor, setColdOutdoor] = useState<'' | 'yes' | 'no'>('')
  // 2. muscle
  const [mcs, setMcs] = useState<McsKey | null>(null)
  // 3. stool
  const [bristol, setBristol] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | null>(null)
  // 4. diet
  const [foodType, setFoodType] = useState('')
  const [snackFreq, setSnackFreq] = useState('')
  // 칼로리 v2 2d — 하루 간식 kcal (선택 숫자 입력. '' = 모름 → 빈도 추정).
  const [treatKcal, setTreatKcal] = useState('')
  // 칼로리 v2 5단계 — 건사료 라벨 열량 kcal/kg ('' = 모름 → 평균 350/100g).
  const [kibbleKcal, setKibbleKcal] = useState('')
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
  // 췌장염 중증도 — 급성/중증 → 화식 부적합 하드 게이트 (firstBox). 미입력 =
  // 만성(moderate). diagnosedSeverity 로 answers JSONB 에 라이드.
  const [pancreatitisSeverity, setPancreatitisSeverity] = useState<
    'moderate' | 'severe' | null
  >(null)
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

  // Tier S F1-1: 예산 4-옵션 (선택, 미응답 시 mix50 default)

  // loading 단계 stage 인디케이터
  const [loadingStage, setLoadingStage] = useState(0)

  // R37c (#3) — 설문 진행 중 (입력 일부 완료) 이탈 시 browser confirm.
  // autosave 가 작동하지만 사용자에게 명시적 안내. 'loading' step 은 제외
  // (submit 직후 router.push 가 unload 트리거 — 막으면 안 됨).
  useEffect(() => {
    if (currentStep === 'loading') return
    const hasAnyInput =
      bcs !== null || mcs !== null || bristol !== null || foodType !== ''
    if (!hasAnyInput) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [currentStep, bcs, mcs, bristol, foodType])

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
        .select('id, name, weight, age_value, age_unit, neutered, activity_level, gender, breed, weight_method, weight_measured_at')
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
      if (data.bodyAssess && typeof data.bodyAssess === 'object')
        setBodyAssess(data.bodyAssess as BodyAssessmentState)
      if (typeof data.easyKeeper === 'string')
        setEasyKeeper(data.easyKeeper as typeof easyKeeper)
      if (typeof data.vigorous === 'string')
        setVigorous(data.vigorous as typeof vigorous)
      if (typeof data.housing === 'string')
        setHousing(data.housing as typeof housing)
      if (typeof data.coldOutdoor === 'string')
        setColdOutdoor(data.coldOutdoor as typeof coldOutdoor)
      if (typeof data.weightMethod === 'string')
        setWeightMethod(data.weightMethod as typeof weightMethod)
      if (data.mcs !== undefined) setMcs(data.mcs as McsKey | null)
      if (data.bristol !== undefined)
        setBristol(data.bristol as typeof bristol)
      if (typeof data.foodType === 'string') setFoodType(data.foodType)
      if (typeof data.snackFreq === 'string') setSnackFreq(data.snackFreq)
      if (typeof data.treatKcal === 'string') setTreatKcal(data.treatKcal)
      if (typeof data.kibbleKcal === 'string') setKibbleKcal(data.kibbleKcal)
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
      if (data.pancreatitisSeverity !== undefined)
        setPancreatitisSeverity(
          data.pancreatitisSeverity as typeof pancreatitisSeverity,
        )
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
      // 해 사용자가 처음부터 다시 안 하도록. ('budget' 초안은 아래 STEPS
      // 화이트리스트에서 자동 탈락 → 첫 step 으로.)
      if (typeof data.currentStep === 'string') {
        if (data.currentStep === 'loading') {
          setCurrentStep('status')
        } else if (data.currentStep === 'diet') {
          // 정돈 P2 전 초안 호환 — 'diet' 스텝은 'meal'/'life' 로 분리됨.
          setCurrentStep('meal')
        } else if ((STEPS as readonly string[]).includes(data.currentStep)) {
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
  // R97-C (D7): budget→loading 단계의 2.8초 연출 타이머. ref 에 저장해서
  // 언마운트 시 clear — 사용자가 loading 중 뒤로가기/탭전환으로 언마운트되면
  // saveAndGoResult 가 언마운트 후 setState + 원치 않는 router.push + 중복
  // surveys/analyses insert 를 일으켰음.
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 설문 제출 재진입 가드 — 빠른 더블클릭/재시도로 surveys·analyses 가 중복
  // insert 되는 것을 막는다 (saving state 는 비동기라 같은 tick 더블콜에 취약 → ref).
  const submitGuardRef = useRef(false)
  // 언마운트 후 navigation/타이머 발동 방지 — 저장은 즉시 하되, 결과로의
  // 이동(타이머)은 컴포넌트가 살아있을 때만 예약한다.
  const mountedRef = useRef(true)
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current)
    }
  }, [])
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
            bodyAssess,
            easyKeeper,
            vigorous,
            housing,
            coldOutdoor,
            weightMethod,
            mcs,
            bristol,
            foodType,
            snackFreq,
            treatKcal,
            kibbleKcal,
            taste,
            walkMinutes,
            currentBrand,
            dlMode,
            allergies,
            chronicConditions,
            prescriptionDiet,
            medications,
            irisStage,
            pancreatitisSeverity,
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
    bodyAssess,
    easyKeeper,
    vigorous,
    housing,
    coldOutdoor,
    weightMethod,
    mcs,
    bristol,
    foodType,
    snackFreq,
    treatKcal,
    kibbleKcal,
    taste,
    walkMinutes,
    currentBrand,
    dlMode,
    allergies,
    chronicConditions,
    prescriptionDiet,
    medications,
    irisStage,
    pancreatitisSeverity,
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

  // (MCS 스텝 완전 제거 — 2026-07-23 사장님. 옛 노령견 7세+ 조건부 노출도 폐지.
  //  ageInMonths/isSenior 는 bcsConflict lifeStage 판정에 계속 쓰인다.)
  const ageInMonths = dog
    ? dog.age_unit === 'years'
      ? dog.age_value * 12
      : dog.age_value
    : 0
  const isSenior = ageInMonths >= 84
  const steps = STEPS

  // 체중↔체형 모순 — "살이 빠졌는데 체형이 더 뚱뚱해질 수는 없잖아"(사장님
  // 2026-07-14). 체형 3문항이 끝나 BCS 가 역산되는 순간 이전 분석과 비교해
  // 그 자리에서 짚어준다. 막지는 않는다 — 경고만 하고 진행은 시킨다.
  const bcsConflict = detectBcsWeightConflict({
    dogName: dog?.name ?? '',
    prevBcs: previous?.bcs,
    prevWeightKg: previous?.weightKg,
    currentBcs: bcs,
    currentWeightKg: dog?.weight,
    lifeStage: ageInMonths < 12 ? 'puppy' : isSenior ? 'senior' : 'adult',
  })

  const stepIdx = steps.indexOf(currentStep)
  const totalSteps = steps.length - 1
  const progress = Math.min(100, Math.round((stepIdx / totalSteps) * 100))

  function validateStep(): boolean {
    setErr('')
    if (currentStep === 'body' && bcs === null) {
      setErr('체형(BCS)을 선택해 주세요')
      return false
    }
    if (currentStep === 'meal') {
      if (!foodType) {
        setErr('주식 형태를 선택해 주세요')
        return false
      }
      if (!snackFreq) {
        setErr('간식 빈도를 선택해 주세요')
        return false
      }
      if (!homeCookingExp) {
        setErr('화식 경험 정도를 선택해 주세요')
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
    const idx = steps.indexOf(currentStep)
    // status 가 마지막 입력 step → loading (2026-07-14 budget step 폐기).
    if (currentStep === 'status') {
      setCurrentStep('loading')
      setLoadingStage(0)
      // P0(설문 유실 방지): 저장을 즉시 시작한다. 예전엔 2.8초 타이머 뒤에
      // 저장했는데, 그 사이 사용자가 화면을 떠나면 unmount cleanup 이 타이머를
      // 지워 저장이 영영 실행되지 않았다 → 설문·분석 통째 유실. 이제 저장은
      // 바로 하고, "분석 중" 애니메이션 최소 노출은 saveAndGoResult 가 결과로
      // 이동하기 직전에 확보한다 (저장이 끝난 뒤라 그 지연 중 이탈해도 안전).
      void saveAndGoResult()
      return
    }
    if (idx < steps.length - 1) setCurrentStep(steps[idx + 1]!)
  }

  function goPrev() {
    const idx = steps.indexOf(currentStep)
    if (idx > 0) {
      setErr('')
      setCurrentStep(steps[idx - 1]!)
    }
  }

  async function saveAndGoResult() {
    if (!dog || submitGuardRef.current) return
    submitGuardRef.current = true
    const startedAt = Date.now()
    setSaving(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      // R97-C (D7): setSaving(false) 누락 시 세션 만료 사용자의 제출 버튼이
      // 영구 disabled(saving=true) 로 굳음. login redirect 전 해제.
      setSaving(false)
      submitGuardRef.current = false
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
      // 경고를 봤는데도 그대로 제출한 경우 — 분석에 플래그로 남긴다(막지 않음).
      bcsWeightConflict: bcsConflict?.kind,
      // 3분해 원응답 — 기록·재분석용 (bcsExact 가 이 응답의 역산값).
      bodyAssessment:
        bodyAssess.ribs && bodyAssess.waist && bodyAssess.abdomen
          ? {
              ribs: bodyAssess.ribs,
              waist: bodyAssess.waist,
              abdomen: bodyAssess.abdomen,
            }
          : undefined,
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
      // 칼로리 v2 2d — 간식 kcal (10% 캡 차감 + 초과 식별은 nutrition 에서).
      treatKcalPerDay: treatKcal
        ? Math.max(0, Math.min(2000, Number(treatKcal) || 0))
        : undefined,
      // 칼로리 v2 5단계 — 건사료 라벨 kcal/kg → /100g 환산 (200~600 clamp).
      kibbleKcalPer100g: kibbleKcal
        ? Math.max(200, Math.min(600, (Number(kibbleKcal) || 0) / 10))
        : undefined,
      // 칼로리 v2 2b — 사다리 신호 (미응답 = undefined → 무보정).
      isEasyKeeper: easyKeeper === '' ? undefined : easyKeeper === 'yes',
      vigorousExercise:
        vigorous === '' ? undefined : vigorous === 'self' ? 'self_report' : vigorous,
      housing: housing || undefined,
      coldExposure: coldOutdoor === '' ? undefined : coldOutdoor === 'yes',
      currentFoodBrand: currentBrand.trim() || undefined,
      careGoal: careGoal || undefined,
      homeCookingExperience: homeCookingExp || undefined,
      currentDietSatisfaction: dietSatisfaction ?? undefined,
      weightTrend6mo: weightTrend || undefined,
      giSensitivity: giSensitivity || undefined,
      preferredProteins: preferredProteins as SurveyAnswers['preferredProteins'],
      indoorActivity: indoorActivity || undefined,
      // 췌장염 중증도 → answers JSONB 라이드. compute route 가 firstBox
      // diagnosedSeverity 로 주입 (급성/중증 → 화식 부적합 하드 게이트).
      diagnosedSeverity:
        pancreatitisSeverity && chronicConditions.includes('pancreatitis')
          ? { pancreatitis: pancreatitisSeverity }
          : undefined,
    }

    // Tier S F1-1: budget_tier 컬럼이 migration 20260520+ 에서 추가됨.
    // generated types 재생성 전이라 insert payload 자체를 cast 로 우회.
    // 다음 typegen 후 cast 제거 가능.
    const surveyInsertPayload = {
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
      iris_stage: chronicConditions.includes('kidney') ? irisStage : null,
      pregnancy_week: pregnancy === 'pregnant' ? pregnancyWeek : null,
      litter_size: pregnancy === 'lactating' ? litterSize : null,
      expected_adult_weight_kg:
        dog && (dog.age_unit === 'years'
          ? dog.age_value * 12 < 18
          : dog.age_value < 18)
          ? expectedAdultWeightKg
          : null,
      // 2026-07-14: 설문에서 예산을 묻지 않음(budget step 폐기) → 항상 null.
      // 컬럼은 유지(레거시 row 보존). feeding-plan 은 null fallback 이라 무영향.
      budget_tier: null,
    }

    const { data: surveyData, error: surveyErr } = await (
      supabase.from('surveys') as unknown as {
        insert: (v: typeof surveyInsertPayload) => {
          select: () => {
            single: () => Promise<{
              data: { id: string } | null
              error: { message?: string } | null
            }>
          }
        }
      }
    )
      .insert(surveyInsertPayload)
      .select()
      .single()

    if (surveyErr || !surveyData) {
      toast.error('저장하지 못했어요')
      setErr('저장하지 못했어요')
      setSaving(false)
      submitGuardRef.current = false // 재시도 허용
      // 실패 시 loading 화면에 inline 재시도 + "이전 단계로" 탈출구 제공.
      return
    }

    if (prescriptionDiet.trim()) {
      await supabase
        .from('dogs')
        .update({ prescription_diet: prescriptionDiet.trim() })
        .eq('id', dogId)
        .eq('user_id', user.id)
    }

    // 칼로리 v2 5단계(M9b) — 사료 DB 자가성장 로그: 건식/반반인데 브랜드만
    // 알고 kcal 을 모르는 케이스 → kibble_requests (다음 매장 투어 쇼핑리스트).
    // silent fail — 설문 완료 흐름을 막지 않는다.
    if (
      (foodType === '건식 사료' || foodType === '반반') &&
      currentBrand.trim() &&
      !kibbleKcal
    ) {
      try {
        // 신규 테이블 — generated types 미반영 → cast (reweighs 선례).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('kibble_requests').insert({
          user_id: user.id,
          raw_input: currentBrand.trim(),
        })
      } catch {
        /* 로그 실패 무시 */
      }
    }

    // [발명 모듈 D] 체중 측정 방법/일자 — 설문에서 새로 고른 값 우선 (측정일=
    // 오늘, 현 체중 affirm), 없으면 dog 프로필. 새로 고르면 dogs 갱신해 이후
    // 분석·신뢰도가 최신 도구를 반영.
    const effWeightMethod =
      weightMethod ||
      (dog as { weight_method?: string | null }).weight_method
    const effWeightMeasuredAt = weightMethod
      ? new Date().toISOString()
      : (dog as { weight_measured_at?: string | null }).weight_measured_at ??
        null
    if (weightMethod) {
      await (
        supabase.from('dogs') as unknown as {
          update: (v: {
            weight_method: string
            weight_measured_at: string
          }) => {
            eq: (c: string, v: string) => {
              eq: (c: string, v: string) => Promise<unknown>
            }
          }
        }
      )
        .update({
          weight_method: weightMethod,
          weight_measured_at: effWeightMeasuredAt as string,
        })
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
        // [발명 모듈 D] 체중 신뢰도 → 비대칭 케어목표 안전 보정 입력.
        weightReliability: weightReliability(
          effWeightMethod,
          effWeightMeasuredAt,
        ),
        // 칼로리 v2 2c — 자견 NRC 정확식(130) 입력. 설문이 수집만 하고
        // 계산에 안 넘기던 것 연결 (large-breed puppy 임계 판정에도 사용).
        expectedAdultWeight: expectedAdultWeightKg ?? null,
        // 칼로리 v2 4단계 — 견종 플래그(비만경향·토이·단두종) 파생용.
        breed: (dog as { breed?: string | null }).breed ?? null,
      },
      answers,
    )
    const supps = [
      ...getSupplements(legacyHealthConcerns).map((s) => s.name),
      ...getConditionSupplements(chronicConditions),
    ]
    const uniqueSupps = Array.from(new Set(supps))

    const nextDays = chronicConditions.length > 0 ? 60 : 90
    // KST 기준 다음 리뷰일 — raw Date.now() UTC slice 는 KST 00~09시 제출 시
    // 하루 이르게 저장되는 off-by-one (2026-07-03 감사 수정, page.tsx 와 동일 헬퍼).
    const nextReview = addDaysKst(todayKstIsoDate(), nextDays)

    // factor_breakdown 은 신규 컬럼(generated types 미반영) → 빌더 cast
    // (surveys insert 선례 패턴).
    const { error: analysisErr } = await (
      supabase.from('analyses') as unknown as {
        insert: (
          v: Record<string, unknown>,
        ) => Promise<{ error: { message?: string } | null }>
      }
    ).insert({
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
      // 칼로리 v2 6단계 — 계수 사다리 (분석 페이지 "어떻게 계산했나요" 투명성).
      factor_breakdown: nu.factorBreakdown,
    })

    if (analysisErr) {
      toast.error('분석을 저장하지 못했어요')
      setErr('분석을 저장하지 못했어요')
      setSaving(false)
      submitGuardRef.current = false // 재시도 허용
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

    // 설문 완료 포인트 보상 제거 (2026-07-16 포인트 전면 폐기).
    // 설문을 끝내면 포인트를 주던 자리인데 포인트 개념 자체가 없어졌다. 우리 혜택은
    // 자동할인(기본 구독 15% + 나무 등급 10%)으로 통일 — 사은품 모으기 없이 알아서
    // 깎아준다. 결과 화면의 'ft:survey-reward' 토스트도 함께 사라진다.
    // (구 사다리 첫주문50%·등급별·생일은 2026-07-17 폐지 — 50%는 신규가입 이벤트限.)


    trackSurveyCompleted(dogId)
    // 분석 애니메이션 최소 노출(약 2.4초) 확보 후 결과로 이동. 저장은 이미
    // 끝났으므로 이 타이머는 navigation 만 담당 — 지연 중 이탈해도 데이터 보존.
    // R36 — 설문→로딩→결과 흐름은 상단 메뉴 hide. ?fromSurvey=1 query 가
    // AppChrome 의 focusMode 분기에 사용됨. 사용자가 추후 직접 진입
    // (예: 이전 결과 다시 보기) 시는 query 없으니 정상 노출.
    // 저장 도중 사용자가 이탈(언마운트)했다면 결과로 끌고가지 않는다 — 저장은
    // 이미 끝났으니 데이터는 보존되고, 다음 /analysis 진입 시 정상 표시된다.
    if (!mountedRef.current) return
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current)
    const remaining = Math.max(0, 2400 - (Date.now() - startedAt))
    loadingTimerRef.current = setTimeout(() => {
      router.push(`/dogs/${dogId}/analysis?fromSurvey=1`)
      router.refresh()
    }, remaining)
  }

  if (!dog) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]" style={{ background: 'var(--bg)' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--fd-coral)' }} strokeWidth={1.6} />
      </div>
    )
  }

  // ── 이전 답변 요약 echo chips ──
  const echoItems: string[] = []
  if (stepIdx > 0 && bcs) echoItems.push(`체형 ${bcs}/9`)
  // MCS echo 제거 — muscle 스텝 폐지(2026-07-23). 옛 draft 의 mcs 잔값 노출 방지.
  if (stepIdx > 2 && bristol) echoItems.push(`변 #${bristol}`)
  if (stepIdx > 3) {
    if (foodType) echoItems.push(foodType)
  }
  if (stepIdx > 4) {
    if (dlMode === 'none') echoItems.push('알레르기 없음')
    if (dlMode === 'has' && allergies.length) echoItems.push(`알레르기 ${allergies.length}`)
  }
  if (stepIdx > 5 && chronicConditions.length) echoItems.push(`질환 ${chronicConditions.length}`)

  const isLoading = currentStep === 'loading'

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* flex 컬럼 + 100dvh — 콘텐츠가 짧은 스텝에서도 CTA 바(.s-ctabar,
          margin-top:auto)가 항상 화면 하단에 고정되게(사장님: 이전/다음 위치
          스텝마다 동일해야 함). 긴 스텝은 sticky bottom 으로 스크롤 중 고정. */}
      <div
        className="max-w-md mx-auto"
        style={{
          background: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100dvh',
        }}
      >
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
            body={bodyAssess}
            onBody={onBodyAssess}
            bcs={bcs}
            weightTrend={weightTrend}
            setWeightTrend={setWeightTrend}
            weightMethod={weightMethod}
            setWeightMethod={setWeightMethod}
            easyKeeper={easyKeeper}
            setEasyKeeper={setEasyKeeper}
            bcsConflict={bcsConflict}
          />
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

        {(currentStep === 'meal' || currentStep === 'life') && (
          <Diet
            key={currentStep}
            part={currentStep === 'meal' ? 'meal' : 'life'}
            foodType={foodType}
            setFoodType={setFoodType}
            currentBrand={currentBrand}
            setCurrentBrand={setCurrentBrand}
            snackFreq={snackFreq}
            setSnackFreq={setSnackFreq}
            treatKcal={treatKcal}
            setTreatKcal={setTreatKcal}
            kibbleKcal={kibbleKcal}
            setKibbleKcal={setKibbleKcal}
            walkMinutes={walkMinutes}
            setWalkMinutes={setWalkMinutes}
            indoorActivity={indoorActivity}
            setIndoorActivity={setIndoorActivity}
            vigorous={vigorous}
            setVigorous={setVigorous}
            housing={housing}
            setHousing={setHousing}
            coldOutdoor={coldOutdoor}
            setColdOutdoor={setColdOutdoor}
            homeCookingExp={homeCookingExp}
            setHomeCookingExp={setHomeCookingExp}
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
            pancreatitisSeverity={pancreatitisSeverity}
            setPancreatitisSeverity={setPancreatitisSeverity}
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
            onBack={() => {
              // 저장 실패로 loading 에 갇히지 않도록 — 마지막 입력 단계로 복귀.
              setErr('')
              setCurrentStep('status')
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
    </div>
  )
}
