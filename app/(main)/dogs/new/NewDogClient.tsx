'use client'

// audit #101 — NewDogClient: form state + submit. page.tsx (server) 가 auth
// 검증 후 user.id 를 prop 으로 전달 (insert 시 user_id 명시 필요).
// 2026-10-09 앱 새 디자인('A 포스터', 시안 D11 강아지 등록): 왼쪽 정렬 제목(제목 글꼴 32, 두 줄) · 점선 사진 칸 ·
//   이름표 16 굵게 · 높이 56 네모 칸(값이 있으면 먹선) · 고르기 칸(고름 = 먹색) · 먹색 '등록 완료 →'(높이 60).
//   검사·저장·사진 올리기·자동저장 로직은 그대로다.
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DogPhotoPicker from '@/components/DogPhotoPicker'
import { resolvePhotoState, type PhotoState } from '@/lib/dogPhotos'
import { isAdvancedUiEnabled } from '@/lib/ui-flags'
import { deriveAgeFromBirth } from '@/lib/dog-age'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import { V3, V3Radius } from '@/lib/design/tokens'
import { ArrowRightIcon, CheckIcon, WarningIcon, XIcon } from '@/components/v3/dog/DogIcons'
import {
  BreedField,
  ChoiceButton,
  ChoiceGroup,
  Field,
  PickerField,
  SelectField,
  TextField,
  UnitText,
  primaryButtonStyle,
} from '@/components/v3/dog/DogFormParts'

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

  // 2026-07-19 온보딩 리디자인(사장님 "옛날거 다 지우고 새로") — 로직 불변, 프레젠테이션만.
  // 모든 입력 높이 56 고정(2026-10-09 시안 D11) → 생일(date) 칸만 크기 달라 보이던 것 통일 그대로.
  return (
    <div style={{ lineHeight: 'normal' }}>
      <form
        onSubmit={handleSubmit}
        // ★safe-area 를 여기서 다시 더하지 않는다 (2026-08-07 앱 화면 감사).
        //  AppChrome 헤더가 이미 paddingTop: env(safe-area-inset-top) 을 넣고
        //  flow 에 자리를 차지한다. /dogs/new 는 focusMode 가 아니라 그 헤더가
        //  렌더되므로, 여기서 또 더하면 노치 아이폰에서 폼 위에 45~59px 빈
        //  공간이 더 생긴다.
        style={{ padding: '26px 20px 32px', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.15 }}>
            우리 아이를
            <br />
            등록해요
          </h1>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: V3.inkSoft }}>
            맞춤 영양 분석을 위해 기본 정보만 알려주시면 돼요
          </p>
        </div>

        {/* 사진 — 점선 칸(시안 D11) */}
        <div
          style={{
            marginTop: 24,
            padding: 16,
            border: '1.5px dashed #9A9A9A',
            borderRadius: V3Radius.sm,
          }}
        >
          <DogPhotoPicker currentUrl={null} onChange={setPhotoState} enableCrop />
        </div>

        <Field label="이름" style={{ marginTop: 24 }}>
          <TextField
            type="text"
            aria-label="강아지 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 코코"
            maxLength={20}
            autoComplete="off"
            autoCapitalize="off"
            enterKeyHint="next"
            height={56}
            padX={16}
          />
        </Field>

        <Field label="견종" asDiv style={{ marginTop: 20 }}>
          <BreedField
            value={breed}
            onChange={setBreed}
            placeholder="입력해서 검색 (예: 포메라니안)"
            enterKeyHint="next"
          />
        </Field>

        <ChoiceGroup legend="성별" columns={2} gap={8} style={{ marginTop: 20 }}>
          <ChoiceButton active={gender === 'male'} onClick={() => setGender('male')} height={56} fontSize={17}>
            남아
          </ChoiceButton>
          <ChoiceButton active={gender === 'female'} onClick={() => setGender('female')} height={56} fontSize={17}>
            여아
          </ChoiceButton>
        </ChoiceGroup>

        <ChoiceGroup legend="중성화" columns={2} gap={8} style={{ marginTop: 20 }}>
          <ChoiceButton active={neutered === true} onClick={() => setNeutered(true)} height={56} fontSize={17}>
            <CheckIcon size={18} />
            했어요
          </ChoiceButton>
          <ChoiceButton active={neutered === false} onClick={() => setNeutered(false)} height={56} fontSize={17}>
            <XIcon size={16} />안 했어요
          </ChoiceButton>
        </ChoiceGroup>

        {/* 생일 — 모든 입력과 동일 높이(56)로 통일(사장님: 혼자만 크기 안 맞음) */}
        <Field
          label="생일"
          style={{ marginTop: 20 }}
          help="나이는 생일로 자동 계산돼요 · 정확히 모르면 대략도 괜찮아요"
        >
          <PickerField
            max={todayKstIsoDate()}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            aria-label="생일"
            height={56}
            padX={16}
          />
        </Field>

        {/* 체중 — kg 단위는 칸 안 오른쪽 */}
        <Field label="체중" style={{ marginTop: 20 }}>
          <TextField
            type="number"
            onWheel={(e) => e.currentTarget.blur()}
            aria-label="체중 (kg)"
            min="0"
            max="100"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="예: 4.5"
            inputMode="decimal"
            enterKeyHint="done"
            height={56}
            padX={16}
            trailing={<UnitText size={16} weight={800}>kg</UnitText>}
          />
        </Field>

        {isAdvancedUiEnabled('advanced_inputs') && (
          <>
            {/* 체중 칸 바로 아래 덧붙는 두 칸(이름표 없이 — 예전 그대로) */}
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SelectField
                value={weightMethod}
                onChange={(e) => setWeightMethod(e.target.value as typeof weightMethod)}
                aria-label="체중 측정 도구"
                height={52}
              >
                <option value="unknown">측정 방법 — 모름</option>
                <option value="vet_scale">동물병원 체중계</option>
                <option value="home_digital">가정용 디지털</option>
                <option value="home_analog">가정용 아날로그</option>
                <option value="hold">안고 재기</option>
                <option value="eyeball">눈으로 추정</option>
              </SelectField>
              <span style={{ fontSize: 14, lineHeight: 1.5, color: V3.inkMute }}>
                정확한 도구일수록 맞춤도가 올라가요. 모르면 그대로 두셔도 돼요.
              </span>
            </div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <PickerField
                value={weightMeasuredAt}
                onChange={(e) => setWeightMeasuredAt(e.target.value)}
                aria-label="체중 측정 일자"
                height={52}
              />
              <span style={{ fontSize: 14, lineHeight: 1.5, color: V3.inkMute }}>
                측정 일자가 오늘에 가까울수록 맞춤도가 올라가요
              </span>
            </div>
            <Field label="급여량 측정 도구" style={{ marginTop: 20 }} help="정기배송을 이용하시면 자동 추적이 가능해요">
              <SelectField
                value={feedMethod}
                onChange={(e) => setFeedMethod(e.target.value as typeof feedMethod)}
                aria-label="급여량 측정 도구"
                height={52}
              >
                <option value="unknown">측정 도구 — 모름</option>
                <option value="auto_delivery">자체 사료 자동 추적</option>
                <option value="scale">저울</option>
                <option value="cup">계량컵</option>
                <option value="eyeball">눈대중</option>
              </SelectField>
            </Field>
          </>
        )}

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              marginTop: 24,
              padding: '12px 14px',
              borderRadius: V3Radius.sm,
              background: 'rgba(198, 61, 42, 0.08)',
              color: V3.sale,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.45,
            }}
          >
            <WarningIcon size={18} style={{ marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading || undefined}
          style={{ ...primaryButtonStyle(60), marginTop: 30, opacity: loading ? 0.6 : 1 }}
        >
          {loading ? '등록 중...' : '등록 완료'}
          {!loading && <ArrowRightIcon size={18} />}
        </button>
      </form>
    </div>
  )
}
