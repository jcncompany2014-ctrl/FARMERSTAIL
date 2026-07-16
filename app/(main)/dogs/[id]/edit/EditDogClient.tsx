'use client'

// audit #101 — EditDogClient: form state + submit. page.tsx (server) 가 auth +
// dog ownership 검증하고 초기 dog row 를 prop drill.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  X,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import DogPhotoPicker from '@/components/DogPhotoPicker'
import { resolvePhotoState, type PhotoState } from '@/lib/dogPhotos'
import { isAdvancedUiEnabled } from '@/lib/ui-flags'
import { Select } from '@/components/v3'
import { deriveAgeFromBirth } from '@/lib/dog-age'
import { todayKstIsoDate } from '@/lib/datetime-kst'

const BREEDS = [
  '포메라니안', '말티즈', '푸들', '토이푸들', '시츄', '비숑 프리제',
  '골든 리트리버', '래브라도 리트리버', '진돗개', '웰시코기',
  '닥스훈트', '치와와', '시바이누', '보더콜리', '요크셔 테리어',
  '미니어처 슈나우저', '사모예드', '허스키', '비글', '프렌치 불독',
  '코커 스패니얼', '파피용', '퍼그', '잭 러셀 테리어', '믹스',
]

export type EditDogInitial = {
  id: string
  user_id: string
  name: string
  breed: string
  gender: '' | 'male' | 'female'
  neutered: boolean | null
  birth_date: string
  weight: string
  activity_level: '' | 'low' | 'medium' | 'high'
  weight_method: string
  activity_method: string
  feed_method: string
  weight_measured_by: string
  activity_period: string
  walk_intensity: string
  treat_frequency: string
  treat_types: string[]
  human_food_given: boolean | null
  photo_url: string | null
}

export default function EditDogClient({
  initial,
}: {
  initial: EditDogInitial
}) {
  const router = useRouter()
  const supabase = createClient()
  const dogId = initial.id
  const userId = initial.user_id

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState(initial.name)
  const [breed, setBreed] = useState(initial.breed)
  const [gender, setGender] = useState<'male' | 'female' | ''>(initial.gender)
  const [neutered, setNeutered] = useState<boolean | null>(initial.neutered)
  // 나이 대신 생일 — age_value/age_unit 은 저장 시 자동 계산(사장님 2026-07-16).
  const [birthDate, setBirthDate] = useState(initial.birth_date)
  const [weight, setWeight] = useState(initial.weight)
  const [weightMethod, setWeightMethod] = useState<string>(initial.weight_method)
  const [activityMethod, setActivityMethod] = useState<string>(initial.activity_method)
  const [feedMethod, setFeedMethod] = useState<string>(initial.feed_method)
  // 초기값 — 업그레이드 비교용 (server 가 전달)
  const [weightMeasuredBy, setWeightMeasuredBy] = useState<string>(initial.weight_measured_by)
  const [activityPeriod, setActivityPeriod] = useState<string>(initial.activity_period)
  const [walkIntensity, setWalkIntensity] = useState<string>(initial.walk_intensity)
  const [treatFrequency, setTreatFrequency] = useState<string>(initial.treat_frequency)
  const [treatTypes, setTreatTypes] = useState<string[]>(initial.treat_types)
  const [humanFoodGiven, setHumanFoodGiven] = useState<boolean | null>(initial.human_food_given)

  const [photoUrl] = useState<string | null>(initial.photo_url)
  const [photoState, setPhotoState] = useState<PhotoState>({ action: 'keep' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return // 더블탭 중복 저장 방지
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
    const derivedAge = deriveAgeFromBirth(birthDate, Date.now())
    if (!birthDate || !derivedAge) {
      setError('생일을 입력해 주세요')
      return
    }
    if (birthDate > todayKstIsoDate()) {
      setError('생일이 오늘보다 미래일 수 없어요')
      return
    }
    if (!weight || parseFloat(weight) <= 0) {
      setError('체중을 입력해 주세요')
      return
    }

    setLoading(true)

    let finalPhotoUrl: string | null = photoUrl
    if (photoState.action !== 'keep') {
      try {
        finalPhotoUrl = await resolvePhotoState(
          supabase,
          userId,
          dogId,
          photoUrl,
          photoState
        )
      } catch {
        setLoading(false)
        setError('사진을 업로드하지 못했어요')
        return
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('dogs')
      .update({
        name: name.trim(),
        breed,
        gender,
        neutered,
        birth_date: birthDate,
        // 생일로부터 자동 계산 — 칼로리 알고리즘이 읽는 age_value/age_unit 유지.
        age_value: derivedAge.value,
        age_unit: derivedAge.unit,
        weight: parseFloat(weight),
        // 활동량은 폼에서 제거(설문에서 받음) → 기존 값 보존 위해 update 에서 제외.
        weight_method: weightMethod,
        activity_method: activityMethod,
        feed_method: feedMethod,
        weight_measured_by: weightMeasuredBy === 'unknown' ? null : weightMeasuredBy,
        activity_period: activityPeriod === 'unknown' ? null : activityPeriod,
        walk_intensity: walkIntensity === 'unknown' ? null : walkIntensity,
        treat_frequency: treatFrequency === 'unknown' ? null : treatFrequency,
        treat_types: treatTypes.length > 0 ? treatTypes : null,
        human_food_given: humanFoodGiven,
        weight_measured_at:
          weight !== '' ? new Date().toISOString() : undefined,
        photo_url: finalPhotoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dogId)
      .eq('user_id', userId)
      .select('id')

    // P10 — 측정 도구 업그레이드 보상 (best-effort, 흐름 차단 X)
    // 측정 도구 업그레이드 포인트 보상 제거 (2026-07-16 포인트 전면 폐기).
    // 눈대중 → 저울 로 바꾸면 1,000P 를 주던 로직인데, 포인트 자체가 없어졌다.
    // 측정 도구 값(weight_method 등)은 그대로 저장된다 — 급여량 계산의 신뢰도
    // 보정(weightReliability)에 쓰이므로 그건 유지.

    setLoading(false)

    if (updateError) {
      setError('수정하지 못했어요')
      return
    }

    if (!updated || updated.length === 0) {
      setError('수정 권한이 없어요. 다시 로그인해 주세요.')
      return
    }

    router.push(`/dogs/${dogId}`)
    router.refresh()
  }

  const labelCls =
    'block text-[10.5px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]'
  // 2026-05-22 R10-A: v3 form 톤.
  // R89-B (D7): iOS Safari 는 input font-size < 16px 시 focus 자동 zoom-in.
  const inputCls =
    'w-full px-4 py-3 rounded border border-rule bg-bg-3 text-[16px] text-text focus:outline-none focus:border-terracotta transition'
  const chipBase =
    'py-3 rounded border text-[12px] font-bold transition flex items-center justify-center gap-1.5'
  const chipActive = 'border-text bg-text text-white'
  const chipIdle =
    'border-rule bg-bg-3 text-text hover:border-muted'

  return (
    <div className="pb-10 px-5">
      <div className="pt-6 pb-2">
        <div className="mt-3">
          <span className="kicker inline-block">Edit Profile</span>
          <h1 className="font-sans mt-1.5" style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            정보 수정
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 mt-4">
        <div className="bg-bg-3 rounded border border-rule p-4">
          <DogPhotoPicker
            currentUrl={photoUrl}
            onChange={setPhotoState}
          />
        </div>

        <div>
          <label className={labelCls}>이름 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            aria-label="강아지 이름"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>견종 *</label>
          <Select
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            aria-label="견종"
          >
            <option value="">선택하세요</option>
            {BREEDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className={labelCls}>성별 *</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={gender === 'male'}
              onClick={() => setGender('male')}
              className={`${chipBase} ${
                gender === 'male' ? chipActive : chipIdle
              }`}
            >
              남아
            </button>
            <button
              type="button"
              aria-pressed={gender === 'female'}
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
              aria-pressed={neutered === true}
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
              aria-pressed={neutered === false}
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
          <label className={labelCls}>생일 *</label>
          <input
            type="date"
            max={todayKstIsoDate()}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className={inputCls}
            aria-label="생일"
          />
          <p className="mt-1 text-[10.5px] text-muted">
            나이는 생일로 자동 계산돼요 (정확히 모르면 대략으로 넣어도 돼요)
          </p>
        </div>

        <div>
          <label className={labelCls}>체중 (kg) *</label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            aria-label="체중 (kg)"
            className={inputCls}
          />
        </div>

        {/* 활동량 — 설문에서 물어보므로 등록/수정 폼에서 제거(사장님 2026-07-16).
            기존 값은 update 에서 건드리지 않아 보존된다. */}

        {/* Phase P10 — 측정 도구 메타. */}
        {isAdvancedUiEnabled('advanced_inputs') && (
        <div className="border-t border-rule pt-4 space-y-3">
          <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted">
            측정 도구 (선택)
          </div>
          <div>
            <label className={labelCls}>체중 측정 도구</label>
            <Select
              value={weightMethod}
              onChange={(e) => setWeightMethod(e.target.value)}
              aria-label="체중 측정 도구"
              sizeVariant="sm"
            >
              <option value="unknown">측정 도구 — 모름</option>
              <option value="vet_scale">동물병원 체중계</option>
              <option value="home_digital">가정용 디지털</option>
              <option value="home_analog">가정용 아날로그</option>
              <option value="hold">안고 재기</option>
              <option value="eyeball">눈으로 추정</option>
            </Select>
          </div>
          <div>
            <label className={labelCls}>활동량 측정 도구</label>
            <Select
              value={activityMethod}
              onChange={(e) => setActivityMethod(e.target.value)}
              aria-label="활동량 측정 도구"
              sizeVariant="sm"
            >
              <option value="unknown">측정 도구 — 모름</option>
              <option value="pedometer">만보계 / 스마트태그</option>
              <option value="gps">GPS 트래커</option>
              <option value="subjective">주관 추정</option>
            </Select>
          </div>
          <div>
            <label className={labelCls}>급여량 측정 도구</label>
            <Select
              value={feedMethod}
              onChange={(e) => setFeedMethod(e.target.value)}
              aria-label="급여량 측정 도구"
              sizeVariant="sm"
            >
              <option value="unknown">측정 도구 — 모름</option>
              <option value="auto_delivery">자체 사료 자동 추적</option>
              <option value="scale">저울</option>
              <option value="cup">계량컵</option>
              <option value="eyeball">눈대중</option>
            </Select>
          </div>
          <p className="text-[10.5px] text-muted leading-relaxed">
            정확한 도구로 잴수록 급여량을 더 정밀하게 계산해 드려요.
          </p>
        </div>
        )}

        {/* Phase P19 — 추가 입력 메타 (옵션). */}
        {isAdvancedUiEnabled('advanced_inputs') && (
        <div className="border-t border-rule pt-4 space-y-3">
          <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted">
            상세 입력 (선택)
          </div>
          <div>
            <label className={labelCls}>체중 측정자</label>
            <Select
              value={weightMeasuredBy}
              onChange={(e) => setWeightMeasuredBy(e.target.value)}
              aria-label="체중 측정자"
              sizeVariant="sm"
            >
              <option value="unknown">모름</option>
              <option value="self">본인</option>
              <option value="family">가족</option>
              <option value="vet">수의사</option>
            </Select>
          </div>
          <div>
            <label className={labelCls}>활동량 측정 기간</label>
            <Select
              value={activityPeriod}
              onChange={(e) => setActivityPeriod(e.target.value)}
              aria-label="활동량 측정 기간"
              sizeVariant="sm"
            >
              <option value="unknown">모름</option>
              <option value="daily">1일 평균</option>
              <option value="weekly">1주 평균</option>
              <option value="monthly">1개월 평균</option>
            </Select>
          </div>
          <div>
            <label className={labelCls}>산책 강도</label>
            <Select
              value={walkIntensity}
              onChange={(e) => setWalkIntensity(e.target.value)}
              aria-label="산책 강도"
              sizeVariant="sm"
            >
              <option value="unknown">모름</option>
              <option value="walk">걷기</option>
              <option value="jog">조깅</option>
              <option value="run">뜀</option>
              <option value="mixed">섞임</option>
            </Select>
          </div>
          <div>
            <label className={labelCls}>간식 빈도</label>
            <Select
              value={treatFrequency}
              onChange={(e) => setTreatFrequency(e.target.value)}
              aria-label="간식 빈도"
              sizeVariant="sm"
            >
              <option value="unknown">모름</option>
              <option value="none">안 줌</option>
              <option value="rare">가끔</option>
              <option value="weekly">주 1~2회</option>
              <option value="daily">매일</option>
            </Select>
          </div>
          <div>
            <label className={labelCls}>간식 종류 (복수 선택)</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {['육포', '껌', '과일', '채소', '쿠키', '동결건조'].map((t) => {
                const active = treatTypes.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setTreatTypes((prev) =>
                        active
                          ? prev.filter((x) => x !== t)
                          : [...prev, t],
                      )
                    }
                    aria-pressed={active}
                    className="px-3 py-1.5 rounded-full text-[10.5px] font-bold transition"
                    style={{
                      background: active ? 'var(--ink)' : 'white',
                      color: active ? 'white' : 'var(--text)',
                      border: '1px solid var(--rule)',
                    }}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className={labelCls}>인간 음식 급여</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: null, t: '모름' },
                { v: true, t: '예' },
                { v: false, t: '아니오' },
              ].map((o) => {
                const active = humanFoodGiven === o.v
                return (
                  <button
                    key={String(o.v)}
                    type="button"
                    onClick={() => setHumanFoodGiven(o.v)}
                    aria-pressed={active}
                    className="py-2 rounded-lg text-[12px] font-bold transition"
                    style={{
                      background: active ? 'var(--ink)' : 'white',
                      color: active ? 'white' : 'var(--text)',
                      border: '1px solid var(--rule)',
                    }}
                  >
                    {o.t}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        )}

        {error && (
          <div role="alert" aria-live="assertive" className="flex items-start gap-2 text-[12px] text-sale font-semibold border rounded px-4 py-3" style={{ background: 'color-mix(in srgb, var(--sale) 6%, transparent)', borderColor: 'color-mix(in srgb, var(--sale) 25%, transparent)' }}>
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
          className="flex items-center justify-center gap-1.5 w-full py-4 rounded-full bg-ink text-bg text-[13.5px] font-bold active:scale-[0.98] transition disabled:opacity-50"
        >
          {loading ? '저장 중...' : '저장하기'}
          {!loading && (
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          )}
        </button>
      </form>
    </div>
  )
}
