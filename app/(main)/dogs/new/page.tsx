'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const BREEDS = [
  '포메라니안', '말티즈', '푸들', '토이푸들', '시츄', '비숑 프리제',
  '골든 리트리버', '래브라도 리트리버', '진돗개', '웰시코기',
  '닥스훈트', '치와와', '시바이누', '보더콜리', '요크셔 테리어',
  '미니어처 슈나우저', '사모예드', '허스키', '비글', '프렌치 불독',
  '코커 스패니얼', '파피용', '퍼그', '잭 러셀 테리어', '믹스'
]

export default function NewDogPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userChecked, setUserChecked] = useState(false)

  // form state
  const [name, setName] = useState('')
  const [breed, setBreed] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | ''>('')
  const [neutered, setNeutered] = useState<boolean | null>(null)
  const [ageValue, setAgeValue] = useState('')
  const [ageUnit, setAgeUnit] = useState<'years' | 'months'>('years')
  const [weight, setWeight] = useState('')
  const [activityLevel, setActivityLevel] = useState<'low' | 'medium' | 'high' | ''>('')

  // 로그인 확인
  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserChecked(true)
    }
    checkUser()
  }, [router, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // 검증
    if (!name.trim()) { setError('강아지 이름을 입력해 주세요'); return }
    if (!breed) { setError('견종을 선택해 주세요'); return }
    if (!gender) { setError('성별을 선택해 주세요'); return }
    if (neutered === null) { setError('중성화 여부를 선택해 주세요'); return }
    if (!ageValue || parseInt(ageValue) <= 0) { setError('나이를 입력해 주세요'); return }
    if (!weight || parseFloat(weight) <= 0) { setError('체중을 입력해 주세요'); return }
    if (!activityLevel) { setError('활동량을 선택해 주세요'); return }

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { error: insertError } = await supabase
      .from('dogs')
      .insert({
        user_id: user.id,
        name: name.trim(),
        breed,
        gender,
        neutered,
        age_value: parseInt(ageValue),
        age_unit: ageUnit,
        weight: parseFloat(weight),
        activity_level: activityLevel,
      })

    setLoading(false)

    if (insertError) {
      setError('저장에 실패했어요: ' + insertError.message)
      return
    }

    router.push('/dogs')
    router.refresh()
  }

  if (!userChecked) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F5F0E6]">
        <div className="text-[#8A7668]">로딩 중...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F5F0E6] px-6 py-10">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dogs" className="text-sm text-[#8A7668] hover:text-[#3D2B1F] transition">
            ← 돌아가기
          </Link>
          <h1 className="text-3xl font-black text-[#3D2B1F] tracking-tight mt-4">
            새 강아지 등록
          </h1>
          <p className="text-[#8A7668] text-sm mt-2">
            강아지의 기본 정보를 알려주세요
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 이름 */}
          <div>
            <label className="block text-xs font-bold text-[#5C4A3A] mb-2 uppercase tracking-wide">
              이름 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-[#EDE6D8] bg-white text-[#2A2118] focus:outline-none focus:border-[#3D2B1F] transition"
              placeholder="예: 코코"
              maxLength={20}
            />
          </div>

          {/* 견종 */}
          <div>
            <label className="block text-xs font-bold text-[#5C4A3A] mb-2 uppercase tracking-wide">
              견종 *
            </label>
            <select
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-[#EDE6D8] bg-white text-[#2A2118] focus:outline-none focus:border-[#3D2B1F] transition"
            >
              <option value="">선택하세요</option>
              {BREEDS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* 성별 */}
          <div>
            <label className="block text-xs font-bold text-[#5C4A3A] mb-2 uppercase tracking-wide">
              성별 *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGender('male')}
                className={`py-3 rounded-xl border-2 font-bold transition ${
                  gender === 'male'
                    ? 'border-[#3D2B1F] bg-[#3D2B1F] text-white shadow-[3px_3px_0_#2A2118] -translate-y-0.5'
                    : 'border-[#EDE6D8] bg-white text-[#5C4A3A]'
                }`}
              >
                🙋‍♂️ 남아
              </button>
              <button
                type="button"
                onClick={() => setGender('female')}
                className={`py-3 rounded-xl border-2 font-bold transition ${
                  gender === 'female'
                    ? 'border-[#3D2B1F] bg-[#3D2B1F] text-white shadow-[3px_3px_0_#2A2118] -translate-y-0.5'
                    : 'border-[#EDE6D8] bg-white text-[#5C4A3A]'
                }`}
              >
                🙋‍♀️ 여아
              </button>
            </div>
          </div>

          {/* 중성화 */}
          <div>
            <label className="block text-xs font-bold text-[#5C4A3A] mb-2 uppercase tracking-wide">
              중성화 *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNeutered(true)}
                className={`py-3 rounded-xl border-2 font-bold transition ${
                  neutered === true
                    ? 'border-[#3D2B1F] bg-[#3D2B1F] text-white shadow-[3px_3px_0_#2A2118] -translate-y-0.5'
                    : 'border-[#EDE6D8] bg-white text-[#5C4A3A]'
                }`}
              >
                ✅ 했어요
              </button>
              <button
                type="button"
                onClick={() => setNeutered(false)}
                className={`py-3 rounded-xl border-2 font-bold transition ${
                  neutered === false
                    ? 'border-[#3D2B1F] bg-[#3D2B1F] text-white shadow-[3px_3px_0_#2A2118] -translate-y-0.5'
                    : 'border-[#EDE6D8] bg-white text-[#5C4A3A]'
                }`}
              >
                ❌ 안 했어요
              </button>
            </div>
          </div>

          {/* 나이 */}
          <div>
            <label className="block text-xs font-bold text-[#5C4A3A] mb-2 uppercase tracking-wide">
              나이 *
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={ageValue}
                onChange={(e) => setAgeValue(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border-2 border-[#EDE6D8] bg-white text-[#2A2118] focus:outline-none focus:border-[#3D2B1F] transition"
                placeholder="0"
              />
              <button
                type="button"
                onClick={() => setAgeUnit('years')}
                className={`px-4 rounded-xl border-2 font-bold transition ${
                  ageUnit === 'years'
                    ? 'border-[#3D2B1F] bg-[#F5F0E6] text-[#3D2B1F]'
                    : 'border-[#EDE6D8] bg-white text-[#8A7668]'
                }`}
              >
                살
              </button>
              <button
                type="button"
                onClick={() => setAgeUnit('months')}
                className={`px-4 rounded-xl border-2 font-bold transition ${
                  ageUnit === 'months'
                    ? 'border-[#3D2B1F] bg-[#F5F0E6] text-[#3D2B1F]'
                    : 'border-[#EDE6D8] bg-white text-[#8A7668]'
                }`}
              >
                개월
              </button>
            </div>
          </div>

          {/* 체중 */}
          <div>
            <label className="block text-xs font-bold text-[#5C4A3A] mb-2 uppercase tracking-wide">
              체중 (kg) *
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-[#EDE6D8] bg-white text-[#2A2118] focus:outline-none focus:border-[#3D2B1F] transition"
              placeholder="예: 4.5"
            />
          </div>

          {/* 활동량 */}
          <div>
            <label className="block text-xs font-bold text-[#5C4A3A] mb-2 uppercase tracking-wide">
              활동량 *
            </label>
            <div className="space-y-2">
              {[
                { v: 'low', e: '😴', t: '낮음', d: '거의 움직이지 않아요' },
                { v: 'medium', e: '🚶', t: '보통', d: '하루 1~2회 산책' },
                { v: 'high', e: '🏃', t: '활동적', d: '뛰어다니기를 좋아해요' },
              ].map((a) => (
                <button
                  key={a.v}
                  type="button"
                  onClick={() => setActivityLevel(a.v as 'low' | 'medium' | 'high')}
                  className={`w-full py-3 px-4 rounded-xl border-2 font-bold text-left transition flex items-center gap-3 ${
                    activityLevel === a.v
                      ? 'border-[#3D2B1F] bg-[#3D2B1F] text-white shadow-[3px_3px_0_#2A2118] -translate-y-0.5'
                      : 'border-[#EDE6D8] bg-white text-[#5C4A3A]'
                  }`}
                >
                  <span className="text-2xl">{a.e}</span>
                  <div>
                    <div className="font-bold">{a.t}</div>
                    <div className={`text-xs ${activityLevel === a.v ? 'text-white/70' : 'text-[#8A7668]'}`}>
                      {a.d}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 에러 */}
          {error && (
            <div className="text-sm text-[#B83A2E] font-semibold bg-[#FFF5F3] border-2 border-[#B83A2E]/20 rounded-xl px-4 py-3">
              ⚠ {error}
            </div>
          )}

          {/* 제출 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl bg-[#A0452E] text-white font-bold text-base border-2 border-[#2A2118] shadow-[3px_3px_0_#2A2118] hover:shadow-[4px_4px_0_#2A2118] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
          >
            {loading ? '저장 중...' : '등록하기 →'}
          </button>
        </form>
      </div>
    </main>
  )
}