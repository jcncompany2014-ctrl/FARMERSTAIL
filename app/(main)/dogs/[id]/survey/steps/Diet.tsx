// 설문 v4 — 식사·생활 화면들.
//   필수: FoodScreen(주식) · SnackScreen(간식, 접힘: 간식 kcal) · FreshScreen(화식 경험)
//   선택 묶음: OptFoodScreen(사료 이름·열량) · OptWalkScreen(산책, 둘째 줄: 실내 활동)
//             · OptExerciseScreen(격한 운동, 둘째 줄: 주거·한랭)
//
// 2026-09-22 시니어 사용성 3단계: 옛 meal/life 두 스텝(각 3~5문항)을 화면당 하나로.
// 식욕·식이만족도는 이미 삭제됨(2026-07-12, 계산 소비처 없음).
import { useState } from 'react'
import {
  Minus,
  Plus,
  PlusCircle,
  Pause,
  Activity,
  Heart,
} from 'lucide-react'
import { ScreenShell, OptionList, SecondLine, ChipRow } from './ScreenShell'

export type IndoorActivity = 'calm' | 'moderate' | 'active' | ''
export type HomeCookingExp = 'first' | 'occasional' | 'frequent' | ''
export type Vigorous = '' | 'none' | 'self' | 'objective'
export type Housing = '' | 'indoor' | 'indoor_outdoor' | 'outdoor'

/** 아웃라인 아이콘 타일(주식·화식 경험) — 기존 자산·mask 로직 그대로. */
function TileRow<V extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ v: V; label: string; meta: string; img: string }>
  value: V | ''
  onChange: (v: V) => void
}) {
  return (
    <div className="s-tilerow">
      {options.map(({ v, label, meta, img }) => {
        const active = value === v
        return (
          <button
            key={v}
            type="button"
            className={'s-tile' + (active ? ' s-on' : '')}
            aria-pressed={active}
            onClick={() => onChange(v)}
          >
            <span className="s-ic">
              <span
                className="s-tile-ic"
                aria-hidden
                style={{
                  WebkitMaskImage: `url(${img})`,
                  maskImage: `url(${img})`,
                  backgroundColor: active ? '#fff' : 'var(--fd-pine)',
                }}
              />
            </span>
            <span className="s-tile-lb">{label}</span>
            <span className="s-meta">{meta}</span>
          </button>
        )
      })}
    </div>
  )
}

const FOOD_OPTIONS = [
  { v: '건식 사료', label: '건식 사료', meta: '알갱이 사료', img: '/survey/icons/diet-dry.png' },
  { v: '습식/화식', label: '습식·화식', meta: '캔 · 직접 만든 밥', img: '/survey/icons/diet-wet.png' },
  { v: '반반', label: '반반', meta: '섞어서 줘요', img: '/survey/icons/diet-half.png' },
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
      sub="현재 식사가 영양 계산의 기준이 돼요."
    >
      <TileRow options={FOOD_OPTIONS} value={foodType as (typeof FOOD_OPTIONS)[number]['v'] | ''} onChange={setFoodType} />
    </ScreenShell>
  )
}

const SNACK_OPTIONS = [
  { v: '거의 안 줌', label: '거의 안 줘요', Icon: Minus },
  { v: '가끔', label: '가끔 줘요', Icon: Plus },
  { v: '매일', label: '매일 줘요', Icon: PlusCircle },
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
  const [kcalOpen, setKcalOpen] = useState(treatKcal !== '')
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
      sub="간식 열량은 하루 급여량에서 미리 빼 두어요."
    >
      <OptionList
        options={SNACK_OPTIONS}
        value={snackFreq as (typeof SNACK_OPTIONS)[number]['v'] | ''}
        onChange={(v) => setSnackFreq(v ?? '')}
        ariaLabel="간식 빈도"
      />
      {givesSnack &&
        (!kcalOpen ? (
          <button type="button" className="s-skipbtn" onClick={() => setKcalOpen(true)}>
            <Plus size={16} strokeWidth={2} aria-hidden />
            하루 간식 칼로리를 아신다면 알려주기 (선택)
          </button>
        ) : (
          <SecondLine
            label="하루 간식 칼로리"
            hint="간식 포장 뒷면에 있어요. 모르면 비워 두셔도 돼요 — 평균으로 계산해요."
          >
            <div className="s-input-suffix">
              <input
                type="number"
                onWheel={(e) => e.currentTarget.blur()}
                inputMode="numeric"
                min={0}
                max={2000}
                className="s-inp"
                aria-label="하루 간식 칼로리 (kcal)"
                value={treatKcal}
                onChange={(e) => setTreatKcal(e.target.value)}
                placeholder="예: 50"
              />
              <span className="s-unit">kcal / 하루</span>
            </div>
          </SecondLine>
        ))}
    </ScreenShell>
  )
}

const FRESH_OPTIONS = [
  { v: 'first', label: '처음이에요', meta: '한 번도 안 줘봤어요', img: '/survey/icons/fresh-first.png' },
  { v: 'occasional', label: '가끔', meta: '한 달에 1~2번', img: '/survey/icons/fresh-sometimes.png' },
  { v: 'frequent', label: '자주', meta: '일주일에 1번 이상', img: '/survey/icons/fresh-often.png' },
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
          직접 만든 밥(화식)을
          <br />
          준 적이 있나요?
        </>
      }
      sub="처음이면 첫 박스를 더 부드럽게 시작해요."
    >
      <TileRow
        options={FRESH_OPTIONS}
        value={homeCookingExp}
        onChange={(v) => setHomeCookingExp(v)}
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
      kicker="추가 질문"
      optional
      title={
        <>
          지금 먹는 사료 이름을
          <br />
          알려주세요
        </>
      }
      sub="예: 로얄캐닌 미니 어덜트. 몰라도 괜찮아요."
    >
      <input
        type="text"
        className="s-inp"
        aria-label="현재 사용 중인 사료 이름"
        value={currentBrand}
        onChange={(e) => setCurrentBrand(e.target.value)}
        placeholder="사료 이름"
      />
      {kibble && (
        <SecondLine
          label="사료 봉투 뒷면의 열량"
          hint="‘대사에너지’ 또는 ‘kcal/kg’ 옆 숫자예요. 모르면 비워 두세요 — 평균값으로 계산해요."
        >
          <div className="s-input-suffix">
            <input
              type="number"
              onWheel={(e) => e.currentTarget.blur()}
              inputMode="numeric"
              min={2000}
              max={6000}
              className="s-inp"
              aria-label="건사료 열량 (kcal/kg)"
              value={kibbleKcal}
              onChange={(e) => setKibbleKcal(e.target.value)}
              placeholder="예: 3500"
            />
            <span className="s-unit">kcal / kg</span>
          </div>
        </SecondLine>
      )}
    </ScreenShell>
  )
}

const WALK_OPTIONS = [
  { v: '0', label: '거의 안 가요' },
  { v: '30', label: '하루 1번' },
  { v: '60', label: '하루 2번 이상' },
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
      kicker="추가 질문"
      optional
      title={
        <>
          하루 산책은
          <br />
          얼마나 하나요?
        </>
      }
      sub="활동량이 하루 필요 열량을 좌우해요."
    >
      <OptionList
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
        <SecondLine label="산책 외 실내 활동은 어떤가요?">
          <ChipRow
            options={[
              { v: 'calm', label: '차분해요', Icon: Pause },
              { v: 'moderate', label: '보통이에요', Icon: Activity },
              { v: 'active', label: '활발해요', Icon: Heart },
            ]}
            value={indoorActivity}
            onChange={(v) => setIndoorActivity(v)}
          />
        </SecondLine>
      )}
    </ScreenShell>
  )
}

const VIGOROUS_OPTIONS = [
  { v: 'none', label: '안 해요' },
  { v: 'self', label: '해요 (느낌상)' },
  { v: 'objective', label: '해요 (앱·시계로 기록)' },
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
      kicker="추가 질문"
      optional
      title={
        <>
          달리기·등산처럼
          <br />
          격한 운동을 규칙적으로 하나요?
        </>
      }
      sub="기록으로 확인되는 운동만 열량을 더 크게 올려요 — 느낌상은 살짝만."
    >
      <OptionList
        options={VIGOROUS_OPTIONS}
        value={vigorous}
        allowClear
        onChange={(v) => setVigorous((v ?? '') as Vigorous)}
        ariaLabel="격한 운동"
      />
      <SecondLine label="주로 어디서 지내나요?">
        <ChipRow
          options={[
            { v: 'indoor', label: '실내' },
            { v: 'indoor_outdoor', label: '실내 + 마당' },
            { v: 'outdoor', label: '실외' },
          ]}
          value={housing}
          onChange={(v) => {
            setHousing(v)
            if (v !== 'outdoor') setColdOutdoor('')
          }}
        />
        {housing === 'outdoor' && (
          <>
            <p className="s-qhint" style={{ marginTop: 12 }}>
              겨울에도 주로 밖에서 지내나요? 추위에 노출되면 필요 열량이 늘어요.
            </p>
            <ChipRow
              options={[
                { v: 'yes', label: '네' },
                { v: 'no', label: '아니요' },
              ]}
              value={coldOutdoor}
              onChange={(v) => setColdOutdoor(v)}
            />
          </>
        )}
      </SecondLine>
    </ScreenShell>
  )
}
