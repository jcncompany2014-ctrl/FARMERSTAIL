// 설문 v4 — 식사·생활 화면들.
//   필수: FoodScreen(주식) · SnackScreen(간식, 접힘: 간식 kcal) · FreshScreen(화식 경험)
//   선택 묶음: OptFoodScreen(사료 이름·열량) · OptWalkScreen(산책, 둘째 줄: 실내 활동)
//             · OptExerciseScreen(격한 운동, 둘째 줄: 주거·한랭)
//
// 2026-09-22 시니어 사용성 3단계: 옛 meal/life 두 스텝(각 3~5문항)을 화면당 하나로.
// 식욕·식이만족도는 이미 삭제됨(2026-07-12, 계산 소비처 없음).
//
// 2026-10-09 앱 새 디자인('A 포스터', 시안 E06~E08 · E14~E16 · F26 · F27): 지금 먹는 밥 = AI 그릇 사진 줄,
// 간식·산책·운동 = 큰 칸, 화식 경험 = 줄 목록, 짧은 둘째 줄 = 선택 막대, 간식 칼로리 = 링크로 여는 창.
// 문구: '습식·화식' 설명 "캔·파우치 사료나 화식", 화식 경험 제목 "화식을 먹여 본 적이 있나요?",
// 사료 이름 예시의 타사 제품명 삭제(앱시안 결정 3번). 답 키·값(건식 사료·습식/화식·반반 등)은 그대로.
import { useState } from 'react'
import {
  ScreenShell,
  OptionList,
  LineList,
  PhotoRows,
  Segmented,
  LabelBar,
  Help,
  TextLink,
  Field,
} from './ScreenShell'
import { SurveySheet } from './Sheet'

export type IndoorActivity = 'calm' | 'moderate' | 'active' | ''
export type HomeCookingExp = 'first' | 'occasional' | 'frequent' | ''
export type Vigorous = '' | 'none' | 'self' | 'objective'
export type Housing = '' | 'indoor' | 'indoor_outdoor' | 'outdoor'

// 값은 저장값 그대로(식사 형태 문자열). 사진 = public/survey/ai/food-*.jpg(건식 · 습식/화식 · 반반 그릇).
const FOOD_OPTIONS = [
  { v: '건식 사료', label: '건식 사료', sub: '알갱이 사료', img: '/survey/ai/food-dry.jpg' },
  { v: '습식/화식', label: '습식·화식', sub: '캔·파우치 사료나 화식', img: '/survey/ai/food-wet.jpg' },
  { v: '반반', label: '반반', sub: '섞어서 줘요', img: '/survey/ai/food-half.jpg' },
] as const

export function FoodScreen({
  foodType,
  setFoodType,
}: {
  foodType: string
  setFoodType: (v: string) => void
}) {
  return (
    <ScreenShell
      kicker="식사"
      title={
        <>
          지금은 주로
          <br />
          무엇을 먹나요?
        </>
      }
      sub="지금 식사가 영양 계산의 기준이 돼요"
    >
      <div style={{ marginTop: 18 }}>
        <PhotoRows
          options={FOOD_OPTIONS}
          value={foodType as (typeof FOOD_OPTIONS)[number]['v'] | ''}
          onChange={(v) => setFoodType(v)}
          kind="food"
          ariaLabel="지금 먹는 밥"
        />
      </div>
    </ScreenShell>
  )
}

const SNACK_OPTIONS = [
  { v: '거의 안 줌', label: '거의 안 줘요' },
  { v: '가끔', label: '가끔 줘요' },
  { v: '매일', label: '매일 줘요' },
] as const

export function SnackScreen({
  snackFreq,
  setSnackFreq,
  treatKcal,
  setTreatKcal,
}: {
  snackFreq: string
  setSnackFreq: (v: string) => void
  /** 칼로리 v2 2d — 하루 간식 kcal (선택). '' = 모름 → 빈도 추정. */
  treatKcal: string
  setTreatKcal: (v: string) => void
}) {
  const [kcalOpen, setKcalOpen] = useState(false)
  const givesSnack = snackFreq === '가끔' || snackFreq === '매일'
  return (
    <ScreenShell
      kicker="식사"
      title={
        <>
          간식은
          <br />
          얼마나 자주 주나요?
        </>
      }
      sub="간식 열량은 하루 급여량에서 미리 빼 두어요"
    >
      <OptionList
        style={{ marginTop: 20 }}
        options={SNACK_OPTIONS}
        value={snackFreq as (typeof SNACK_OPTIONS)[number]['v'] | ''}
        onChange={(v) => setSnackFreq(v ?? '')}
        ariaLabel="간식 빈도"
      />
      {givesSnack && (
        <TextLink style={{ marginTop: 16 }} onClick={() => setKcalOpen(true)}>
          하루 간식 칼로리를 아신다면 알려주기 (선택)
        </TextLink>
      )}
      <SurveySheet
        open={kcalOpen}
        onClose={() => setKcalOpen(false)}
        title="하루 간식 칼로리"
        optional
        sub="간식 포장 뒷면에 있어요. 모르면 비워 두셔도 돼요 — 평균으로 계산해요"
      >
        <Field
          style={{ marginTop: 18 }}
          type="number"
          min={0}
          max={2000}
          ariaLabel="하루 간식 칼로리 (kcal)"
          value={treatKcal}
          onChange={setTreatKcal}
          placeholder="예) 40"
          unit="kcal / 하루"
        />
      </SurveySheet>
    </ScreenShell>
  )
}

const FRESH_OPTIONS = [
  { v: 'first', label: '처음이에요', sub: '한 번도 안 줘봤어요' },
  { v: 'occasional', label: '가끔', sub: '한 달에 1~2번' },
  { v: 'frequent', label: '자주', sub: '일주일에 1번 이상' },
] as const

export function FreshScreen({
  homeCookingExp,
  setHomeCookingExp,
}: {
  homeCookingExp: HomeCookingExp
  setHomeCookingExp: (v: HomeCookingExp) => void
}) {
  return (
    <ScreenShell
      kicker="식사"
      title={
        <>
          화식을 먹여 본 적이
          <br />
          있나요?
        </>
      }
      sub="처음이면 첫 박스를 더 부드럽게 시작해요"
    >
      <LineList
        style={{ marginTop: 18 }}
        options={FRESH_OPTIONS}
        value={homeCookingExp}
        onChange={(v) => setHomeCookingExp(v)}
        ariaLabel="화식 경험"
      />
    </ScreenShell>
  )
}

// ── 선택 묶음 ──────────────────────────────────────────────────────────────

export function OptFoodScreen({
  foodType,
  currentBrand,
  setCurrentBrand,
  kibbleKcal,
  setKibbleKcal,
}: {
  foodType: string
  currentBrand: string
  setCurrentBrand: (v: string) => void
  /** 칼로리 v2 5단계 — 건사료 라벨 열량 kcal/kg (선택). '' = 모름 → 평균 350/100g. */
  kibbleKcal: string
  setKibbleKcal: (v: string) => void
}) {
  const kibble = foodType === '건식 사료' || foodType === '반반'
  return (
    <ScreenShell
      kicker="선택"
      optional
      title={
        <>
          지금 먹는 사료 이름을
          <br />
          알려주세요
        </>
      }
      sub="봉투 앞면에 적힌 이름이면 돼요. 몰라도 괜찮아요"
    >
      <Field
        style={{ marginTop: 20 }}
        ariaLabel="현재 사용 중인 사료 이름"
        value={currentBrand}
        onChange={setCurrentBrand}
        placeholder="사료 이름"
      />
      {kibble && (
        <>
          <LabelBar optional style={{ marginTop: 20 }}>
            봉투 뒷면의 열량
          </LabelBar>
          <Help>
            ‘대사에너지’ 또는 ‘kcal/kg’ 옆 숫자예요.
            <br />
            모르면 비워 두세요 — 평균값으로 계산해요.
          </Help>
          <Field
            style={{ marginTop: 10 }}
            type="number"
            min={2000}
            max={6000}
            ariaLabel="건사료 열량 (kcal/kg)"
            value={kibbleKcal}
            onChange={setKibbleKcal}
            placeholder="예) 3,650"
            unit="kcal / kg"
          />
        </>
      )}
    </ScreenShell>
  )
}

const WALK_OPTIONS = [
  { v: '0', label: '거의 안 가요' },
  { v: '30', label: '하루 1번' },
  { v: '60', label: '하루 2번 이상' },
] as const

const INDOOR_OPTIONS = [
  { v: 'calm', label: '차분해요' },
  { v: 'moderate', label: '보통이에요' },
  { v: 'active', label: '활발해요' },
] as const

export function OptWalkScreen({
  walkMinutes,
  setWalkMinutes,
  indoorActivity,
  setIndoorActivity,
}: {
  walkMinutes: string
  setWalkMinutes: (v: string) => void
  indoorActivity: IndoorActivity
  setIndoorActivity: (v: IndoorActivity) => void
}) {
  const walksOut = walkMinutes.trim() !== '' && walkMinutes.trim() !== '0'
  return (
    <ScreenShell
      kicker="선택"
      optional
      title={
        <>
          하루 산책은
          <br />
          얼마나 하나요?
        </>
      }
      sub="활동량이 하루 필요 열량을 좌우해요"
    >
      <OptionList
        style={{ marginTop: 20 }}
        options={WALK_OPTIONS}
        value={walkMinutes as (typeof WALK_OPTIONS)[number]['v'] | ''}
        allowClear
        onChange={(v) => {
          const nv = v ?? ''
          setWalkMinutes(nv)
          // '거의 안 가요'/해제 시 숨겨질 실내 활동을 비워 stale 방지.
          if (nv === '' || nv === '0') setIndoorActivity('')
        }}
        ariaLabel="하루 산책"
      />
      {walksOut && (
        <>
          <LabelBar optional style={{ marginTop: 16 }}>
            산책 말고 집에서는 어떤가요?
          </LabelBar>
          <Segmented
            style={{ marginTop: 12 }}
            options={INDOOR_OPTIONS}
            value={indoorActivity}
            onChange={(v) => setIndoorActivity(v)}
            allowClear
            ariaLabel="집에서의 활동"
          />
        </>
      )}
    </ScreenShell>
  )
}

const VIGOROUS_OPTIONS = [
  { v: 'none', label: '안 해요' },
  { v: 'self', label: '해요 (느낌상)' },
  { v: 'objective', label: '해요 (앱·시계로 기록)' },
] as const

const HOUSING_OPTIONS = [
  { v: 'indoor', label: '실내' },
  { v: 'indoor_outdoor', label: '실내 + 마당' },
  { v: 'outdoor', label: '실외' },
] as const

export function OptExerciseScreen({
  vigorous,
  setVigorous,
  housing,
  setHousing,
  coldOutdoor,
  setColdOutdoor,
}: {
  vigorous: Vigorous
  setVigorous: (v: Vigorous) => void
  housing: Housing
  setHousing: (v: Housing) => void
  coldOutdoor: '' | 'yes' | 'no'
  setColdOutdoor: (v: '' | 'yes' | 'no') => void
}) {
  return (
    <ScreenShell
      kicker="선택"
      optional
      title={
        <>
          달리기·등산 같은
          <br />
          운동을 꾸준히 하나요?
        </>
      }
      sub="앱·시계 기록이 있으면 열량을 더 올려요"
    >
      <OptionList
        style={{ marginTop: 20 }}
        options={VIGOROUS_OPTIONS}
        value={vigorous}
        allowClear
        onChange={(v) => setVigorous((v ?? '') as Vigorous)}
        ariaLabel="격한 운동"
      />
      <LabelBar optional style={{ marginTop: 16 }}>
        주로 어디서 지내나요?
      </LabelBar>
      <Segmented
        style={{ marginTop: 12 }}
        options={HOUSING_OPTIONS}
        value={housing}
        onChange={(v) => {
          setHousing(v)
          if (v !== 'outdoor') setColdOutdoor('')
        }}
        allowClear
        ariaLabel="지내는 곳"
      />
      {housing === 'outdoor' && (
        <>
          <LabelBar style={{ marginTop: 16 }}>겨울에도 주로 밖에서 지내나요?</LabelBar>
          <Help>추위에 오래 있으면 필요 열량이 늘어요</Help>
          <Segmented
            style={{ marginTop: 10 }}
            options={[
              { v: 'yes', label: '네' },
              { v: 'no', label: '아니요' },
            ]}
            value={coldOutdoor}
            onChange={(v) => setColdOutdoor(v)}
            allowClear
            ariaLabel="겨울에도 밖에서 지내나요"
          />
        </>
      )}
    </ScreenShell>
  )
}
