'use client'

// audit #101 — EditDogClient: form state + submit. page.tsx (server) 가 auth +
// dog ownership 검증하고 초기 dog row 를 prop drill.
// 2026-10-09 앱 새 디자인('A 포스터', 시안 D13 정보 수정): 회색 머리말 '프로필 수정' + 제목 "{이름} 정보"(제목 글꼴 32)
//   · 회색 면 사진 칸 · 이름표 16 굵게(꼭 넣을 칸은 빨간 *) · 높이 56 네모 칸 · 고르기 칸(고름 = 먹색)
//   · 먹색 '저장하기 →'(높이 60). 검사·저장·사진 처리·체중 측정시각 규칙은 그대로다.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DogPhotoPicker from '@/components/DogPhotoPicker'
import { resolvePhotoState, type PhotoState } from '@/lib/dogPhotos'
import { isAdvancedUiEnabled } from '@/lib/ui-flags'
import { deriveAgeFromBirth } from '@/lib/dog-age'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import { petName } from '@/lib/korean'
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

/** 측정 도구·상세 입력(배포 스위치 'advanced_inputs' 뒤) 묶음 머리 — 위 가는 선 + 회색 굵은 글자. */
function GroupHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${V3.rule}`, fontSize: 15, fontWeight: 800, color: V3.inkMute }}>
      {children}
    </div>
  )
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
        // 체중이 '실제로 바뀐' 경우에만 측정시각 갱신. 폼이 체중을 프리필하므로
        // 이름만 바꿔 저장해도 now 로 리셋되던 버그가 있었다 — 측정 최신성이
        // 부풀고, 설문 재분석 게이트가 '체중 재측정됨'으로 오인해 한도를 우회했다
        // (2026-07-17). undefined 면 supabase 가 컬럼을 건드리지 않아 기존값 보존.
        weight_measured_at:
          weight !== '' && weight !== initial.weight
            ? new Date().toISOString()
            : undefined,
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

  return (
    <div style={{ lineHeight: 'normal' }}>
      <form onSubmit={handleSubmit} style={{ padding: '24px 20px 32px', display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: V3.inkMute }}>프로필 수정</span>
        <h1 style={{ margin: '6px 0 0', fontSize: 32, lineHeight: 1.1, wordBreak: 'keep-all' }}>
          {petName(initial.name)} 정보
        </h1>

        {/* 사진 — 회색 면 칸(시안 D13) */}
        <div style={{ marginTop: 20, padding: 16, background: V3.soft, borderRadius: V3Radius.sm }}>
          <DogPhotoPicker currentUrl={photoUrl} onChange={setPhotoState} />
        </div>

        <Field label="이름" required style={{ marginTop: 22 }}>
          <TextField
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            aria-label="강아지 이름"
            height={56}
            padX={16}
          />
        </Field>

        <Field label="견종" required asDiv style={{ marginTop: 20 }}>
          <BreedField
            value={breed}
            onChange={setBreed}
            placeholder="입력해서 검색 (예: 포메라니안)"
            enterKeyHint="next"
          />
        </Field>

        <ChoiceGroup legend="성별" required columns={2} gap={8} style={{ marginTop: 20 }}>
          <ChoiceButton active={gender === 'male'} onClick={() => setGender('male')} height={56} fontSize={17}>
            남아
          </ChoiceButton>
          <ChoiceButton active={gender === 'female'} onClick={() => setGender('female')} height={56} fontSize={17}>
            여아
          </ChoiceButton>
        </ChoiceGroup>

        <ChoiceGroup legend="중성화" required columns={2} gap={8} style={{ marginTop: 20 }}>
          <ChoiceButton active={neutered === true} onClick={() => setNeutered(true)} height={56} fontSize={17}>
            <CheckIcon size={18} />
            했어요
          </ChoiceButton>
          <ChoiceButton active={neutered === false} onClick={() => setNeutered(false)} height={56} fontSize={17}>
            <XIcon size={16} />안 했어요
          </ChoiceButton>
        </ChoiceGroup>

        <Field
          label="생일"
          required
          style={{ marginTop: 20 }}
          help="나이는 생일로 자동 계산돼요 (정확히 모르면 대략으로 넣어도 돼요)"
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

        <Field label="체중" required style={{ marginTop: 20 }}>
          <TextField
            type="number"
            onWheel={(e) => e.currentTarget.blur()}
            min="0"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            aria-label="체중 (kg)"
            inputMode="decimal"
            height={56}
            padX={16}
            trailing={<UnitText size={16} weight={800}>kg</UnitText>}
          />
        </Field>

        {/* 활동량 — 설문에서 물어보므로 등록/수정 폼에서 제거(사장님 2026-07-16).
            기존 값은 update 에서 건드리지 않아 보존된다. */}

        {/* Phase P10 — 측정 도구 메타. */}
        {isAdvancedUiEnabled('advanced_inputs') && (
          <>
            <GroupHead>측정 도구 (선택)</GroupHead>
            <Field label="체중 측정 도구" style={{ marginTop: 12 }}>
              <SelectField value={weightMethod} onChange={(e) => setWeightMethod(e.target.value)} aria-label="체중 측정 도구" height={52}>
                <option value="unknown">측정 도구 — 모름</option>
                <option value="vet_scale">동물병원 체중계</option>
                <option value="home_digital">가정용 디지털</option>
                <option value="home_analog">가정용 아날로그</option>
                <option value="hold">안고 재기</option>
                <option value="eyeball">눈으로 추정</option>
              </SelectField>
            </Field>
            <Field label="활동량 측정 도구" style={{ marginTop: 14 }}>
              <SelectField value={activityMethod} onChange={(e) => setActivityMethod(e.target.value)} aria-label="활동량 측정 도구" height={52}>
                <option value="unknown">측정 도구 — 모름</option>
                <option value="pedometer">만보계 / 스마트태그</option>
                <option value="gps">GPS 트래커</option>
                <option value="subjective">주관 추정</option>
              </SelectField>
            </Field>
            <Field
              label="급여량 측정 도구"
              style={{ marginTop: 14 }}
              help="정확한 도구로 잴수록 급여량을 더 정밀하게 계산해 드려요."
            >
              <SelectField value={feedMethod} onChange={(e) => setFeedMethod(e.target.value)} aria-label="급여량 측정 도구" height={52}>
                <option value="unknown">측정 도구 — 모름</option>
                <option value="auto_delivery">자체 사료 자동 추적</option>
                <option value="scale">저울</option>
                <option value="cup">계량컵</option>
                <option value="eyeball">눈대중</option>
              </SelectField>
            </Field>
          </>
        )}

        {/* Phase P19 — 추가 입력 메타 (옵션). */}
        {isAdvancedUiEnabled('advanced_inputs') && (
          <>
            <GroupHead>상세 입력 (선택)</GroupHead>
            <Field label="체중 측정자" style={{ marginTop: 12 }}>
              <SelectField value={weightMeasuredBy} onChange={(e) => setWeightMeasuredBy(e.target.value)} aria-label="체중 측정자" height={52}>
                <option value="unknown">모름</option>
                <option value="self">본인</option>
                <option value="family">가족</option>
                <option value="vet">수의사</option>
              </SelectField>
            </Field>
            <Field label="활동량 측정 기간" style={{ marginTop: 14 }}>
              <SelectField value={activityPeriod} onChange={(e) => setActivityPeriod(e.target.value)} aria-label="활동량 측정 기간" height={52}>
                <option value="unknown">모름</option>
                <option value="daily">1일 평균</option>
                <option value="weekly">1주 평균</option>
                <option value="monthly">1개월 평균</option>
              </SelectField>
            </Field>
            <Field label="산책 강도" style={{ marginTop: 14 }}>
              <SelectField value={walkIntensity} onChange={(e) => setWalkIntensity(e.target.value)} aria-label="산책 강도" height={52}>
                <option value="unknown">모름</option>
                <option value="walk">걷기</option>
                <option value="jog">조깅</option>
                <option value="run">뜀</option>
                <option value="mixed">섞임</option>
              </SelectField>
            </Field>
            <Field label="간식 빈도" style={{ marginTop: 14 }}>
              <SelectField value={treatFrequency} onChange={(e) => setTreatFrequency(e.target.value)} aria-label="간식 빈도" height={52}>
                <option value="unknown">모름</option>
                <option value="none">안 줌</option>
                <option value="rare">가끔</option>
                <option value="weekly">주 1~2회</option>
                <option value="daily">매일</option>
              </SelectField>
            </Field>
            <ChoiceGroup legend="간식 종류 (복수 선택)" style={{ marginTop: 14 }}>
              {['육포', '껌', '과일', '채소', '쿠키', '동결건조'].map((t) => {
                const active = treatTypes.includes(t)
                return (
                  <ChoiceButton
                    key={t}
                    active={active}
                    onClick={() =>
                      setTreatTypes((prev) =>
                        active
                          ? prev.filter((x) => x !== t)
                          : [...prev, t],
                      )
                    }
                    height={44}
                    fontSize={15}
                    padding="0 14px"
                  >
                    {t}
                  </ChoiceButton>
                )
              })}
            </ChoiceGroup>
            <ChoiceGroup legend="인간 음식 급여" columns={3} style={{ marginTop: 14 }}>
              {[
                { v: null, t: '모름' },
                { v: true, t: '예' },
                { v: false, t: '아니오' },
              ].map((o) => (
                <ChoiceButton key={String(o.v)} active={humanFoodGiven === o.v} onClick={() => setHumanFoodGiven(o.v)} height={48}>
                  {o.t}
                </ChoiceButton>
              ))}
            </ChoiceGroup>
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
          {loading ? '저장 중...' : '저장하기'}
          {!loading && <ArrowRightIcon size={18} />}
        </button>
      </form>
    </div>
  )
}
