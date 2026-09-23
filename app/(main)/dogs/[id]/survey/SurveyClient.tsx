'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, ChevronLeft, Loader2 } from 'lucide-react'
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
import { type BcsKey, type ChronicConditionKey } from '@/lib/nutrition/guidelines'
import { haptic } from '@/lib/haptic'
import { NATIVE_BACK_EVENT } from '@/lib/native-back'
import { useConfirm } from '@/components/v3/useConfirm'
import { trackSurveyStarted, trackSurveyCompleted } from '@/lib/analytics'
import { deriveBCS } from '@/lib/calorie-v2/engine'
import { detectBcsWeightConflict } from '@/lib/bcs-consistency'
import {
  buildScreens,
  counterLabel,
  isScreenKey,
  isSkippable,
  legacyStepToScreen,
  progressPct,
  screenError,
  type FlowAnswers,
  type OptionalChoice,
  type ScreenKey,
} from '@/lib/survey/flow'
import {
  RibsScreen,
  WaistScreen,
  AbdomenScreen,
  WeightScreen,
  type BodyAssessmentState,
  type WeightMethod,
  type WeightTrend,
} from './steps/Body'
import { StoolScreen, type BristolKey, type GiSensitivity } from './steps/Stool'
import {
  FoodScreen,
  SnackScreen,
  FreshScreen,
  OptFoodScreen,
  OptWalkScreen,
  OptExerciseScreen,
  type HomeCookingExp,
  type Housing,
  type IndoorActivity,
  type Vigorous,
} from './steps/Diet'
import { AllergyScreen, type DlMode } from './steps/Allergy'
import {
  ChronicScreen,
  OptMedsScreen,
  type HasChronic,
  type IrisStage,
  type PancreatitisSeverity,
} from './steps/Status'
import {
  PregnancyScreen,
  AdultWeightScreen,
  type PregnancyValue,
  type SurveyDog,
} from './steps/Pregnancy'
import { GoalScreen, type CareGoal } from './steps/Preferences'
import { GateScreen } from './steps/Gate'
import LoadingStep from './steps/Loading'
import type { RefineSeed } from '@/lib/survey/refine'
import './survey.css'

/**
 * 설문 v4 — 화면당 질문 하나 (2026-09-22, 시니어 사용성 3단계).
 *
 * # 왜 바꿨나
 * 사장님 제보(9/20): 부모님 세대가 "글씨가 작고 흐름이 어색하다". v3 는 한 화면에
 * 질문 3~5개(체형 3문항 + 체중변화 + 살찌는편 + 잰방법…)가 쌓였고, '선택'·'건너뛰기'
 * 표시가 9px 였다. v4 는 한 화면 = 질문 하나 + 큰 세로 버튼, 아래에 큰 '다음' 하나.
 *
 * # 구조 (lib/survey/flow.ts 가 정본 — 순수 함수·테스트 있음)
 *   항상 11 · 조건부 0~2(임신·수유 / 예상 성견 체중) · 관문 1 · 선택 4(관문에서 답하기)
 *   삭제: 식욕·털 상태(계산 미사용). 합침: 살 잘 찌는 편 → 체중 변화 둘째 줄,
 *   사료 바꿀 때 무른 변 → 변 상태 둘째 줄. 접힘: 체중 잰 방법. 약 → 선택 묶음.
 *
 * # 보존한 것
 * 상태 변수·localStorage 자동저장(7일)·제출(surveys + analyses insert · dogs 갱신 ·
 * kibble_requests 로그)·체중↔체형 모순 경고·재진입 가드·언마운트 안전 타이머는
 * v3 그대로다. 옛 초안의 currentStep 은 legacyStepToScreen 으로 이어받는다.
 */

type ScreenState = ScreenKey | 'loading'

// react-hooks/purity 회피 — 제출 핸들러 안의 Date.now() 를 React Compiler 가 "render 중
// 호출"로 오판한다(이벤트 핸들러인데). autosignup-draft 와 같은 이유로 모듈 수준 함수.
function nowMs(): number {
  return Date.now()
}

export default function SurveyClient({
  dogId,
  previous,
  refineFrom = null,
}: {
  dogId: string
  /** 직전 분석 스냅샷 — 체중↔체형 모순 검증의 비교 기준. 첫 설문이면 null. */
  previous?: { bcs: number; weightKg: number } | null
  /**
   * "정확도 올리기"(?refine=1) — 마지막 설문의 답으로 상태를 채우고 **선택 묶음 첫
   * 화면**에서 시작한다. 이미 답한 11개는 다시 묻지 않는다. localStorage 초안은
   * 무시한다(이전에 쓰다 만 초안이 튀어나오면 더 헷갈린다). lib/survey/refine.ts.
   */
  refineFrom?: RefineSeed | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const confirm = useConfirm()
  const refineMode = refineFrom !== null
  const seed = refineFrom

  const [dog, setDog] = useState<SurveyDog | null>(null)
  const [screen, setScreen] = useState<ScreenState>(refineMode ? 'optFood' : 'ribs')

  // 화면 전환 시 스크롤 맨 위 + 짧은 진동 + 첫 h1 focus (a11y).
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo({ top: 0, behavior: 'smooth' })
    haptic('tick')
    requestAnimationFrame(() => {
      const h1 = document.querySelector<HTMLHeadingElement>('.s-page h1')
      if (h1) {
        h1.setAttribute('tabindex', '-1')
        h1.focus({ preventScroll: true })
      }
    })
  }, [screen])
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  // 1~3. 몸 — 체형 3분해(갈비뼈·허리·배) → deriveBCS 역산. bcs 는 파생값으로 유지.
  const [bodyAssess, setBodyAssess] = useState<BodyAssessmentState>(
    seed?.bodyAssess ?? { ribs: '', waist: '', abdomen: '' },
  )
  const [bcs, setBcs] = useState<BcsKey | null>((seed?.bcs as BcsKey | null) ?? null)
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
    } else {
      setBcs(null)
    }
  }
  // [발명 모듈 D] 체중 측정 방법 — 신뢰도(W_method) 입력. 미입력 시 dog 프로필 값.
  const [weightMethod, setWeightMethod] = useState<WeightMethod>('')
  // 칼로리 v2 2b — 사다리 감산·가산 신호 4종 ('' = 미응답 → 무보정).
  const [easyKeeper, setEasyKeeper] = useState<'' | 'yes' | 'no'>(seed?.easyKeeper ?? '')
  const [vigorous, setVigorous] = useState<Vigorous>(seed?.vigorous ?? '')
  const [housing, setHousing] = useState<Housing>(seed?.housing ?? '')
  const [coldOutdoor, setColdOutdoor] = useState<'' | 'yes' | 'no'>(seed?.coldOutdoor ?? '')
  // 4. 체중 변화 (personalization)
  const [weightTrend, setWeightTrend] = useState<WeightTrend>(seed?.weightTrend ?? '')
  // 5. 변
  const [bristol, setBristol] = useState<BristolKey | null>(seed?.bristol ?? null)
  const [stoolSkipped, setStoolSkipped] = useState(seed?.stoolSkipped ?? false)
  const [giSensitivity, setGiSensitivity] = useState<GiSensitivity>(seed?.giSensitivity ?? '')
  // 6~8. 식사
  const [foodType, setFoodType] = useState(seed?.foodType ?? '')
  const [snackFreq, setSnackFreq] = useState(seed?.snackFreq ?? '')
  const [treatKcal, setTreatKcal] = useState(seed?.treatKcal ?? '')
  const [kibbleKcal, setKibbleKcal] = useState(seed?.kibbleKcal ?? '')
  const [currentBrand, setCurrentBrand] = useState(seed?.currentBrand ?? '')
  const [homeCookingExp, setHomeCookingExp] = useState<HomeCookingExp>(seed?.homeCookingExp ?? '')
  const [walkMinutes, setWalkMinutes] = useState(seed?.walkMinutes ?? '')
  const [indoorActivity, setIndoorActivity] = useState<IndoorActivity>(seed?.indoorActivity ?? '')
  // 9. 알레르기
  const [dlMode, setDlMode] = useState<DlMode>(seed?.dlMode ?? '')
  const [allergies, setAllergies] = useState<string[]>(seed?.allergies ?? [])
  const [preferredProteins, setPreferredProteins] = useState<string[]>(seed?.preferredProteins ?? [])
  // 10. 질환
  const [hasChronic, setHasChronic] = useState<HasChronic>(seed?.hasChronic ?? '')
  const [chronicConditions, setChronicConditions] = useState<ChronicConditionKey[]>(
    (seed?.chronicConditions as ChronicConditionKey[] | undefined) ?? [],
  )
  const [prescriptionDiet, setPrescriptionDiet] = useState(seed?.prescriptionDiet ?? '')
  const [medications, setMedications] = useState(seed?.medications ?? '')
  const [irisStage, setIrisStage] = useState<IrisStage>(seed?.irisStage ?? null)
  const [pancreatitisSeverity, setPancreatitisSeverity] =
    useState<PancreatitisSeverity>(seed?.pancreatitisSeverity ?? null)
  // 조건부 — 임신·수유 / 예상 성견 체중
  const [pregnancy, setPregnancy] = useState<PregnancyValue>(seed?.pregnancy ?? '')
  const [pregnancyWeek, setPregnancyWeek] = useState<number | null>(seed?.pregnancyWeek ?? null)
  const [litterSize, setLitterSize] = useState<number | null>(seed?.litterSize ?? null)
  const [expectedAdultWeightKg, setExpectedAdultWeightKg] = useState<number | null>(
    seed?.expectedAdultWeightKg ?? null,
  )
  // 11. 케어 목표 (★알고리즘 1순위)
  const [careGoal, setCareGoal] = useState<CareGoal | ''>((seed?.careGoal as CareGoal | '') ?? '')
  // 관문 — 선택 묶음 답하기 / 건너뛰기
  const [optChoice, setOptChoice] = useState<OptionalChoice>(refineMode ? 'answer' : '')

  // loading 단계 stage 인디케이터
  const [loadingStage, setLoadingStage] = useState(0)

  // 설문 진행 중 이탈 시 browser confirm. 'loading' 은 제외(submit 직후 router.push).
  useEffect(() => {
    if (screen === 'loading') return
    const hasAnyInput = bodyAssess.ribs !== '' || bristol !== null || foodType !== ''
    if (!hasAnyInput) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [screen, bodyAssess.ribs, bristol, foodType])

  // refine 모드는 서버 시드가 정본 — localStorage 초안 복원을 건너뛴다(저장은 그대로).
  const restoredRef = useRef(refineMode)

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
        .select(
          'id, name, weight, age_value, age_unit, neutered, activity_level, gender, breed, weight_method, weight_measured_at',
        )
        .eq('id', dogId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (error || !data) {
        router.push('/dogs')
        return
      }
      setDog(data as unknown as SurveyDog)
      trackSurveyStarted(dogId)
    }
    void load()
  }, [dogId, router, supabase])

  // ── Autosave (localStorage) — 7일, dog 별 분리 ────────────────────────
  const STORAGE_KEY = `farmerstail-survey:${dogId}`

  // 복원 — dog 로드 후 한 번만(ref 가드). React 19 'set-state-in-effect' 룰은 mount 직후
  // hydration 패턴엔 과보수라 이 effect 만 예외.
  /* eslint-disable react-hooks/set-state-in-effect -- mount 1회 ref 가드 복원 */
  useEffect(() => {
    if (!dog || restoredRef.current || typeof window === 'undefined') return
    restoredRef.current = true
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const data = JSON.parse(raw) as Record<string, unknown> & { _ts?: number }
      if (typeof data._ts === 'number' && Date.now() - data._ts > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(STORAGE_KEY)
        return
      }
      if (data.bcs !== undefined) setBcs(data.bcs as BcsKey | null)
      if (data.bodyAssess && typeof data.bodyAssess === 'object')
        setBodyAssess(data.bodyAssess as BodyAssessmentState)
      if (typeof data.easyKeeper === 'string') setEasyKeeper(data.easyKeeper as typeof easyKeeper)
      if (typeof data.vigorous === 'string') setVigorous(data.vigorous as Vigorous)
      if (typeof data.housing === 'string') setHousing(data.housing as Housing)
      if (typeof data.coldOutdoor === 'string') setColdOutdoor(data.coldOutdoor as typeof coldOutdoor)
      if (typeof data.weightMethod === 'string') setWeightMethod(data.weightMethod as WeightMethod)
      if (data.bristol !== undefined) setBristol(data.bristol as BristolKey | null)
      if (typeof data.stoolSkipped === 'boolean') setStoolSkipped(data.stoolSkipped)
      if (typeof data.foodType === 'string') setFoodType(data.foodType)
      if (typeof data.snackFreq === 'string') setSnackFreq(data.snackFreq)
      if (typeof data.treatKcal === 'string') setTreatKcal(data.treatKcal)
      if (typeof data.kibbleKcal === 'string') setKibbleKcal(data.kibbleKcal)
      if (typeof data.walkMinutes === 'string') setWalkMinutes(data.walkMinutes)
      if (typeof data.currentBrand === 'string') setCurrentBrand(data.currentBrand)
      if (typeof data.dlMode === 'string') setDlMode(data.dlMode as DlMode)
      if (Array.isArray(data.allergies)) setAllergies(data.allergies as string[])
      const conds = Array.isArray(data.chronicConditions)
        ? (data.chronicConditions as ChronicConditionKey[])
        : []
      if (Array.isArray(data.chronicConditions)) setChronicConditions(conds)
      const presc = typeof data.prescriptionDiet === 'string' ? data.prescriptionDiet : ''
      if (typeof data.prescriptionDiet === 'string') setPrescriptionDiet(presc)
      if (typeof data.medications === 'string') setMedications(data.medications)
      if (data.hasChronic === 'yes' || data.hasChronic === 'no') {
        setHasChronic(data.hasChronic)
      } else if (conds.length > 0 || presc.trim() !== '') {
        // v3 초안 호환 — 상세가 있으면 '있어요'로 시작.
        setHasChronic('yes')
      }
      if (data.irisStage !== undefined) setIrisStage(data.irisStage as IrisStage)
      if (data.pancreatitisSeverity !== undefined)
        setPancreatitisSeverity(data.pancreatitisSeverity as PancreatitisSeverity)
      if (typeof data.pregnancy === 'string') setPregnancy(data.pregnancy as PregnancyValue)
      if (data.pregnancyWeek !== undefined) setPregnancyWeek(data.pregnancyWeek as number | null)
      if (data.litterSize !== undefined) setLitterSize(data.litterSize as number | null)
      if (data.expectedAdultWeightKg !== undefined)
        setExpectedAdultWeightKg(data.expectedAdultWeightKg as number | null)
      if (typeof data.weightTrend === 'string') setWeightTrend(data.weightTrend as WeightTrend)
      if (typeof data.giSensitivity === 'string') setGiSensitivity(data.giSensitivity as GiSensitivity)
      if (typeof data.indoorActivity === 'string') setIndoorActivity(data.indoorActivity as IndoorActivity)
      if (typeof data.homeCookingExp === 'string') setHomeCookingExp(data.homeCookingExp as HomeCookingExp)
      if (Array.isArray(data.preferredProteins)) setPreferredProteins(data.preferredProteins as string[])
      if (typeof data.careGoal === 'string') setCareGoal(data.careGoal as CareGoal | '')
      let choice: OptionalChoice = ''
      if (data.optChoice === 'answer' || data.optChoice === 'skip') choice = data.optChoice
      // 화면 복원 — v4 'screen' 우선, 없으면 v3 'currentStep' 을 이어받는다.
      let restoredScreen: ScreenKey | null = null
      if (isScreenKey(data.screen)) restoredScreen = data.screen
      else if (typeof data.currentStep === 'string')
        restoredScreen = legacyStepToScreen(data.currentStep)
      if (restoredScreen) {
        // 선택 화면에서 저장됐다면 관문 답은 '답하기'였다.
        if (isSkippable(restoredScreen) && restoredScreen !== 'adultWeight') choice = 'answer'
        setScreen(restoredScreen)
      }
      setOptChoice(choice)
      toast.info('이전에 작성하던 내용을 불러왔어요')
    } catch {
      // corrupted — silently ignore
    }
  }, [dog, STORAGE_KEY, toast])
  /* eslint-enable react-hooks/set-state-in-effect */

  // 저장 — 500ms debounce. loading 중엔 저장 안 함(이미 제출).
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 제출 재진입 가드 — 더블탭/재시도로 surveys·analyses 중복 insert 방지(ref).
  const submitGuardRef = useRef(false)
  const mountedRef = useRef(true)
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current)
    }
  }, [])
  useEffect(() => {
    if (!dog || !restoredRef.current || typeof window === 'undefined') return
    if (screen === 'loading') return
    // refine 모드는 저장하지 않는다 — 시드는 서버(마지막 설문)가 정본이고, 공용 초안 키에
    // 남기면 다음 일반 설문이 그 초안을 복원해 11개 질문을 건너뛴 채 선택 화면에서 시작한다
    // (2026-09-23 점검). 나가면 다음 ?refine=1 진입 때 다시 시드된다.
    if (refineMode) return
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
            bristol,
            stoolSkipped,
            foodType,
            snackFreq,
            treatKcal,
            kibbleKcal,
            walkMinutes,
            currentBrand,
            dlMode,
            allergies,
            hasChronic,
            chronicConditions,
            prescriptionDiet,
            medications,
            irisStage,
            pancreatitisSeverity,
            pregnancy,
            pregnancyWeek,
            litterSize,
            expectedAdultWeightKg,
            weightTrend,
            giSensitivity,
            indoorActivity,
            homeCookingExp,
            preferredProteins,
            careGoal,
            optChoice,
            screen,
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
    bristol,
    stoolSkipped,
    foodType,
    snackFreq,
    treatKcal,
    kibbleKcal,
    walkMinutes,
    currentBrand,
    dlMode,
    allergies,
    hasChronic,
    chronicConditions,
    prescriptionDiet,
    medications,
    irisStage,
    pancreatitisSeverity,
    pregnancy,
    pregnancyWeek,
    litterSize,
    expectedAdultWeightKg,
    weightTrend,
    giSensitivity,
    indoorActivity,
    homeCookingExp,
    preferredProteins,
    careGoal,
    optChoice,
    screen,
    refineMode,
  ])

  // loading stage 진행 — 4 stage rotating
  useEffect(() => {
    if (screen !== 'loading') return
    const t = setInterval(() => setLoadingStage((s) => Math.min(s + 1, 4)), 700)
    return () => clearInterval(t)
  }, [screen])

  const ageInMonths = dog
    ? dog.age_unit === 'years'
      ? dog.age_value * 12
      : dog.age_value
    : 0
  const isSenior = ageInMonths >= 84

  // 체중↔체형 모순 — 경고만 하고 진행은 시킨다(사장님 2026-07-14).
  const bcsConflict = detectBcsWeightConflict({
    dogName: dog?.name ?? '',
    prevBcs: previous?.bcs,
    prevWeightKg: previous?.weightKg,
    currentBcs: bcs,
    currentWeightKg: dog?.weight,
    lifeStage: ageInMonths < 12 ? 'puppy' : isSenior ? 'senior' : 'adult',
  })

  // ── 화면 순서 (lib/survey/flow) ──
  const screens = dog
    ? buildScreens(
        { gender: dog.gender, neutered: dog.neutered, ageMonths: ageInMonths },
        optChoice,
      )
    : []
  const rawIdx = screens.findIndex((s) => s.key === screen)
  const idx = rawIdx >= 0 ? rawIdx : 0
  const cur = screens[idx]
  const isLoading = screen === 'loading'
  const isLastScreen = idx === screens.length - 1

  const flowAnswers: FlowAnswers = {
    ribs: bodyAssess.ribs,
    waist: bodyAssess.waist,
    abdomen: bodyAssess.abdomen,
    weightTrend,
    bristol,
    stoolSkipped,
    foodType,
    snackFreq,
    homeCookingExp,
    dlMode,
    allergies,
    hasChronic,
    chronicConditions,
    prescriptionDiet,
    pregnancy,
    careGoal,
    optChoice,
  }

  /** 선택 화면에 답이 있는지 — CTA 라벨('다음' vs '건너뛰기') 판정. */
  function optionalAnswered(key: ScreenKey): boolean {
    switch (key) {
      case 'optFood':
        return currentBrand.trim() !== '' || kibbleKcal.trim() !== ''
      case 'optWalk':
        return walkMinutes !== ''
      case 'optExercise':
        return vigorous !== '' || housing !== ''
      case 'optMeds':
        return medications.trim() !== ''
      case 'adultWeight':
        return expectedAdultWeightKg !== null
      default:
        return true
    }
  }

  function startSubmit() {
    setScreen('loading')
    setLoadingStage(0)
    // P0(설문 유실 방지): 저장을 즉시 시작. 애니메이션 최소 노출은 saveAndGoResult 가
    // 결과로 이동하기 직전에 확보한다(저장이 끝난 뒤라 지연 중 이탈해도 안전).
    void saveAndGoResult()
  }

  function goNext() {
    if (!cur) return
    const e = screenError(cur.key, flowAnswers)
    setErr(e ?? '')
    if (e) {
      haptic('warn')
      return
    }
    if (isLastScreen) {
      // 선택 묶음의 마지막(optMeds) → 제출. (관문은 자기 버튼으로 처리)
      startSubmit()
      return
    }
    setScreen(screens[idx + 1]!.key)
  }

  const firstIdx = refineMode ? Math.max(0, screens.findIndex((s) => s.key === 'optFood')) : 0
  function goPrev() {
    if (idx > firstIdx) {
      setErr('')
      setScreen(screens[idx - 1]!.key)
    }
  }

  function chooseGate(choice: 'answer' | 'skip') {
    setErr('')
    setOptChoice(choice)
    if (choice === 'skip') {
      startSubmit()
      return
    }
    setScreen('optFood')
  }

  // ── 나가기 · 하드웨어 뒤로가기 (2026-09-23 점검) ──
  // 화면 11개가 브라우저 히스토리 한 칸이라, 안드로이드 뒤로가기를 그냥 두면 이전
  // 질문이 아니라 **설문 밖**으로 나가고(설문이 첫 화면이면 앱 종료), refine 모드는 답도
  // 사라진다. 바텀시트가 쓰는 NATIVE_BACK_EVENT 를 같은 방식으로 가로챈다:
  //   질문 2 이상 → 이전 질문 · 첫 질문 → "나갈까요?" 확인 시트 · 시트가 떠 있으면 시트가 먼저.
  const exitHref = refineMode ? `/dogs/${dogId}/analysis` : `/dogs/${dogId}`
  const hasAnyAnswer =
    bodyAssess.ribs !== '' || bristol !== null || foodType !== '' || careGoal !== ''
  async function exitSurvey() {
    if (isLoading) return
    if (hasAnyAnswer || refineMode) {
      const ok = await confirm({
        title: refineMode ? '추가 답변을 그만둘까요?' : '설문을 나갈까요?',
        body: refineMode
          ? '지금까지 적은 추가 답변은 저장되지 않아요.'
          : '지금까지 답한 내용은 저장돼 있어요. 다시 들어오면 이어서 할 수 있어요.',
        confirmLabel: '나가기',
        cancelLabel: '계속하기',
      })
      if (!ok) return
    }
    router.push(exitHref)
  }
  useEffect(() => {
    const handler = (event: Event) => {
      // 열린 시트(확인창 포함)가 있으면 그쪽이 닫힌다 — 여기서는 손대지 않는다.
      if (document.querySelector('dialog[open]')) return
      event.preventDefault()
      if (isLoading) return
      if (idx > firstIdx) goPrev()
      else void exitSurvey()
    }
    window.addEventListener(NATIVE_BACK_EVENT, handler)
    return () => window.removeEventListener(NATIVE_BACK_EVENT, handler)
  })

  async function saveAndGoResult() {
    if (!dog || submitGuardRef.current) return
    submitGuardRef.current = true
    const startedAt = nowMs()
    setSaving(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
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
    if (chronicConditions.includes('allergy_skin') || careGoal === 'skin_coat')
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
      bcsExact: bcs ?? undefined,
      bcsWeightConflict: bcsConflict?.kind,
      bodyAssessment:
        bodyAssess.ribs && bodyAssess.waist && bodyAssess.abdomen
          ? {
              ribs: bodyAssess.ribs,
              waist: bodyAssess.waist,
              abdomen: bodyAssess.abdomen,
            }
          : undefined,
      bristolScore: bristol ?? undefined,
      chronicConditions,
      currentMedications: meds,
      pregnancyStatus: pregnancy || undefined,
      pregnancyWeek: pregnancyWeek ?? null,
      litterSize: litterSize ?? null,
      // walkMinutes 0-300 clamp
      dailyWalkMinutes: walkMinutes
        ? Math.max(0, Math.min(300, Number(walkMinutes) || 0))
        : undefined,
      treatKcalPerDay: treatKcal
        ? Math.max(0, Math.min(2000, Number(treatKcal) || 0))
        : undefined,
      // 건사료 라벨 kcal/kg → /100g 환산 (200~600 clamp).
      kibbleKcalPer100g: kibbleKcal
        ? Math.max(200, Math.min(600, (Number(kibbleKcal) || 0) / 10))
        : undefined,
      isEasyKeeper: easyKeeper === '' ? undefined : easyKeeper === 'yes',
      vigorousExercise:
        vigorous === '' ? undefined : vigorous === 'self' ? 'self_report' : vigorous,
      housing: housing || undefined,
      coldExposure: coldOutdoor === '' ? undefined : coldOutdoor === 'yes',
      currentFoodBrand: currentBrand.trim() || undefined,
      careGoal: careGoal || undefined,
      homeCookingExperience: homeCookingExp || undefined,
      weightTrend6mo: weightTrend || undefined,
      giSensitivity: giSensitivity || undefined,
      preferredProteins: preferredProteins as SurveyAnswers['preferredProteins'],
      indoorActivity: indoorActivity || undefined,
      diagnosedSeverity:
        pancreatitisSeverity && chronicConditions.includes('pancreatitis')
          ? { pancreatitis: pancreatitisSeverity }
          : undefined,
      // v4 — 관문에서 선택 묶음을 통째로 건너뛰었나(결과 화면 "정확도 올리기" 조건).
      optionalSkipped: optChoice === 'skip',
      surveyVersion: 4,
    }

    const surveyInsertPayload = {
      dog_id: dogId,
      user_id: user.id,
      answers,
      // muscle(MCS)·식욕·모질·식이만족도는 설문에서 빠졌다(2026-07-23 / 2026-09-22) — null.
      mcs_score: null,
      bristol_stool_score: bristol,
      chronic_conditions: chronicConditions,
      current_medications: meds,
      current_food_brand: currentBrand.trim() || null,
      daily_walk_minutes: walkMinutes
        ? Math.max(0, Math.min(300, Number(walkMinutes) || 0))
        : null,
      coat_condition: null,
      appetite: null,
      pregnancy_status: pregnancy || null,
      care_goal: careGoal || null,
      home_cooking_experience: homeCookingExp || null,
      current_diet_satisfaction: null,
      weight_trend_6mo: weightTrend || null,
      gi_sensitivity: giSensitivity || null,
      preferred_proteins: preferredProteins,
      indoor_activity: indoorActivity || null,
      iris_stage: chronicConditions.includes('kidney') ? irisStage : null,
      pregnancy_week: pregnancy === 'pregnant' ? pregnancyWeek : null,
      litter_size: pregnancy === 'lactating' ? litterSize : null,
      expected_adult_weight_kg: ageInMonths < 18 ? expectedAdultWeightKg : null,
      // 2026-07-14: 설문에서 예산을 묻지 않음 → 항상 null(컬럼 유지).
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
      submitGuardRef.current = false
      return
    }

    if (prescriptionDiet.trim()) {
      await supabase
        .from('dogs')
        .update({ prescription_diet: prescriptionDiet.trim() })
        .eq('id', dogId)
        .eq('user_id', user.id)
    }

    // 사료 DB 자가성장 로그: 건식/반반인데 브랜드만 알고 kcal 모르는 케이스.
    if (
      (foodType === '건식 사료' || foodType === '반반') &&
      currentBrand.trim() &&
      !kibbleKcal
    ) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('kibble_requests').insert({
          user_id: user.id,
          raw_input: currentBrand.trim(),
        })
      } catch {
        /* 로그 실패 무시 */
      }
    }

    // [발명 모듈 D] 체중 측정 방법/일자 — 설문에서 새로 고른 값 우선.
    const effWeightMethod =
      weightMethod || (dog as { weight_method?: string | null }).weight_method
    const effWeightMeasuredAt = weightMethod
      ? new Date().toISOString()
      : (dog as { weight_measured_at?: string | null }).weight_measured_at ?? null
    if (weightMethod) {
      await (
        supabase.from('dogs') as unknown as {
          update: (v: { weight_method: string; weight_measured_at: string }) => {
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
        weightReliability: weightReliability(effWeightMethod, effWeightMeasuredAt),
        expectedAdultWeight: expectedAdultWeightKg ?? null,
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
    const nextReview = addDaysKst(todayKstIsoDate(), nextDays)

    const { error: analysisErr } = await (
      supabase.from('analyses') as unknown as {
        insert: (v: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>
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
      factor_breakdown: nu.factorBreakdown,
    })

    if (analysisErr) {
      toast.error('분석을 저장하지 못했어요')
      setErr('분석을 저장하지 못했어요')
      setSaving(false)
      submitGuardRef.current = false
      return
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* noop */
      }
    }

    trackSurveyCompleted(dogId)
    if (!mountedRef.current) return
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current)
    const remaining = Math.max(0, 2400 - (nowMs() - startedAt))
    loadingTimerRef.current = setTimeout(() => {
      router.push(`/dogs/${dogId}/analysis?fromSurvey=1`)
      router.refresh()
    }, remaining)
  }

  if (!dog) {
    return (
      <div
        className="flex items-center justify-center min-h-[80vh]"
        style={{ background: 'var(--bg)' }}
      >
        <Loader2
          className="w-8 h-8 animate-spin"
          style={{ color: 'var(--fd-coral)' }}
          strokeWidth={1.6}
        />
      </div>
    )
  }

  const progress = isLoading ? 100 : progressPct(screens, idx)
  const counter = isLoading ? '' : counterLabel(screens, idx)

  // CTA 라벨 — 선택 화면은 답이 없으면 '건너뛰기'가 곧 다음.
  let ctaLabel = '다음'
  if (cur && isSkippable(cur.key)) {
    const answered = optionalAnswered(cur.key)
    if (isLastScreen) ctaLabel = answered ? '결과 보기' : '건너뛰고 결과 보기'
    else ctaLabel = answered ? '다음' : '건너뛰기'
  }
  const showCta = !isLoading && cur && cur.part !== 'gate'

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
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
          <div className="s-stepwrap">
            <div className="s-top">
              <button
                type="button"
                className="s-back"
                onClick={goPrev}
                disabled={idx <= firstIdx}
                aria-label="이전 질문"
              >
                <ChevronLeft size={22} strokeWidth={2.4} aria-hidden />
                이전
              </button>
              <span className="s-count" aria-live="polite">
                {counter}
              </span>
              <button type="button" className="s-exit" onClick={() => void exitSurvey()}>
                나가기
              </button>
            </div>
            <div
              className="s-progress"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={counter || '진행률'}
            >
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* ── 화면 (lib/survey/flow 순서) ── */}
        {!isLoading && cur?.key === 'ribs' && (
          <RibsScreen
            dogName={dog.name}
            value={bodyAssess.ribs}
            onChange={(v) => onBodyAssess({ ribs: v })}
          />
        )}
        {!isLoading && cur?.key === 'waist' && (
          <WaistScreen value={bodyAssess.waist} onChange={(v) => onBodyAssess({ waist: v })} />
        )}
        {!isLoading && cur?.key === 'abdomen' && (
          <AbdomenScreen
            value={bodyAssess.abdomen}
            onChange={(v) => onBodyAssess({ abdomen: v })}
            bcs={bcs}
            bcsConflict={bcsConflict}
          />
        )}
        {!isLoading && cur?.key === 'weight' && (
          <WeightScreen
            weightTrend={weightTrend}
            setWeightTrend={setWeightTrend}
            easyKeeper={easyKeeper}
            setEasyKeeper={setEasyKeeper}
            weightMethod={weightMethod}
            setWeightMethod={setWeightMethod}
          />
        )}
        {!isLoading && cur?.key === 'stool' && (
          <StoolScreen
            dogName={dog.name}
            bristol={bristol}
            setBristol={setBristol}
            skipped={stoolSkipped}
            setSkipped={setStoolSkipped}
            giSensitivity={giSensitivity}
            setGiSensitivity={setGiSensitivity}
          />
        )}
        {!isLoading && cur?.key === 'food' && (
          <FoodScreen foodType={foodType} setFoodType={setFoodType} />
        )}
        {!isLoading && cur?.key === 'snack' && (
          <SnackScreen
            snackFreq={snackFreq}
            setSnackFreq={setSnackFreq}
            treatKcal={treatKcal}
            setTreatKcal={setTreatKcal}
          />
        )}
        {!isLoading && cur?.key === 'fresh' && (
          <FreshScreen homeCookingExp={homeCookingExp} setHomeCookingExp={setHomeCookingExp} />
        )}
        {!isLoading && cur?.key === 'allergy' && (
          <AllergyScreen
            dlMode={dlMode}
            setDlMode={setDlMode}
            allergies={allergies}
            setAllergies={setAllergies}
            preferredProteins={preferredProteins}
            setPreferredProteins={setPreferredProteins}
          />
        )}
        {!isLoading && cur?.key === 'chronic' && (
          <ChronicScreen
            hasChronic={hasChronic}
            setHasChronic={setHasChronic}
            chronicConditions={chronicConditions}
            setChronicConditions={setChronicConditions}
            irisStage={irisStage}
            setIrisStage={setIrisStage}
            pancreatitisSeverity={pancreatitisSeverity}
            setPancreatitisSeverity={setPancreatitisSeverity}
            prescriptionDiet={prescriptionDiet}
            setPrescriptionDiet={setPrescriptionDiet}
          />
        )}
        {!isLoading && cur?.key === 'pregnancy' && (
          <PregnancyScreen
            dog={dog}
            pregnancy={pregnancy}
            setPregnancy={setPregnancy}
            pregnancyWeek={pregnancyWeek}
            setPregnancyWeek={setPregnancyWeek}
            litterSize={litterSize}
            setLitterSize={setLitterSize}
          />
        )}
        {!isLoading && cur?.key === 'adultWeight' && (
          <AdultWeightScreen
            expectedAdultWeightKg={expectedAdultWeightKg}
            setExpectedAdultWeightKg={setExpectedAdultWeightKg}
          />
        )}
        {!isLoading && cur?.key === 'goal' && (
          <GoalScreen careGoal={careGoal} setCareGoal={setCareGoal} />
        )}
        {!isLoading && cur?.key === 'gate' && (
          <GateScreen
            onAnswer={() => chooseGate('answer')}
            onSkip={() => chooseGate('skip')}
            saving={saving}
          />
        )}
        {!isLoading && cur?.key === 'optFood' && (
          <OptFoodScreen
            foodType={foodType}
            currentBrand={currentBrand}
            setCurrentBrand={setCurrentBrand}
            kibbleKcal={kibbleKcal}
            setKibbleKcal={setKibbleKcal}
          />
        )}
        {!isLoading && cur?.key === 'optWalk' && (
          <OptWalkScreen
            walkMinutes={walkMinutes}
            setWalkMinutes={setWalkMinutes}
            indoorActivity={indoorActivity}
            setIndoorActivity={setIndoorActivity}
          />
        )}
        {!isLoading && cur?.key === 'optExercise' && (
          <OptExerciseScreen
            vigorous={vigorous}
            setVigorous={setVigorous}
            housing={housing}
            setHousing={setHousing}
            coldOutdoor={coldOutdoor}
            setColdOutdoor={setColdOutdoor}
          />
        )}
        {!isLoading && cur?.key === 'optMeds' && (
          <OptMedsScreen
            medications={medications}
            setMedications={setMedications}
            chronicConditions={chronicConditions}
            onAddCondition={(k) => {
              if (!chronicConditions.includes(k)) setChronicConditions([...chronicConditions, k])
              setHasChronic('yes')
            }}
          />
        )}

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
              // 저장 실패로 loading 에 갇히지 않도록 — 마지막 입력 화면으로 복귀.
              setErr('')
              setScreen(optChoice === 'answer' ? 'optMeds' : 'gate')
            }}
          />
        )}

        {err && !isLoading && (
          <div className="s-errbar" role="alert" aria-live="polite">
            <AlertCircle size={16} strokeWidth={2.2} aria-hidden />
            <span>{err}</span>
          </div>
        )}

        {showCta && (
          <div className="s-ctabar s-ctabar-v4">
            <button
              type="button"
              className="s-next-btn s-next-full"
              onClick={goNext}
              disabled={saving}
            >
              {ctaLabel}
              <ArrowRight size={18} strokeWidth={2.6} aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
