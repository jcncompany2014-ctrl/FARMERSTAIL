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
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  calculateNutrition,
  getSupplements,
  type SurveyAnswers,
} from '@/lib/nutrition'

type Dog = {
  id: string
  name: string
  weight: number
  age_value: number
  age_unit: 'years' | 'months'
  neutered: boolean
  activity_level: 'low' | 'medium' | 'high'
}

const STEPS = ['body', 'diet', 'allergy', 'health', 'loading'] as const
type Step = typeof STEPS[number]

export default function SurveyPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const dogId = params.id as string

  const [dog, setDog] = useState<Dog | null>(null)
  const [currentStep, setCurrentStep] = useState<Step>('body')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const [body, setBody] = useState<SurveyAnswers['bodyCondition'] | ''>('')
  const [foodType, setFoodType] = useState('')
  const [snackFreq, setSnackFreq] = useState('')
  const [taste, setTaste] = useState('')
  const [dlMode, setDlMode] = useState<'none' | 'unknown' | 'has' | ''>('')
  const [allergies, setAllergies] = useState<string[]>([])
  const [hlMode, setHlMode] = useState<'none' | 'has' | ''>('')
  const [healthConcerns, setHealthConcerns] = useState<string[]>([])

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
  const progress = Math.round((stepIdx / (STEPS.length - 1)) * 100)

  function toggleArr(arr: string[], v: string, setter: (x: string[]) => void) {
    if (arr.includes(v)) setter(arr.filter((x) => x !== v))
    else setter([...arr, v])
  }

  function validateStep(): boolean {
    setErr('')
    if (currentStep === 'body' && !body) {
      setErr('체형을 선택해 주세요')
      return false
    }
    if (currentStep === 'diet' && (!foodType || !snackFreq || !taste)) {
      setErr('모든 항목을 선택해 주세요')
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
    if (currentStep === 'health' && !hlMode) {
      setErr('하나를 선택해 주세요')
      return false
    }
    if (currentStep === 'health' && hlMode === 'has' && healthConcerns.length === 0) {
      setErr('하나 이상 선택해 주세요')
      return false
    }
    return true
  }

  async function goNext() {
    if (!validateStep()) return
    const idx = STEPS.indexOf(currentStep)
    if (currentStep === 'health') {
      setCurrentStep('loading')
      setTimeout(() => saveAndGoResult(), 2000)
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

    const answers: SurveyAnswers = {
      bodyCondition: body as SurveyAnswers['bodyCondition'],
      allergies,
      healthConcerns,
      foodType,
      snackFreq,
      taste,
    }

    const { data: surveyData, error: surveyErr } = await supabase
      .from('surveys')
      .insert({ dog_id: dogId, user_id: user.id, answers })
      .select()
      .single()

    if (surveyErr || !surveyData) {
      alert('저장 실패: ' + surveyErr?.message)
      setSaving(false)
      return
    }

    const nu = calculateNutrition(
      {
        weight: dog.weight,
        ageValue: dog.age_value,
        ageUnit: dog.age_unit,
        neutered: dog.neutered,
        activityLevel: dog.activity_level,
      },
      answers
    )

    const supps = getSupplements(healthConcerns)

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
      supplements: supps.map((s) => s.name),
    })

    if (analysisErr) {
      alert('분석 저장 실패: ' + analysisErr.message)
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
                Step {stepIdx + 1} / {STEPS.length - 1}
              </span>
              <span className="text-[10px] font-bold text-terracotta">
                {progress}%
              </span>
            </div>
            <div className="mt-2 h-1 bg-rule rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-moss to-terracotta transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* 체형 */}
        {currentStep === 'body' && (
          <div>
            <span className="kicker mb-3 inline-block">Body Condition</span>
            <h1 className="font-serif mb-3" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              {dog.name}의 체형은
              <br />
              어떤가요?
            </h1>
            <p className="text-[12px] text-muted mb-6 leading-relaxed">
              위에서 봤을 때 허리 라인을 기준으로 골라주세요.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { k: 'skinny', t: '너무 마름', d: '갈비뼈가 보여요', dot: 6 },
                { k: 'slim', t: '약간 마름', d: '허리가 잘록', dot: 10 },
                { k: 'ideal', t: '이상적', d: '딱 좋아요', dot: 14 },
                { k: 'chubby', t: '살짝 통통', d: '허리가 통나무', dot: 18 },
                { k: 'obese', t: '비만', d: '배가 나왔어요', dot: 22 },
              ].map((b) => {
                const active = body === b.k
                return (
                  <button
                    key={b.k}
                    onClick={() => setBody(b.k as typeof body)}
                    className={`py-4 px-2 rounded-2xl border transition text-center ${
                      active
                        ? 'border-text bg-bg'
                        : 'border-rule bg-white hover:border-muted'
                    }`}
                  >
                    <div className="h-7 flex items-end justify-center mb-1.5">
                      <div
                        className={`rounded-full ${
                          active ? 'bg-terracotta' : 'bg-muted'
                        }`}
                        style={{ width: b.dot, height: b.dot }}
                      />
                    </div>
                    <div className="text-[12px] font-bold text-text">
                      {b.t}
                    </div>
                    <div className="text-[10px] text-muted mt-0.5">
                      {b.d}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 식생활 */}
        {currentStep === 'diet' && (
          <div>
            <span className="kicker mb-3 inline-block">Eating Habits</span>
            <h1 className="font-serif mb-3" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              {dog.name}의
              <br />
              식생활을 알려주세요.
            </h1>
            <p className="text-[12px] text-muted mb-6 leading-relaxed">
              현재 먹고 있는 형태를 골라주세요.
            </p>
            <Section label="주식">
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
            <Section label="간식">
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
            <Section label="기호">
              <OptsRow
                value={taste}
                options={[
                  { v: '잘 먹음', label: '잘 먹음', Icon: Smile },
                  { v: '예민', label: '예민', Icon: Meh },
                  { v: '편식', label: '편식', Icon: Frown },
                ]}
                onChange={setTaste}
              />
            </Section>
          </div>
        )}

        {/* 알레르기 */}
        {currentStep === 'allergy' && (
          <div>
            <span className="kicker mb-3 inline-block">Allergies</span>
            <h1 className="font-serif mb-3" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              피해야 할
              <br />
              재료가 있나요?
            </h1>
            <p className="text-[12px] text-muted mb-6 leading-relaxed">
              알레르기가 있다면 알려주세요.
            </p>
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
                {['닭·칠면조', '소고기', '양고기', '연어·생선', '유제품', '곡물'].map(
                  (v) => (
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
                  )
                )}
              </div>
            )}
          </div>
        )}

        {/* 건강 고민 */}
        {currentStep === 'health' && (
          <div>
            <span className="kicker mb-3 inline-block">Health Concerns</span>
            <h1 className="font-serif mb-3" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              건강 관련
              <br />
              고민이 있나요?
            </h1>
            <p className="text-[12px] text-muted mb-6 leading-relaxed">
              맞춤 보충제 추천에 반영돼요.
            </p>
            <OptsRow
              value={hlMode}
              options={[
                { v: 'none', label: '없어요', Icon: Smile },
                { v: 'has', label: '있어요', Icon: Stethoscope },
              ]}
              onChange={(v) => setHlMode(v as typeof hlMode)}
            />
            {hlMode === 'has' && (
              <div className="flex flex-wrap gap-2 mt-5">
                {['체중', '소화', '피부/털', '관절', '신장', '치아'].map((v) => (
                  <button
                    key={v}
                    onClick={() =>
                      toggleArr(healthConcerns, v, setHealthConcerns)
                    }
                    className={`px-4 py-2 rounded-xl border text-[12px] font-bold transition ${
                      healthConcerns.includes(v)
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

        {/* 로딩 */}
        {isLoading && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-bg flex items-center justify-center mx-auto mb-6 animate-pulse">
              <DogIcon
                className="w-10 h-10 text-terracotta"
                strokeWidth={1.3}
              />
            </div>
            <span className="kicker mb-2 inline-block">Analyzing</span>
            <h2 className="font-serif mb-2" style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {dog.name} 맞춤 레시피
              <br />
              분석하고 있어요
            </h2>
            <p className="text-[12px] text-muted mb-6">
              NRC / AAFCO 기준 영양 설계 중...
            </p>
            <div className="flex justify-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-terracotta rounded-full animate-pulse"></span>
              <span
                className="w-1.5 h-1.5 bg-terracotta rounded-full animate-pulse"
                style={{ animationDelay: '0.15s' }}
              ></span>
              <span
                className="w-1.5 h-1.5 bg-terracotta rounded-full animate-pulse"
                style={{ animationDelay: '0.3s' }}
              ></span>
            </div>
          </div>
        )}

        {/* 에러 */}
        {err && !isLoading && (
          <div className="mt-5 flex items-start gap-2 text-[12px] text-sale font-semibold bg-[#FFF5F3] border border-sale/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2} />
            <span>{err}</span>
          </div>
        )}

        {/* 네비게이션 */}
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
              {currentStep === 'health' ? '결과 보기' : '다음'}
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

function Section({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-5">
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
            className={`inline-flex items-center gap-1.5 px-4 py-3 rounded-xl border text-[12px] font-bold transition ${
              active
                ? 'border-text bg-text text-white'
                : 'border-rule bg-white text-text hover:border-muted'
            }`}
          >
            {Icon && (
              <Icon
                className={`w-3.5 h-3.5 ${
                  active ? 'text-white' : 'text-muted'
                }`}
                strokeWidth={2}
              />
            )}
            {label}
          </button>
        )
      })}
    </div>
  )
}
