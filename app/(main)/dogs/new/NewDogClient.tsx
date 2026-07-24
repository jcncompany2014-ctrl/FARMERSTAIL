'use client'

// audit #101 — NewDogClient: form state + submit. page.tsx (server) 가 auth
// 검증 후 user.id 를 prop 으로 전달 (insert 시 user_id 명시 필요).
import { useState, useEffect, useRef } from 'react'
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
import BreedCombobox from '@/components/web/fd/BreedCombobox'
import { deriveAgeFromBirth } from '@/lib/dog-age'
import { todayKstIsoDate } from '@/lib/datetime-kst'

/**
 * datepicker (YYYY-MM-DD) → 자정 KST 의 timestamptz ISO 변환.
 */
function weightMeasuredAtIso(yyyymmdd: string): string {
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (yyyymmdd === todayKey) return today.toISOString()
  return new Date(`${yyyymmdd}T00:00:00+09:00`).toISOString()
}

type NewDogDraft = {
  v?: number
  ts?: number
  name?: string
  breed?: string
  gender?: 'male' | 'female' | ''
  neutered?: boolean | null
  birthDate?: string
  weight?: string
  weightMethod?: string
  weightMeasuredAt?: string
  activityMethod?: string
  feedMethod?: string
}

// audit 2-5: 컴포넌트 외부 함수 — react-hooks/purity 규칙 회피.
// Date.now() / localStorage 가 render path 로 인식되지 않게 모듈-수준에 둠.
function loadNewDogDraft(autosaveKey: string): NewDogDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(autosaveKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as NewDogDraft
    if (parsed.v !== 1) return null
    if (parsed.ts && Date.now() - parsed.ts > 7 * 86_400_000) {
      localStorage.removeItem(autosaveKey)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export default function NewDogClient({ userId }: { userId: string }) {
  const router = useRouter()
  const supabase = createClient()

  // audit 2-5: 등록 폼이 길다 — 사진 첨부 도중 권한 거부, 네트워크 오류,
  // 새로고침으로 다 날아가던 케이스 차단. localStorage 7일 자동저장.
  // 사진은 File 객체라 직렬화 불가 → 사진 외 필드만 저장.
  const AUTOSAVE_KEY = `ft:new-dog-draft:${userId}`
  const draft = loadNewDogDraft(AUTOSAVE_KEY)

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
  // 나이 대신 생일(YYYY-MM-DD) — age_value/age_unit 는 저장 시 자동 계산(사장님 2026-07-16).
  const [birthDate, setBirthDate] = useState(draft?.birthDate ?? '')
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
  // 활동량 측정도구 — UI 는 제거했지만 activity_method 컬럼이 NOT NULL 이라 값 유지.
  const [activityMethod] = useState<
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
  // 제출 중 플래그 — 제출 성공 시 draft 를 지우는데, 디바운스 autosave(500ms)
  // 가 그 뒤에 발화하면 draft 가 되살아나 다음 '강아지 추가'에서 옛 정보가 남는다.
  // (사장님 보고 2026-06-19). 이 플래그가 true 면 autosave 가 재저장을 건너뛴다.
  const submittingRef = useRef(false)

  // 폼 변경 시 디바운스 자동저장.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const timer = setTimeout(() => {
      // 제출 중/완료 후엔 재저장 금지 (clear 를 되살리는 레이스 차단).
      if (submittingRef.current) return
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
            birthDate,
            weight,
            weightMethod,
            weightMeasuredAt,
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
    birthDate,
    weight,
    weightMethod,
    weightMeasuredAt,
    activityMethod,
    feedMethod,
  ])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return // 모바일 더블탭 → 중복 강아지 insert 방지
    setError('')

    if (!name.trim()) {
      setError('아이 이름을 입력해 주세요')
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

    submittingRef.current = true
    setLoading(true)

    const { data: inserted, error: insertError } = await supabase
      .from('dogs')
      .insert({
        user_id: userId,
        name: name.trim(),
        breed,
        gender,
        neutered,
        birth_date: birthDate,
        // 생일로부터 자동 계산 — 칼로리 알고리즘이 읽는 age_value/age_unit 유지.
        age_value: derivedAge.value,
        age_unit: derivedAge.unit,
        weight: parseFloat(weight),
        // 활동량은 설문에서 받음(사장님 2026-07-16 폼에서 제거) → null. 설문이 채운다.
        activity_level: null,
        weight_method: weightMethod,
        weight_measured_at: weightMeasuredAtIso(weightMeasuredAt),
        activity_method: activityMethod,
        feed_method: feedMethod,
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      setLoading(false)
      submittingRef.current = false // 실패 시 autosave 재개
      // UX audit #27: raw DB 메시지 노출 X — 일반 메시지 + Sentry 로 raw 보존.
      setError('저장하지 못했어요. 잠시 후 다시 시도해 주세요')
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

  // 2026-07-19 온보딩 리디자인(사장님 "옛날거 다 지우고 새로") — 로직 불변,
  // 프레젠테이션만. 모든 입력 높이 54px 고정 → 생일(date) 박스만 크기 달라
  // 보이던 것 통일. 라벨 = 큰 대문자 kicker 폐기, 읽기 쉬운 13px 볼드.
  const labelCls = 'block text-[13px] font-bold text-ink mb-2'
  const inputCls =
    'w-full h-[54px] px-4 rounded-[14px] border border-rule bg-bg-3 text-[16px] text-text placeholder:text-muted focus:outline-none focus:border-terracotta transition'
  const chipBase =
    'h-[54px] rounded-[14px] border-[1.5px] text-[14px] font-bold transition flex items-center justify-center gap-1.5 active:scale-[0.98]'
  const chipActive =
    'border-terracotta bg-terracotta text-white shadow-[0_6px_18px_-8px_rgba(220,83,42,0.5)]'
  const chipIdle = 'border-rule bg-bg-3 text-text'

  return (
    <div className="min-h-[100dvh]">
      <form
        onSubmit={handleSubmit}
        className="px-5 pt-[max(18px,env(safe-area-inset-top))] pb-12"
      >
        {/* 헤더 — 친근한 앱 톤(옛 대문자 kicker 폐기) */}
        <div className="text-center pt-1 pb-1">
          <h1
            className="font-sans text-[27px] leading-tight"
            style={{ fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em' }}
          >
            우리 아이를 등록해요
          </h1>
          <p className="text-[13px] text-muted mt-2 leading-relaxed">
            맞춤 영양 분석을 위해<br />기본 정보만 알려주시면 돼요
          </p>
        </div>

        {/* 사진 — 중앙 원형 */}
        <div className="flex justify-center mt-6 mb-1">
          <DogPhotoPicker currentUrl={null} onChange={setPhotoState} enableCrop />
        </div>

        <div className="space-y-5 mt-6">
          {/* 이름 */}
          <div>
            <label className={labelCls}>이름</label>
            <input
              type="text"
              aria-label="강아지 이름"
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

          {/* 견종 */}
          <div>
            <label className={labelCls}>견종</label>
            <BreedCombobox
              tone="app"
              value={breed}
              onChange={setBreed}
              placeholder="입력해서 검색 (예: 포메라니안)"
              inputClassName={inputCls}
              ariaLabel="견종"
              enterKeyHint="next"
            />
          </div>

          {/* 성별 */}
          <div>
            <label className={labelCls}>성별</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                aria-pressed={gender === 'male'}
                onClick={() => setGender('male')}
                className={`${chipBase} ${gender === 'male' ? chipActive : chipIdle}`}
              >
                남아
              </button>
              <button
                type="button"
                aria-pressed={gender === 'female'}
                onClick={() => setGender('female')}
                className={`${chipBase} ${gender === 'female' ? chipActive : chipIdle}`}
              >
                여아
              </button>
            </div>
          </div>

          {/* 중성화 */}
          <div>
            <label className={labelCls}>중성화</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                aria-pressed={neutered === true}
                onClick={() => setNeutered(true)}
                className={`${chipBase} ${neutered === true ? chipActive : chipIdle}`}
              >
                <Check className="w-4 h-4" strokeWidth={2.5} />
                했어요
              </button>
              <button
                type="button"
                aria-pressed={neutered === false}
                onClick={() => setNeutered(false)}
                className={`${chipBase} ${neutered === false ? chipActive : chipIdle}`}
              >
                <X className="w-4 h-4" strokeWidth={2.5} />안 했어요
              </button>
            </div>
          </div>

          {/* 생일 — 모든 입력과 동일 높이(54px)로 통일(사장님: 혼자만 크기 안 맞음) */}
          <div>
            <label className={labelCls}>생일</label>
            <input
              type="date"
              max={todayKstIsoDate()}
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className={`${inputCls} appearance-none`}
              aria-label="생일"
            />
            <p className="mt-2 text-[12px] text-muted leading-relaxed">
              나이는 생일로 자동 계산돼요 · 정확히 모르면 대략도 괜찮아요
            </p>
          </div>

          {/* 체중 — kg suffix inline */}
          <div>
            <label className={labelCls}>체중</label>
            <div className="relative">
              <input
                type="number" onWheel={(e) => e.currentTarget.blur()}
                aria-label="체중 (kg)"
                min="0"
                max="100"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className={`${inputCls} pr-12`}
                placeholder="예: 4.5"
                inputMode="decimal"
                enterKeyHint="done"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-bold text-muted pointer-events-none">
                kg
              </span>
            </div>

            {isAdvancedUiEnabled('advanced_inputs') && (
              <>
                <Select
                  value={weightMethod}
                  onChange={(e) =>
                    setWeightMethod(e.target.value as typeof weightMethod)
                  }
                  sizeVariant="sm"
                  wrapperClassName="mt-2.5"
                  aria-label="체중 측정 도구"
                >
                  <option value="unknown">측정 방법 — 모름</option>
                  <option value="vet_scale">동물병원 체중계</option>
                  <option value="home_digital">가정용 디지털</option>
                  <option value="home_analog">가정용 아날로그</option>
                  <option value="hold">안고 재기</option>
                  <option value="eyeball">눈으로 추정</option>
                </Select>
                <p className="mt-1.5 text-[11.5px] text-muted">
                  정확한 도구일수록 맞춤도가 올라가요. 모르면 그대로 두셔도 돼요.
                </p>
                <input
                  type="date"
                  value={weightMeasuredAt}
                  onChange={(e) => setWeightMeasuredAt(e.target.value)}
                  className={`${inputCls} appearance-none mt-2.5 text-[14px]`}
                  aria-label="체중 측정 일자"
                />
                <p className="mt-1.5 text-[11.5px] text-muted">
                  측정 일자가 오늘에 가까울수록 맞춤도가 올라가요
                </p>
              </>
            )}
          </div>

          {isAdvancedUiEnabled('advanced_inputs') && (
            <div>
              <label className={labelCls}>급여량 측정 도구</label>
              <Select
                value={feedMethod}
                onChange={(e) =>
                  setFeedMethod(e.target.value as typeof feedMethod)
                }
                sizeVariant="sm"
                aria-label="급여량 측정 도구"
              >
                <option value="unknown">측정 도구 — 모름</option>
                <option value="auto_delivery">자체 사료 자동 추적</option>
                <option value="scale">저울</option>
                <option value="cup">계량컵</option>
                <option value="eyeball">눈대중</option>
              </Select>
              <p className="mt-1.5 text-[11.5px] text-muted">
                정기배송을 이용하시면 자동 추적이 가능해요
              </p>
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2 text-[12.5px] text-sale font-semibold rounded-[12px] px-4 py-3 mt-6"
            style={{ background: 'color-mix(in srgb, var(--sale) 8%, transparent)' }}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2} />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-1.5 w-full h-[56px] rounded-full bg-terracotta text-white text-[15px] font-bold active:scale-[0.98] transition disabled:opacity-50 mt-7"
          style={{ boxShadow: '0 8px 24px -8px rgba(220,83,42,0.5)' }}
        >
          {loading ? '등록 중...' : '등록 완료'}
          {!loading && <ArrowRight className="w-4 h-4" strokeWidth={2.5} />}
        </button>
      </form>
    </div>
  )
}
