'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
import { useToast } from '@/components/ui/Toast'
import DogPhotoPicker from '@/components/DogPhotoPicker'
import { resolvePhotoState, type PhotoState } from '@/lib/dogPhotos'
import { isUpgrade, type MethodKind } from '@/lib/rewards/measurement-upgrade'
import { isAdvancedUiEnabled } from '@/lib/ui-flags'

const BREEDS = [
  '포메라니안', '말티즈', '푸들', '토이푸들', '시츄', '비숑 프리제',
  '골든 리트리버', '래브라도 리트리버', '진돗개', '웰시코기',
  '닥스훈트', '치와와', '시바이누', '보더콜리', '요크셔 테리어',
  '미니어처 슈나우저', '사모예드', '허스키', '비글', '프렌치 불독',
  '코커 스패니얼', '파피용', '퍼그', '잭 러셀 테리어', '믹스',
]

export default function EditDogPage() {
  const router = useRouter()
  const params = useParams()
  const dogId = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [loadingInit, setLoadingInit] = useState(true)
  const [error, setError] = useState('')

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
  // Phase P10 — 측정 도구 메타데이터 (업그레이드 보상 트리거).
  const [weightMethod, setWeightMethod] = useState<string>('unknown')
  const [activityMethod, setActivityMethod] = useState<string>('unknown')
  const [feedMethod, setFeedMethod] = useState<string>('unknown')
  // 초기값 — 업그레이드 비교용
  const [initialWeightMethod, setInitialWeightMethod] = useState<string>('unknown')
  const [initialActivityMethod, setInitialActivityMethod] = useState<string>('unknown')
  const [initialFeedMethod, setInitialFeedMethod] = useState<string>('unknown')
  // Phase P19 — 추가 입력 메타 (B-3, B-5, B-6, B-9, B-10, B-11).
  // 모두 nullable / unknown default. voice-guidelines §7.
  const [weightMeasuredBy, setWeightMeasuredBy] = useState<string>('unknown')
  const [activityPeriod, setActivityPeriod] = useState<string>('unknown')
  const [walkIntensity, setWalkIntensity] = useState<string>('unknown')
  const [treatFrequency, setTreatFrequency] = useState<string>('unknown')
  const [treatTypes, setTreatTypes] = useState<string[]>([])
  const [humanFoodGiven, setHumanFoodGiven] = useState<boolean | null>(null)

  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoState, setPhotoState] = useState<PhotoState>({ action: 'keep' })
  const [userId, setUserId] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    async function loadDog() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('dogs')
        .select('*')
        .eq('id', dogId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (error || !data) {
        router.push('/dogs')
        return
      }

      setName(data.name ?? '')
      setBreed(data.breed ?? '')
      setGender(data.gender ?? '')
      setNeutered(data.neutered)
      setAgeValue(data.age_value?.toString() ?? '')
      setAgeUnit(data.age_unit ?? 'years')
      setWeight(data.weight?.toString() ?? '')
      setActivityLevel(data.activity_level ?? '')
      // P10 — 측정 도구 초기값. 업그레이드 비교용으로 별도 저장.
      const wm = data.weight_method ?? 'unknown'
      const am = data.activity_method ?? 'unknown'
      const fm = data.feed_method ?? 'unknown'
      setWeightMethod(wm)
      setActivityMethod(am)
      setFeedMethod(fm)
      setInitialWeightMethod(wm)
      setInitialActivityMethod(am)
      setInitialFeedMethod(fm)
      // Phase P19 — 추가 메타 (nullable). null 이면 'unknown' fallback.
      setWeightMeasuredBy(data.weight_measured_by ?? 'unknown')
      setActivityPeriod(data.activity_period ?? 'unknown')
      setWalkIntensity(data.walk_intensity ?? 'unknown')
      setTreatFrequency(data.treat_frequency ?? 'unknown')
      setTreatTypes(Array.isArray(data.treat_types) ? data.treat_types : [])
      setHumanFoodGiven(data.human_food_given ?? null)
      setPhotoUrl(data.photo_url ?? null)
      setUserId(user.id)
      setLoadingInit(false)
    }
    loadDog()
  }, [dogId, router, supabase])

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

    // Resolve photo first so we can persist final URL in the same update
    let finalPhotoUrl: string | null = photoUrl
    if (photoState.action !== 'keep' && userId) {
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
        age_value: parseInt(ageValue),
        age_unit: ageUnit,
        weight: parseFloat(weight),
        activity_level: activityLevel,
        weight_method: weightMethod,
        activity_method: activityMethod,
        feed_method: feedMethod,
        // Phase P19 — 추가 메타. 'unknown' 은 null 로 저장해 컬럼 CHECK 통과
        weight_measured_by: weightMeasuredBy === 'unknown' ? null : weightMeasuredBy,
        activity_period: activityPeriod === 'unknown' ? null : activityPeriod,
        walk_intensity: walkIntensity === 'unknown' ? null : walkIntensity,
        treat_frequency: treatFrequency === 'unknown' ? null : treatFrequency,
        treat_types: treatTypes.length > 0 ? treatTypes : null,
        human_food_given: humanFoodGiven,
        // 체중 input 변경 시 measured_at 도 갱신 (사용자가 바로 잰 것)
        weight_measured_at:
          weight !== '' ? new Date().toISOString() : undefined,
        photo_url: finalPhotoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dogId)
      .eq('user_id', userId!)
      .select('id')

    // P10 — 측정 도구 업그레이드 보상 (best-effort, 흐름 차단 X)
    const upgrades: Array<{ kind: MethodKind; prev: string; next: string }> = []
    if (isUpgrade('weight', initialWeightMethod, weightMethod)) {
      upgrades.push({ kind: 'weight', prev: initialWeightMethod, next: weightMethod })
    }
    if (isUpgrade('activity', initialActivityMethod, activityMethod)) {
      upgrades.push({ kind: 'activity', prev: initialActivityMethod, next: activityMethod })
    }
    if (isUpgrade('feed', initialFeedMethod, feedMethod)) {
      upgrades.push({ kind: 'feed', prev: initialFeedMethod, next: feedMethod })
    }
    for (const up of upgrades) {
      try {
        const res = await fetch(`/api/dogs/${dogId}/measurement-upgrade`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(up),
        })
        if (res.ok) {
          const data = (await res.json()) as {
            ok?: boolean
            amount?: number
          }
          if (data.ok && data.amount) {
            toast.success(`측정 도구 업그레이드 응원 ${data.amount.toLocaleString()}P 적립`)
          }
        }
      } catch {
        /* silent */
      }
    }

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

  if (loadingInit) {
    return (
      <main className="min-h-[80vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  const labelCls =
    'block text-[10px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]'
  const inputCls =
    'w-full px-4 py-3 rounded-xl border border-rule bg-white text-[13px] text-text focus:outline-none focus:border-terracotta transition'
  const chipBase =
    'py-3 rounded-xl border text-[12px] font-bold transition flex items-center justify-center gap-1.5'
  const chipActive = 'border-text bg-text text-white'
  const chipIdle =
    'border-rule bg-white text-text hover:border-muted'

  return (
    <main className="pb-10 px-5">
      <div className="pt-6 pb-2">
        <Link
          href={`/dogs/${dogId}`}
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 돌아가기
        </Link>
        <div className="mt-3">
          <span className="kicker inline-block">Edit Profile</span>
          <h1 className="font-serif mt-1.5" style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            정보 수정
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 mt-4">
        <div className="bg-white rounded-2xl border border-rule p-4">
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
            className={inputCls}
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
              value={ageValue}
              onChange={(e) => setAgeValue(e.target.value)}
              className={`${inputCls} flex-1`}
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
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={inputCls}
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

        {/* Phase P10 — 측정 도구 메타. 변경 시 업그레이드 보상 1,000P.
            초기 단계 — ui-flag 'advanced_inputs' OFF 면 hide. */}
        {isAdvancedUiEnabled('advanced_inputs') && (
        <div className="border-t border-rule pt-4 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted">
            측정 도구 (선택)
          </div>
          <div>
            <label className={labelCls}>체중 측정 도구</label>
            <select
              value={weightMethod}
              onChange={(e) => setWeightMethod(e.target.value)}
              className={`${inputCls} text-[12px]`}
            >
              <option value="unknown">측정 도구 — 모름</option>
              <option value="vet_scale">동물병원 체중계</option>
              <option value="home_digital">가정용 디지털</option>
              <option value="home_analog">가정용 아날로그</option>
              <option value="hold">안고 재기</option>
              <option value="eyeball">눈으로 추정</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>활동량 측정 도구</label>
            <select
              value={activityMethod}
              onChange={(e) => setActivityMethod(e.target.value)}
              className={`${inputCls} text-[12px]`}
            >
              <option value="unknown">측정 도구 — 모름</option>
              <option value="pedometer">만보계 / 스마트태그</option>
              <option value="gps">GPS 트래커</option>
              <option value="subjective">주관 추정</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>급여량 측정 도구</label>
            <select
              value={feedMethod}
              onChange={(e) => setFeedMethod(e.target.value)}
              className={`${inputCls} text-[12px]`}
            >
              <option value="unknown">측정 도구 — 모름</option>
              <option value="auto_delivery">자체 사료 자동 추적</option>
              <option value="scale">저울</option>
              <option value="cup">계량컵</option>
              <option value="eyeball">눈대중</option>
            </select>
          </div>
          <p className="text-[10.5px] text-muted leading-relaxed">
            정확한 도구로 바꾸면 응원 포인트 1,000P 적립돼요 (kind 별 1회).
          </p>
        </div>
        )}

        {/* Phase P19 — 추가 입력 메타 (옵션). voice-guidelines §7 — 모름 default.
            ui-flag 'advanced_inputs' OFF 면 hide. */}
        {isAdvancedUiEnabled('advanced_inputs') && (
        <div className="border-t border-rule pt-4 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted">
            상세 입력 (선택)
          </div>
          <div>
            <label className={labelCls}>체중 측정자</label>
            <select
              value={weightMeasuredBy}
              onChange={(e) => setWeightMeasuredBy(e.target.value)}
              className={`${inputCls} text-[12px]`}
            >
              <option value="unknown">모름</option>
              <option value="self">본인</option>
              <option value="family">가족</option>
              <option value="vet">수의사</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>활동량 측정 기간</label>
            <select
              value={activityPeriod}
              onChange={(e) => setActivityPeriod(e.target.value)}
              className={`${inputCls} text-[12px]`}
            >
              <option value="unknown">모름</option>
              <option value="daily">1일 평균</option>
              <option value="weekly">1주 평균</option>
              <option value="monthly">1개월 평균</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>산책 강도</label>
            <select
              value={walkIntensity}
              onChange={(e) => setWalkIntensity(e.target.value)}
              className={`${inputCls} text-[12px]`}
            >
              <option value="unknown">모름</option>
              <option value="walk">걷기</option>
              <option value="jog">조깅</option>
              <option value="run">뜀</option>
              <option value="mixed">섞임</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>간식 빈도</label>
            <select
              value={treatFrequency}
              onChange={(e) => setTreatFrequency(e.target.value)}
              className={`${inputCls} text-[12px]`}
            >
              <option value="unknown">모름</option>
              <option value="none">안 줌</option>
              <option value="rare">가끔</option>
              <option value="weekly">주 1~2회</option>
              <option value="daily">매일</option>
            </select>
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
                    className="px-3 py-1.5 rounded-full text-[11px] font-bold transition"
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
          {loading ? '저장 중...' : '저장하기'}
          {!loading && (
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          )}
        </button>
      </form>
    </main>
  )
}
