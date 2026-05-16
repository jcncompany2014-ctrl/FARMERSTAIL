'use client'

// audit #101 — NewDogClient: form state + submit. page.tsx (server) 가 auth
// 검증 후 user.id 를 prop 으로 전달 (insert 시 user_id 명시 필요).
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
import { isAdvancedUiEnabled } from '@/lib/ui-flags'

/**
 * datepicker (YYYY-MM-DD) → 자정 KST 의 timestamptz ISO 변환.
 */
function weightMeasuredAtIso(yyyymmdd: string): string {
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (yyyymmdd === todayKey) return today.toISOString()
  return new Date(`${yyyymmdd}T00:00:00+09:00`).toISOString()
}

const BREEDS = [
  '포메라니안', '말티즈', '푸들', '토이푸들', '시츄', '비숑 프리제',
  '골든 리트리버', '래브라도 리트리버', '진돗개', '웰시코기',
  '닥스훈트', '치와와', '시바이누', '보더콜리', '요크셔 테리어',
  '미니어처 슈나우저', '사모예드', '허스키', '비글', '프렌치 불독',
  '코커 스패니얼', '파피용', '퍼그', '잭 러셀 테리어', '믹스',
]

export default function NewDogClient({ userId }: { userId: string }) {
  const router = useRouter()
  const supabase = createClient()

  // audit 2-5: 등록 폼이 길다 — 사진 첨부 도중 권한 거부, 네트워크 오류,
  // 새로고침으로 다 날아가던 케이스 차단. localStorage 7일 자동저장.
  // 사진은 File 객체라 직렬화 불가 → 사진 외 필드만 저장.
  const AUTOSAVE_KEY = `ft:new-dog-draft:${userId}`
  const loadDraft = () => {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as {
        v?: number
        ts?: number
        name?: string
        breed?: string
        gender?: 'male' | 'female' | ''
        neutered?: boolean | null
        ageValue?: string
        ageUnit?: 'years' | 'months'
        weight?: string
        weightMethod?: string
        weightMeasuredAt?: string
        activityLevel?: 'low' | 'medium' | 'high' | ''
        activityMethod?: string
        feedMethod?: string
      }
      if (parsed.v !== 1) return null
      if (parsed.ts && Date.now() - parsed.ts > 7 * 86_400_000) {
        localStorage.removeItem(AUTOSAVE_KEY)
        return null
      }
      return parsed
    } catch {
      return null
    }
  }
  const draft = typeof window !== 'undefined' ? loadDraft() : null

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState(draft?.name ?? '')
  const [breed, setBreed] = useState(draft?.breed ?? '')
  const [gender, setGender] = useState<'male' | 'female' | ''>(
    draft?.gender ?? '',
  )
  const [neutered, setNeutered] = useState<boolean | null>(
    draft?.neutered ?? null,
  )
  const [ageValue, setAgeValue] = useState(draft?.ageValue ?? '')
  const [ageUnit, setAgeUnit] = useState<'years' | 'months'>(
    draft?.ageUnit ?? 'years',
  )
  const [weight, setWeight] = useState(draft?.weight ?? '')
  const [weightMethod, setWeightMethod] = useState<
    'vet_scale' | 'home_digital' | 'home_analog' | 'hold' | 'eyeball' | 'unknown'
  >(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (draft?.weightMethod as any) ?? 'unknown',
  )
  const [weightMeasuredAt, setWeightMeasuredAt] = useState<string>(
    draft?.weightMeasuredAt ??
      (() => {
        const d = new Date()
        const yy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        return `${yy}-${mm}-${dd}`
      })(),
  )
  const [activityLevel, setActivityLevel] = useState<
    'low' | 'medium' | 'high' | ''
  >(draft?.activityLevel ?? '')
  const [activityMethod, setActivityMethod] = useState<
    'pedometer' | 'gps' | 'subjective' | 'unknown'
  >(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (draft?.activityMethod as any) ?? 'unknown',
  )
  const [feedMethod, setFeedMethod] = useState<
    'auto_delivery' | 'scale' | 'cup' | 'eyeball' | 'unknown'
  >(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (draft?.feedMethod as any) ?? 'unknown',
  )
  const [photoState, setPhotoState] = useState<PhotoState>({ action: 'keep' })

  // 폼 변경 시 디바운스 자동저장.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          AUTOSAVE_KEY,
          JSON.stringify({
            v: 1,
            ts: Date.now(),
            name,
            breed,
            gender,
            neutered,
            ageValue,
            ageUnit,
            weight,
            weightMethod,
            weightMeasuredAt,
            activityLevel,
            activityMethod,
            feedMethod,
          }),
        )
      } catch {
        /* quota — silent */
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [
    AUTOSAVE_KEY,
    name,
    breed,
    gender,
    neutered,
    ageValue,
    ageUnit,
    weight,
    weightMethod,
    weightMeasuredAt,
    activityLevel,
    activityMethod,
    feedMethod,
  ])

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

    const { data: inserted, error: insertError } = await supabase
      .from('dogs')
      .insert({
        user_id: userId,
        name: name.trim(),
        breed,
        gender,
        neutered,
        age_value: parseInt(ageValue),
        age_unit: ageUnit,
        weight: parseFloat(weight),
        activity_level: activityLevel,
        weight_method: weightMethod,
        weight_measured_at: weightMeasuredAtIso(weightMeasuredAt),
        activity_method: activityMethod,
        feed_method: feedMethod,
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      setLoading(false)
      // UX audit #27: raw DB 메시지 노출 X — 일반 메시지 + Sentry 로 raw 보존.
      setError('저장에 실패했어요. 잠시 후 다시 시도해 주세요')
      return
    }

    // Upload photo if staged, then update dog row
    if (photoState.action === 'replace') {
      try {
        const finalUrl = await resolvePhotoState(
          supabase,
          userId,
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
        console.error('photo upload failed', e)
      }
    }

    // audit 2-5: 등록 성공 → draft 지움.
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(AUTOSAVE_KEY)
      } catch {
        /* noop */
      }
    }

    setLoading(false)
    router.push(`/dogs/${inserted.id}?welcome=1`)
    router.refresh()
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
          {isAdvancedUiEnabled('advanced_inputs') && (
            <>
              <select
                value={weightMethod}
                onChange={(e) =>
                  setWeightMethod(e.target.value as typeof weightMethod)
                }
                className={`${inputCls} mt-2 text-[12px]`}
                aria-label="체중 측정 도구"
              >
                <option value="unknown">측정 방법 — 모름</option>
                <option value="vet_scale">동물병원 체중계</option>
                <option value="home_digital">가정용 디지털</option>
                <option value="home_analog">가정용 아날로그</option>
                <option value="hold">안고 재기</option>
                <option value="eyeball">눈으로 추정</option>
              </select>
              <p className="mt-1.5 text-[10px] text-muted">
                정확한 도구일수록 맞춤도가 올라가요. 모르면 그대로 두셔도 돼요.
              </p>
              <input
                type="date"
                value={weightMeasuredAt}
                onChange={(e) => setWeightMeasuredAt(e.target.value)}
                className={`${inputCls} mt-2 text-[12px]`}
                aria-label="체중 측정 일자"
              />
              <p className="mt-1 text-[10px] text-muted">
                측정 일자가 오늘에 가까울수록 맞춤도가 올라가요
              </p>
            </>
          )}
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
          {isAdvancedUiEnabled('advanced_inputs') && (
            <select
              value={activityMethod}
              onChange={(e) =>
                setActivityMethod(e.target.value as typeof activityMethod)
              }
              className={`${inputCls} mt-2 text-[12px]`}
              aria-label="활동량 측정 도구"
            >
              <option value="unknown">측정 도구 — 모름</option>
              <option value="pedometer">만보계 / 스마트태그</option>
              <option value="gps">GPS 트래커</option>
              <option value="subjective">주관 추정</option>
            </select>
          )}
        </div>

        {isAdvancedUiEnabled('advanced_inputs') && (
          <div>
            <label className={labelCls}>급여량 측정 도구</label>
            <select
              value={feedMethod}
              onChange={(e) =>
                setFeedMethod(e.target.value as typeof feedMethod)
              }
              className={`${inputCls} text-[12px]`}
              aria-label="급여량 측정 도구"
            >
              <option value="unknown">측정 도구 — 모름</option>
              <option value="auto_delivery">자체 사료 자동 추적</option>
              <option value="scale">저울</option>
              <option value="cup">계량컵</option>
              <option value="eyeball">눈대중</option>
            </select>
            <p className="mt-1 text-[10px] text-muted">
              정기배송을 이용하시면 자동 추적이 가능해요
            </p>
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
          {loading ? '저장 중...' : '등록하기'}
          {!loading && (
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          )}
        </button>
      </form>
    </main>
  )
}
