'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { calculateNutrition, getSupplements, type SurveyAnswers } from '@/lib/nutrition'

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

  // answers
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
      const { data, error } = await supabase
        .from('dogs')
        .select('id, name, weight, age_value, age_unit, neutered, activity_level')
        .eq('id', dogId)
        .single()
      if (error || !data) { router.push('/dogs'); return }
      setDog(data)
    }
    load()
  }, [dogId, router, supabase])

  const stepIdx = STEPS.indexOf(currentStep)
  const progress = Math.round((stepIdx / (STEPS.length - 1)) * 100)

  function toggleArr(arr: string[], v: string, setter: (x: string[]) => void) {
    if (arr.includes(v)) setter(arr.filter(x => x !== v))
    else setter([...arr, v])
  }

  function validateStep(): boolean {
    setErr('')
    if (currentStep === 'body' && !body) { setErr('체형을 선택해 주세요'); return false }
    if (currentStep === 'diet' && (!foodType || !snackFreq || !taste)) { setErr('모든 항목을 선택해 주세요'); return false }
    if (currentStep === 'allergy' && !dlMode) { setErr('하나를 선택해 주세요'); return false }
    if (currentStep === 'allergy' && dlMode === 'has' && allergies.length === 0) { setErr('하나 이상 선택해 주세요'); return false }
    if (currentStep === 'health' && !hlMode) { setErr('하나를 선택해 주세요'); return false }
    if (currentStep === 'health' && hlMode === 'has' && healthConcerns.length === 0) { setErr('하나 이상 선택해 주세요'); return false }
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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const answers: SurveyAnswers = {
      bodyCondition: body as SurveyAnswers['bodyCondition'],
      allergies,
      healthConcerns,
      foodType, snackFreq, taste,
    }

    // 1. 설문 저장
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

    // 2. 영양 분석 계산
    const nu = calculateNutrition({
      weight: dog.weight,
      ageValue: dog.age_value,
      ageUnit: dog.age_unit,
      neutered: dog.neutered,
      activityLevel: dog.activity_level,
    }, answers)

    const supps = getSupplements(healthConcerns)

    // 3. 분석 결과 저장
    const { error: analysisErr } = await supabase
      .from('analyses')
      .insert({
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
        supplements: supps.map(s => s.name),
      })

    if (analysisErr) {
      alert('분석 저장 실패: ' + analysisErr.message)
      setSaving(false)
      return
    }

    // 4. 결과 페이지로
    router.push(`/dogs/${dogId}/analysis`)
    router.refresh()
  }

  if (!dog) {
    return (
      <main className="flex items-center justify-center min-h-[80vh]">
        <div className="text-[#8A7668]">로딩 중...</div>
      </main>
    )
  }

  const isLoading = currentStep === 'loading'

  return (
    <main className="px-6 py-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        {!isLoading && (
          <div className="mb-6">
            <Link href={`/dogs/${dogId}`} className="text-sm text-[#8A7668] hover:text-[#3D2B1F]">
              ← 돌아가기
            </Link>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-bold text-[#8A7668]">
                {stepIdx + 1} / {STEPS.length - 1}
              </span>
            </div>
            <div className="mt-2 h-1.5 bg-[#EDE6D8] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#6B7F3A] to-[#A0452E] transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* 체형 */}
        {currentStep === 'body' && (
          <div>
            <div className="text-xs font-black text-[#A0452E] tracking-widest uppercase mb-3">Step 01</div>
            <h1 className="text-3xl font-black text-[#3D2B1F] leading-tight tracking-tight mb-3">
              {dog.name}의 체형은<br />어떤가요?
            </h1>
            <p className="text-sm text-[#8A7668] mb-8">위에서 봤을 때 허리 라인을 기준으로 골라주세요.</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { k: 'skinny', e: '🦴', t: '너무 마름', d: '갈비뼈가 보여요' },
                { k: 'slim', e: '🐕', t: '약간 마름', d: '허리가 잘록' },
                { k: 'ideal', e: '🌟', t: '이상적', d: '딱 좋아요!' },
                { k: 'chubby', e: '🐶', t: '살짝 통통', d: '허리가 통나무' },
                { k: 'obese', e: '🐻', t: '비만', d: '배가 나왔어요' },
              ].map((b) => (
                <button key={b.k} onClick={() => setBody(b.k as typeof body)}
                  className={`py-4 px-2 rounded-2xl border-2 transition-all text-center ${body === b.k ? 'border-[#2A2118] bg-[#F5F0E6] shadow-[3px_3px_0_#A0452E] -translate-y-0.5' : 'border-[#EDE6D8] bg-white'}`}>
                  <div className="text-3xl mb-1">{b.e}</div>
                  <div className="text-xs font-bold text-[#3D2B1F]">{b.t}</div>
                  <div className="text-[10px] text-[#8A7668]">{b.d}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 식생활 */}
        {currentStep === 'diet' && (
          <div>
            <div className="text-xs font-black text-[#A0452E] tracking-widest uppercase mb-3">Step 02</div>
            <h1 className="text-3xl font-black text-[#3D2B1F] leading-tight tracking-tight mb-3">
              {dog.name}의<br />식생활을 알려주세요.
            </h1>
            <p className="text-sm text-[#8A7668] mb-8">현재 먹고 있는 형태를 골라주세요.</p>
            <Section label="주식">
              <OptsRow value={foodType} options={[['건식 사료', '🥣 건식'], ['습식/화식', '🍲 습식/화식'], ['반반', '🍽️ 반반']]} onChange={setFoodType} />
            </Section>
            <Section label="간식">
              <OptsRow value={snackFreq} options={[['거의 안 줌', '거의 안 줌'], ['가끔', '가끔'], ['매일', '매일']]} onChange={setSnackFreq} />
            </Section>
            <Section label="기호">
              <OptsRow value={taste} options={[['잘 먹음', '😊 잘 먹음'], ['예민', '🤔 예민'], ['편식', '😣 편식']]} onChange={setTaste} />
            </Section>
          </div>
        )}

        {/* 알레르기 */}
        {currentStep === 'allergy' && (
          <div>
            <div className="text-xs font-black text-[#A0452E] tracking-widest uppercase mb-3">Step 03</div>
            <h1 className="text-3xl font-black text-[#3D2B1F] leading-tight tracking-tight mb-3">
              피해야 할<br />재료가 있나요?
            </h1>
            <p className="text-sm text-[#8A7668] mb-8">알레르기가 있다면 알려주세요.</p>
            <OptsRow value={dlMode} options={[['none', '👌 없어요'], ['unknown', '🤷 잘 몰라요'], ['has', '⚠️ 있어요']]}
              onChange={(v) => setDlMode(v as typeof dlMode)} />
            {dlMode === 'has' && (
              <div className="flex flex-wrap gap-2 mt-5">
                {['닭·칠면조', '소고기', '양고기', '연어·생선', '유제품', '곡물'].map((v) => (
                  <button key={v} onClick={() => toggleArr(allergies, v, setAllergies)}
                    className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all ${allergies.includes(v) ? 'border-[#2A2118] bg-[#3D2B1F] text-white shadow-[2px_2px_0_#2A2118] -translate-y-0.5' : 'border-[#EDE6D8] bg-white text-[#5C4A3A]'}`}>
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 건강 고민 */}
        {currentStep === 'health' && (
          <div>
            <div className="text-xs font-black text-[#A0452E] tracking-widest uppercase mb-3">Step 04</div>
            <h1 className="text-3xl font-black text-[#3D2B1F] leading-tight tracking-tight mb-3">
              건강 관련<br />고민이 있나요?
            </h1>
            <p className="text-sm text-[#8A7668] mb-8">맞춤 보충제 추천에 반영돼요.</p>
            <OptsRow value={hlMode} options={[['none', '😊 없어요'], ['has', '🩺 있어요']]}
              onChange={(v) => setHlMode(v as typeof hlMode)} />
            {hlMode === 'has' && (
              <div className="flex flex-wrap gap-2 mt-5">
                {['체중', '소화', '피부/털', '관절', '신장', '치아'].map((v) => (
                  <button key={v} onClick={() => toggleArr(healthConcerns, v, setHealthConcerns)}
                    className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all ${healthConcerns.includes(v) ? 'border-[#2A2118] bg-[#3D2B1F] text-white shadow-[2px_2px_0_#2A2118] -translate-y-0.5' : 'border-[#EDE6D8] bg-white text-[#5C4A3A]'}`}>
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 로딩 */}
        {isLoading && (
          <div className="text-center py-20">
            <div className="text-6xl mb-6 animate-bounce">🐕‍🦺</div>
            <h2 className="text-2xl font-black text-[#3D2B1F] mb-2">
              {dog.name} 맞춤 레시피<br />분석하고 있어요
            </h2>
            <p className="text-sm text-[#8A7668] mb-6">NRC/AAFCO 기준 영양 설계 중...</p>
            <div className="flex justify-center gap-1.5">
              <span className="w-2 h-2 bg-[#A0452E] rounded-full animate-pulse"></span>
              <span className="w-2 h-2 bg-[#A0452E] rounded-full animate-pulse" style={{ animationDelay: '0.15s' }}></span>
              <span className="w-2 h-2 bg-[#A0452E] rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></span>
            </div>
          </div>
        )}

        {/* 에러 */}
        {err && !isLoading && (
          <div className="mt-5 text-sm text-[#B83A2E] font-semibold bg-[#FFF5F3] border-2 border-[#B83A2E]/20 rounded-xl px-4 py-3">
            ⚠ {err}
          </div>
        )}

        {/* 네비게이션 */}
        {!isLoading && (
          <div className="flex items-center justify-between mt-10">
            <button onClick={goPrev} disabled={stepIdx === 0}
              className="text-sm font-bold text-[#8A7668] py-3 px-4 rounded-xl hover:bg-white disabled:opacity-0 transition">
              ← 이전
            </button>
            <button onClick={goNext} disabled={saving}
              className="py-3 px-6 rounded-xl bg-[#A0452E] text-white font-bold border-2 border-[#2A2118] shadow-[3px_3px_0_#2A2118] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#2A2118] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50">
              {currentStep === 'health' ? '결과 보기 →' : '다음 →'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-xs font-bold text-[#8A7668] uppercase tracking-wider mb-2">{label}</div>
      {children}
    </div>
  )
}

function OptsRow({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`px-4 py-3 rounded-xl border-2 text-sm font-bold transition-all ${value === v ? 'border-[#2A2118] bg-[#3D2B1F] text-white shadow-[2px_2px_0_#2A2118] -translate-y-0.5' : 'border-[#EDE6D8] bg-white text-[#5C4A3A]'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}