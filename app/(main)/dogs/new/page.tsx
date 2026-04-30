'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Check,
  X,
  Moon,
  Footprints,
  Zap,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import DogPhotoPicker from '@/components/DogPhotoPicker'
import { resolvePhotoState, type PhotoState } from '@/lib/dogPhotos'

const BREEDS = [
  '포메라니안', '말티즈', '푸들', '토이푸들', '시츄', '비숑 프리제',
  '골든 리트리버', '래브라도 리트리버', '진돗개', '웰시코기',
  '닥스훈트', '치와와', '시바이누', '보더콜리', '요크셔 테리어',
  '미니어처 슈나우저', '사모예드', '허스키', '비글', '프렌치 불독',
  '코커 스패니얼', '파피용', '퍼그', '잭 러셀 테리어', '믹스',
]

export default function NewDogPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userChecked, setUserChecked] = useState(false)

  const [name, setName] = useState('')
  const [breed, setBreed] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | ''>('')
  const [neutered, setNeutered] = useState<boolean | null>(null)
  const [ageValue, setAgeValue] = useState('')
  const [ageUnit, setAgeUnit] = useState<'years' | 'months'>('years')
  const [weight, setWeight] = useState('')
  const [activityLevel, setActivityLevel] = useState<
    'low' | 'medium' | 'high' | ''
  >('')
  const [photoState, setPhotoState] = useState<PhotoState>({ action: 'keep' })

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
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

    if (!name.trim()) {
      setError('강아지 이름을 입력해 주세요')
      return
    }
    if (!breed) {
      setError('견종을 선택해 주세요')
      return
    }
    if (!gender) {
      setError('성별을 선택해 주세요')
      return
    }
    if (neutered === null) {
      setError('중성화 여부를 선택해 주세요')
      return
    }
    if (!ageValue || parseInt(ageValue) <= 0) {
      setError('나이를 입력해 주세요')
      return
    }
    if (!weight || parseFloat(weight) <= 0) {
      setError('체중을 입력해 주세요')
      return
    }
    if (!activityLevel) {
      setError('활동량을 선택해 주세요')
      return
    }

    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: inserted, error: insertError } = await supabase
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
      .select('id')
      .single()

    if (insertError || !inserted) {
      setLoading(false)
      setError('저장에 실패했어요: ' + (insertError?.message ?? ''))
      return
    }

    // Upload photo if staged, then update dog row
    if (photoState.action === 'replace') {
      try {
        const finalUrl = await resolvePhotoState(
          supabase,
          user.id,
          inserted.id,
          null,
          photoState
        )
        if (finalUrl) {
          await supabase
            .from('dogs')
            .update({ photo_url: finalUrl })
            .eq('id', inserted.id)
        }
      } catch (e) {
        // Dog was created but photo upload failed — surface but don't block
        console.error('photo upload failed', e)
      }
    }

    setLoading(false)
    router.push('/dogs')
    router.refresh()
  }

  if (!userChecked) {
    return (
      <main className="min-h-[80vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  const labelCls =
    'block text-[10px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]'
  const inputCls =
    'w-full px-4 py-3 rounded-xl border border-rule bg-white text-[13px] text-text placeholder:text-muted focus:outline-none focus:border-terracotta transition'
  const chipBase =
    'py-3 rounded-xl border text-[12px] font-bold transition flex items-center justify-center gap-1.5'
  const chipActive = 'border-text bg-text text-white'
  const chipIdle =
    'border-rule bg-white text-text hover:border-muted'

  return (
    <main className="pb-10 px-5">
      <div className="pt-6 pb-2">
        <Link
          href="/dogs"
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 돌아가기
        </Link>
        <div className="mt-3">
          <span className="kicker inline-block">New Dog</span>
          <h1 className="font-serif mt-1.5" style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            강아지 등록
          </h1>
          <p className="text-[12px] text-muted mt-1.5">
            맞춤 영양 분석을 위한 기본 정보를 알려주세요
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 mt-4">
        <div className="bg-white rounded-2xl border border-rule p-4">
          <DogPhotoPicker
            currentUrl={null}
            onChange={setPhotoState}
          />
        </div>

        <div>
          <label className={labelCls}>이름 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            placeholder="예: 코코"
            maxLength={20}
            autoComplete="off"
            autoCapitalize="off"
            enterKeyHint="next"
          />
        </div>

        <div>
          <label className={labelCls}>견종 *</label>
          <select
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            className={inputCls}
          >
            <option value="">선택하세요</option>
            {BREEDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>성별 *</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setGender('male')}
              className={`${chipBase} ${
                gender === 'male' ? chipActive : chipIdle
              }`}
            >
              남아
            </button>
            <button
              type="button"
              onClick={() => setGender('female')}
              className={`${chipBase} ${
                gender === 'female' ? chipActive : chipIdle
              }`}
            >
              여아
            </button>
          </div>
        </div>

        <div>
          <label className={labelCls}>중성화 *</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setNeutered(true)}
              className={`${chipBase} ${
                neutered === true ? chipActive : chipIdle
              }`}
            >
              <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
              했어요
            </button>
            <button
              type="button"
              onClick={() => setNeutered(false)}
              className={`${chipBase} ${
                neutered === false ? chipActive : chipIdle
              }`}
            >
              <X className="w-3.5 h-3.5" strokeWidth={2.5} />안 했어요
            </button>
          </div>
        </div>

        <div>
          <label className={labelCls}>나이 *</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              max="50"
              value={ageValue}
              onChange={(e) => setAgeValue(e.target.value)}
              className={`${inputCls} flex-1`}
              placeholder="0"
              inputMode="numeric"
              enterKeyHint="next"
            />
            <button
              type="button"
              onClick={() => setAgeUnit('years')}
              className={`px-4 rounded-xl border text-[12px] font-bold transition ${
                ageUnit === 'years'
                  ? 'border-text bg-bg text-text'
                  : 'border-rule bg-white text-muted'
              }`}
            >
              살
            </button>
            <button
              type="button"
              onClick={() => setAgeUnit('months')}
              className={`px-4 rounded-xl border text-[12px] font-bold transition ${
                ageUnit === 'months'
                  ? 'border-text bg-bg text-text'
                  : 'border-rule bg-white text-muted'
              }`}
            >
              개월
            </button>
          </div>
        </div>

        <div>
          <label className={labelCls}>체중 (kg) *</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={inputCls}
            placeholder="예: 4.5"
            inputMode="decimal"
            enterKeyHint="done"
          />
        </div>

        <div>
          <label className={labelCls}>활동량 *</label>
          <div className="space-y-2">
            {[
              {
                v: 'low' as const,
                Icon: Moon,
                t: '낮음',
                d: '거의 움직이지 않아요',
              },
              {
                v: 'medium' as const,
                Icon: Footprints,
                t: '보통',
                d: '하루 1~2회 산책',
              },
              {
                v: 'high' as const,
                Icon: Zap,
                t: '활동적',
                d: '뛰어다니기를 좋아해요',
              },
            ].map((a) => {
              const active = activityLevel === a.v
              return (
                <button
                  key={a.v}
                  type="button"
                  onClick={() => setActivityLevel(a.v)}
                  className={`w-full py-3 px-4 rounded-xl border text-left transition flex items-center gap-3 ${
                    active
                      ? 'border-text bg-text text-white'
                      : 'border-rule bg-white text-text hover:border-muted'
                  }`}
                >
                  <a.Icon
                    className={`w-5 h-5 ${
                      active ? 'text-white' : 'text-muted'
                    }`}
                    strokeWidth={1.8}
                  />
                  <div>
                    <div className="font-bold text-[13px]">{a.t}</div>
                    <div
                      className={`text-[11px] ${
                        active ? 'text-white/70' : 'text-muted'
                      }`}
                    >
                      {a.d}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-[12px] text-sale font-semibold bg-[#FFF5F3] border border-sale/20 rounded-xl px-4 py-3">
            <AlertCircle
              className="w-4 h-4 shrink-0 mt-0.5"
              strokeWidth={2}
            />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-1.5 w-full py-4 rounded-full bg-ink text-bg text-[13px] font-bold active:scale-[0.98] transition disabled:opacity-50"
        >
          {loading ? '저장 중...' : '등록하기'}
          {!loading && (
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          )}
        </button>
      </form>
    </main>
  )
}
