'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Dog as DogIcon,
  AlertCircle,
  ArrowRight,
  Check,
  HelpCircle,
  AlertTriangle,
  Smile,
  Stethoscope,
  Utensils,
  Soup,
  UtensilsCrossed,
  Meh,
  Frown,
  Baby,
  Sparkles,
  ShieldAlert,
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


/**
 * 설문 v2 — 수의영양학 임상 평가에 가까운 8단계.
 *
 *   1. body       : BCS 9-point (WSAVA)
 *   2. muscle     : MCS 4-grade (WSAVA)
 *   3. stool      : Bristol Stool 1~7
 *   4. diet       : 주식 / 간식 / 기호 / 산책시간 / 현재 브랜드
 *   5. allergy    : 알레르기 식재료
 *   6. chronic    : 만성질환 다중 선택 + 처방식 / 복용약 자유 입력
 *   7. status     : 임신·수유 / 모질·피부 / 식욕
 *   8. loading    : 분석 중 → 결과 페이지
 *
 * 단계당 1 질문 원칙 (체감 부담 ↓), chronic 만 다중 다이얼로그.
 * 모든 v2 필드는 선택 — 빈 채로 다음 가도 진행 가능 (v1 호환). 단 BCS 는 필수.
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
  '돼지고기',
  '유제품',
  '계란',
  '곡물 (밀/옥수수)',
  '대두',
]

export default function SurveyPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const toast = useToast()
  const dogId = params.id as string

  const [dog, setDog] = useState<Dog | null>(null)
  const [currentStep, setCurrentStep] = useState<Step>('body')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  // 1. body — BCS 9-point
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
  // 7. status
  const [pregnancy, setPregnancy] = useState<'none' | 'pregnant' | 'lactating' | ''>('')
  const [coat, setCoat] = useState<'healthy' | 'dull' | 'shedding' | 'itchy' | 'lesions' | ''>('')

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

  const stepIdx = STEPS.indexOf(currentStep)
  const totalSteps = STEPS.length - 1
  const progress = Math.round((stepIdx / totalSteps) * 100)

  function toggleArr<T>(arr: T[], v: T, setter: (x: T[]) => void) {
    if (arr.includes(v)) setter(arr.filter((x) => x !== v))
    else setter([...arr, v])
  }

  function validateStep(): boolean {
    setErr('')
    if (currentStep === 'body' && bcs === null) {
      setErr('체형을 선택해 주세요')
      return false
    }
    // mcs / stool / status / chronic 은 모두 선택 가능 — skip 허용
    if (currentStep === 'diet' && (!foodType || !snackFreq || !taste)) {
      setErr('주식 / 간식 / 기호를 모두 선택해 주세요')
      return false
    }
    if (currentStep === 'allergy' && !dlMode) {
      setErr('하나를 선택해 주세요')
      return false
    }
    if (currentStep === 'allergy' && dlMode === 'has' && allergies.length === 0) {
      setErr('하나 이상 선택해 주세요')
      return false
    }
    return true
  }

  async function goNext() {
    if (!validateStep()) return
    const idx = STEPS.indexOf(currentStep)
    if (currentStep === 'status') {
      setCurrentStep('loading')
      setTimeout(() => saveAndGoResult(), 1800)
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

    // legacy bodyCondition 매핑 — bcsExact 입력해도 v1 컬럼 호환
    const bodyMap: Record<number, SurveyAnswers['bodyCondition']> = {
      1: 'skinny', 2: 'skinny', 3: 'slim', 4: 'slim',
      5: 'ideal',
      6: 'chubby', 7: 'chubby',
      8: 'obese', 9: 'obese',
    }

    // legacy healthConcerns 매핑 — chronic 일부를 v1 키로 변환 (UI 위그릇)
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
      // v2
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
    }

    // surveys insert
    const { data: surveyData, error: surveyErr } = await supabase
      .from('surveys')
      .insert({
        dog_id: dogId,
        user_id: user.id,
        answers,
        // v2 분리 컬럼 (인덱스/필터용)
        mcs_score: mcs,
        bristol_stool_score: bristol,
        chronic_conditions: chronicConditions,
        current_medications: meds,
        current_food_brand: currentBrand.trim() || null,
        daily_walk_minutes: walkMinutes ? Number(walkMinutes) : null,
        coat_condition: coat || null,
        appetite: taste || null,
        pregnancy_status: pregnancy || null,
      })
      .select()
      .single()

    if (surveyErr || !surveyData) {
      toast.error('저장 실패: ' + surveyErr?.message)
      setSaving(false)
      return
    }

    // dogs 보강 — 처방식
    if (prescriptionDiet.trim()) {
      await supabase
        .from('dogs')
        .update({ prescription_diet: prescriptionDiet.trim() })
        .eq('id', dogId)
        .eq('user_id', user.id)
    }

    // 영양 계산
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

    // 다음 재분석 권장일 — 기본 90일 후, 만성질환 있으면 60일.
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
      // v2
      risk_flags: nu.riskFlags,
      vet_consult_recommended: nu.vetConsult,
      next_review_date: nextReview,
      guideline_version: nu.guidelineVersion,
    })

    if (analysisErr) {
      toast.error('분석 저장 실패: ' + analysisErr.message)
      setSaving(false)
      return
    }

    router.push(`/dogs/${dogId}/analysis`)
    router.refresh()
  }

  if (!dog) {
    return (
      <main className="flex items-center justify-center min-h-[80vh]">
        <div className="w-8 h-8 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  const isLoading = currentStep === 'loading'

  return (
    <main className="px-5 py-6 pb-10">
      <div className="max-w-md mx-auto">
        {!isLoading && (
          <div className="mb-6">
            <Link
              href={`/dogs/${dogId}`}
              className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
            >
              ← 돌아가기
            </Link>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted uppercase tracking-[0.2em]">
                Step {stepIdx + 1} / {totalSteps}
              </span>
              <span className="text-[10px] font-bold text-terracotta">{progress}%</span>
            </div>
            <div className="mt-2 h-1 bg-rule rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-moss to-terracotta transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* 1. BCS 9-point */}
        {currentStep === 'body' && (
          <div>
            <span className="kicker mb-3 inline-block">Body Condition · WSAVA</span>
            <h1 className="font-serif mb-3" style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {dog.name}의 체형은
              <br />어떤 단계인가요?
            </h1>
            <p className="text-[12px] text-muted mb-6 leading-relaxed">
              위에서 봤을 때 허리 라인 + 옆에서 본 배 라인 기준 9점 척도예요.
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {([1, 2, 3, 4, 5, 6, 7, 8, 9] as BcsKey[]).map((s) => {
                const meta = BCS_DESCRIPTIONS[s]
                const active = bcs === s
                const tone =
                  s <= 2
                    ? '#A6BEDA'
                    : s <= 4
                      ? '#8BA05A'
                      : s === 5
                        ? '#6B7F3A'
                        : s <= 7
                          ? '#D4B872'
                          : '#A0452E'
                return (
                  <button
                    key={s}
                    onClick={() => setBcs(s)}
                    className={`py-3 px-2 rounded-xl border transition text-center ${
                      active ? 'border-text bg-bg' : 'border-rule bg-white hover:border-muted'
                    }`}
                  >
                    <div className="font-mono text-[10px] text-muted">{s}/9</div>
                    <div
                      className="mx-auto rounded-full mt-1.5"
                      style={{ background: tone, width: 6 + s * 1.5, height: 6 + s * 1.5 }}
                    />
                    <div className="text-[10px] font-bold text-text mt-1.5">{meta.label.replace('BCS ', '')}</div>
                  </button>
                )
              })}
            </div>
            {bcs !== null && (
              <p
                className="mt-4 text-[11.5px] leading-relaxed rounded-xl px-3 py-2.5"
                style={{
                  color: 'var(--ink)',
                  background: 'var(--bg-2)',
                  boxShadow: 'inset 0 0 0 1px var(--rule)',
                }}
              >
                <strong>{BCS_DESCRIPTIONS[bcs].label}:</strong> {BCS_DESCRIPTIONS[bcs].desc}
              </p>
            )}
          </div>
        )}

        {/* 2. MCS */}
        {currentStep === 'muscle' && (
          <div>
            <span className="kicker mb-3 inline-block">Muscle Condition · WSAVA</span>
            <h1 className="font-serif mb-3" style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              근육 상태는
              <br />어떤가요?
            </h1>
            <p className="text-[12px] text-muted mb-6 leading-relaxed">
              척추뼈 / 견갑골 / 골반 위 근육을 만져 평가해요. 노령견 근감소증 조기
              발견에 중요해요. <span className="text-muted">(선택)</span>
            </p>
            <div className="grid grid-cols-1 gap-2">
              {([1, 2, 3, 4] as McsKey[]).map((s) => {
                const meta = MCS_DESCRIPTIONS[s]
                const active = mcs === s
                return (
                  <button
                    key={s}
                    onClick={() => setMcs(active ? null : s)}
                    className={`py-3 px-4 rounded-xl border transition text-left ${
                      active ? 'border-text bg-bg' : 'border-rule bg-white hover:border-muted'
                    }`}
                  >
                    <div className="font-bold text-[13px] text-text">{meta.label}</div>
                    <div className="text-[11px] text-muted mt-0.5 leading-relaxed">{meta.desc}</div>
                  </button>
                )
              })}
              <button
                onClick={() => setMcs(null)}
                className={`py-2 px-3 rounded-xl text-[11px] font-bold ${mcs === null ? 'text-terracotta' : 'text-muted hover:text-terracotta'}`}
              >
                {mcs === null ? '✓ 모르겠음 (건너뜀)' : '모르겠음 (건너뜀)'}
              </button>
            </div>
          </div>
        )}

        {/* 3. Bristol stool */}
        {currentStep === 'stool' && (
          <div>
            <span className="kicker mb-3 inline-block">Stool · Bristol Scale</span>
            <h1 className="font-serif mb-3" style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              평소 변 상태는
              <br />어떻게 보이나요?
            </h1>
            <p className="text-[12px] text-muted mb-6 leading-relaxed">
              장 건강 + 식이섬유 / 수분 흡수 신호예요. <span>(선택)</span>
            </p>
            <div className="space-y-1.5">
              {([1, 2, 3, 4, 5, 6, 7] as const).map((s) => {
                const meta = BRISTOL_INTERPRETATION[s]
                const active = bristol === s
                const tone =
                  s === 4 ? '#6B7F3A' : s <= 2 || s === 7 ? '#A0452E' : s === 3 || s === 5 ? '#D4B872' : '#C49A6C'
                return (
                  <button
                    key={s}
                    onClick={() => setBristol(active ? null : s)}
                    className={`w-full py-2.5 px-4 rounded-xl border transition text-left flex items-center gap-3 ${
                      active ? 'border-text bg-bg' : 'border-rule bg-white hover:border-muted'
                    }`}
                  >
                    <span className="font-mono text-[11px] text-muted shrink-0 w-6">#{s}</span>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: tone }} />
                    <span className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-bold text-text truncate">{meta.label}</div>
                      <div className="text-[10px] text-muted">{meta.signal}</div>
                    </span>
                  </button>
                )
              })}
              <button
                onClick={() => setBristol(null)}
                className="py-2 px-3 rounded-xl text-[11px] font-bold text-muted hover:text-terracotta"
              >
                {bristol === null ? '✓ 잘 모르겠음 (건너뜀)' : '잘 모르겠음 (건너뜀)'}
              </button>
            </div>
          </div>
        )}

        {/* 4. Diet */}
        {currentStep === 'diet' && (
          <div>
            <span className="kicker mb-3 inline-block">Eating Habits</span>
            <h1 className="font-serif mb-3" style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              식생활을 알려주세요
            </h1>
            <Section label="현재 주식">
              <OptsRow
                value={foodType}
                options={[
                  { v: '건식 사료', label: '건식', Icon: Utensils },
                  { v: '습식/화식', label: '습식/화식', Icon: Soup },
                  { v: '반반', label: '반반', Icon: UtensilsCrossed },
                ]}
                onChange={setFoodType}
              />
            </Section>
            <Section label="현재 브랜드 (선택)">
              <input
                type="text"
                value={currentBrand}
                onChange={(e) => setCurrentBrand(e.target.value)}
                placeholder="예: 로얄캐닌 미니어처닥스훈트"
                className="w-full px-3 py-2.5 rounded-xl border border-rule bg-white text-[12.5px]"
              />
            </Section>
            <Section label="간식 빈도">
              <OptsRow
                value={snackFreq}
                options={[
                  { v: '거의 안 줌', label: '거의 안 줌' },
                  { v: '가끔', label: '가끔' },
                  { v: '매일', label: '매일' },
                ]}
                onChange={setSnackFreq}
              />
            </Section>
            <Section label="식욕">
              <OptsRow
                value={taste}
                options={[
                  { v: 'strong', label: '왕성', Icon: Smile },
                  { v: 'normal', label: '정상', Icon: Smile },
                  { v: 'picky', label: '까다로움', Icon: Meh },
                  { v: 'reduced', label: '식욕 감퇴', Icon: Frown },
                ]}
                onChange={(v) => setTaste(v as typeof taste)}
              />
            </Section>
            <Section label="하루 산책 시간 (분, 선택)">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={300}
                value={walkMinutes}
                onChange={(e) => setWalkMinutes(e.target.value)}
                placeholder="예: 30"
                className="w-32 px-3 py-2.5 rounded-xl border border-rule bg-white text-[12.5px] font-mono"
              />
            </Section>
          </div>
        )}

        {/* 5. Allergy */}
        {currentStep === 'allergy' && (
          <div>
            <span className="kicker mb-3 inline-block">Allergies</span>
            <h1 className="font-serif mb-3" style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              피해야 할
              <br />재료가 있나요?
            </h1>
            <OptsRow
              value={dlMode}
              options={[
                { v: 'none', label: '없어요', Icon: Check },
                { v: 'unknown', label: '잘 몰라요', Icon: HelpCircle },
                { v: 'has', label: '있어요', Icon: AlertTriangle },
              ]}
              onChange={(v) => setDlMode(v as typeof dlMode)}
            />
            {dlMode === 'has' && (
              <div className="flex flex-wrap gap-2 mt-5">
                {ALLERGY_OPTIONS.map((v) => (
                  <button
                    key={v}
                    onClick={() => toggleArr(allergies, v, setAllergies)}
                    className={`px-4 py-2 rounded-xl border text-[12px] font-bold transition ${
                      allergies.includes(v)
                        ? 'border-text bg-text text-white'
                        : 'border-rule bg-white text-text hover:border-muted'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 6. Chronic */}
        {currentStep === 'chronic' && (
          <div>
            <span className="kicker mb-3 inline-block">Health · 만성질환</span>
            <h1 className="font-serif mb-3" style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              현재 진단받은
              <br />질환이 있나요?
            </h1>
            <p className="text-[12px] text-muted mb-5 leading-relaxed">
              여러 개 선택 가능. 식이가 핵심 치료의 일부인 질환이라 정확한 분기에
              꼭 필요해요. <span>(없으면 건너뛰세요)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CHRONIC_CONDITION_LABELS) as ChronicConditionKey[]).map((k) => {
                const active = chronicConditions.includes(k)
                return (
                  <button
                    key={k}
                    onClick={() => toggleArr(chronicConditions, k, setChronicConditions)}
                    className={`px-3.5 py-2 rounded-xl border text-[12px] font-bold transition ${
                      active
                        ? 'border-terracotta bg-terracotta text-white'
                        : 'border-rule bg-white text-text hover:border-muted'
                    }`}
                  >
                    {CHRONIC_CONDITION_LABELS[k]}
                  </button>
                )
              })}
            </div>

            <Section label="처방식 (선택)">
              <input
                type="text"
                value={prescriptionDiet}
                onChange={(e) => setPrescriptionDiet(e.target.value)}
                placeholder="예: Royal Canin Renal RF14"
                className="w-full px-3 py-2.5 rounded-xl border border-rule bg-white text-[12.5px]"
              />
            </Section>

            <Section label="복용 중인 약 / 보충제 (선택, 쉼표 구분)">
              <textarea
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                rows={2}
                placeholder="예: 갑상선 호르몬, 글루코사민, 오메가-3"
                className="w-full px-3 py-2.5 rounded-xl border border-rule bg-white text-[12.5px] resize-none"
              />
            </Section>

            {chronicConditions.length > 0 && (
              <div
                className="mt-4 rounded-xl px-3 py-2.5 text-[11px] leading-relaxed inline-flex items-start gap-2"
                style={{
                  background: 'color-mix(in srgb, var(--terracotta) 8%, transparent)',
                  color: 'var(--text)',
                }}
              >
                <ShieldAlert
                  className="w-3.5 h-3.5 shrink-0 mt-0.5"
                  strokeWidth={2.5}
                  color="var(--terracotta)"
                />
                <span>
                  분석 결과는 가이드라인 기반 권장이에요. 처방식·약물 변경은 반드시
                  주치 수의사와 상담 후 진행해 주세요.
                </span>
              </div>
            )}
          </div>
        )}

        {/* 7. Status */}
        {currentStep === 'status' && (
          <div>
            <span className="kicker mb-3 inline-block">Status · 현재 상태</span>
            <h1 className="font-serif mb-3" style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              마지막 단계예요
            </h1>
            <p className="text-[12px] text-muted mb-5 leading-relaxed">
              임신·수유 / 모질 상태가 있다면 칼로리·미량영양소가 크게 달라져요.
            </p>

            <Section label="임신 / 수유 상태">
              <OptsRow
                value={pregnancy}
                options={[
                  { v: 'none', label: '해당 없음', Icon: Check },
                  { v: 'pregnant', label: '임신 중', Icon: Baby },
                  { v: 'lactating', label: '수유 중', Icon: Baby },
                ]}
                onChange={(v) => setPregnancy(v as typeof pregnancy)}
              />
            </Section>

            <Section label="모질·피부 상태 (선택)">
              <OptsRow
                value={coat}
                options={[
                  { v: 'healthy', label: '건강', Icon: Sparkles },
                  { v: 'dull', label: '푸석', Icon: Meh },
                  { v: 'shedding', label: '심한 탈모' },
                  { v: 'itchy', label: '가려움', Icon: AlertTriangle },
                  { v: 'lesions', label: '병변', Icon: Stethoscope },
                ]}
                onChange={(v) => setCoat(v as typeof coat)}
              />
            </Section>
          </div>
        )}

        {/* loading */}
        {isLoading && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-bg flex items-center justify-center mx-auto mb-6 animate-pulse">
              <DogIcon className="w-10 h-10 text-terracotta" strokeWidth={1.3} />
            </div>
            <span className="kicker mb-2 inline-block">Analyzing</span>
            <h2 className="font-serif mb-2" style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {dog.name} 맞춤 영양
              <br />설계 중이에요
            </h2>
            <p className="text-[11.5px] text-muted mb-6 leading-relaxed">
              NRC 2006 · AAFCO 2024 · FEDIAF 2021 · WSAVA
              <br />가이드라인 적용 중...
            </p>
            <div className="flex justify-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-terracotta rounded-full animate-pulse" />
              <span className="w-1.5 h-1.5 bg-terracotta rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
              <span className="w-1.5 h-1.5 bg-terracotta rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
        )}

        {err && !isLoading && (
          <div className="mt-5 flex items-start gap-2 text-[12px] text-sale font-semibold bg-[#FFF5F3] border border-sale/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2} />
            <span>{err}</span>
          </div>
        )}

        {!isLoading && (
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={goPrev}
              disabled={stepIdx === 0}
              className="text-[12px] font-bold text-muted py-3 px-4 rounded-xl hover:bg-white disabled:opacity-0 transition"
            >
              ← 이전
            </button>
            <button
              onClick={goNext}
              disabled={saving}
              className="flex items-center gap-1.5 py-3 px-6 rounded-full bg-ink text-bg text-[13px] font-bold active:scale-[0.98] transition disabled:opacity-50"
            >
              {currentStep === 'status' ? '결과 보기' : '다음'}
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.2em] mb-2">
        {label}
      </div>
      {children}
    </div>
  )
}

type Option = {
  v: string
  label: string
  Icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>
}

function OptsRow({
  value,
  options,
  onChange,
}: {
  value: string
  options: Option[]
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(({ v, label, Icon }) => {
        const active = value === v
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-[12px] font-bold transition ${
              active
                ? 'border-text bg-text text-white'
                : 'border-rule bg-white text-text hover:border-muted'
            }`}
          >
            {Icon && (
              <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-muted'}`} strokeWidth={2} />
            )}
            {label}
          </button>
        )
      })}
    </div>
  )
}
