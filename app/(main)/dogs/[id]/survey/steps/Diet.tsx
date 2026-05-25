// audit #96: SurveyClient.tsx 분할 — diet step. 가장 큰 step (8개 sub-section).
// 주식 / 브랜드 / 간식 / 식욕 / 산책분 / 실내활동 / 화식경험 / 만족도.
import {
  Wheat,
  CookingPot,
  Combine,
  Minus,
  Plus,
  PlusCircle,
  Flame,
  Smile,
  Meh,
  Frown,
  Pause,
  Activity,
  Heart,
  Sparkles,
  Soup,
  Check,
} from 'lucide-react'

type Taste = 'strong' | 'normal' | 'picky' | 'reduced' | ''
type IndoorActivity = 'calm' | 'moderate' | 'active' | ''
type HomeCookingExp = 'first' | 'occasional' | 'frequent' | ''
type DietSatisfaction = 1 | 2 | 3 | 4 | 5 | null

export type DietProps = {
  foodType: string
  setFoodType: (v: string) => void
  currentBrand: string
  setCurrentBrand: (v: string) => void
  snackFreq: string
  setSnackFreq: (v: string) => void
  taste: Taste
  setTaste: (v: Taste) => void
  walkMinutes: string
  setWalkMinutes: (v: string) => void
  indoorActivity: IndoorActivity
  setIndoorActivity: (v: IndoorActivity) => void
  homeCookingExp: HomeCookingExp
  setHomeCookingExp: (v: HomeCookingExp) => void
  dietSatisfaction: DietSatisfaction
  setDietSatisfaction: (v: DietSatisfaction) => void
}

export default function Diet({
  foodType,
  setFoodType,
  currentBrand,
  setCurrentBrand,
  snackFreq,
  setSnackFreq,
  taste,
  setTaste,
  walkMinutes,
  setWalkMinutes,
  indoorActivity,
  setIndoorActivity,
  homeCookingExp,
  setHomeCookingExp,
  dietSatisfaction,
  setDietSatisfaction,
}: DietProps) {
  return (
    <div className="s-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span className="s-kicker">EATING HABITS</span>
      </div>
      <h1 className="s-title">식생활을<br />알려주세요</h1>
      <p className="s-sub">현재 식이 패턴이 영양 권장량 계산의 기준이 돼요.</p>

      <div className="s-sect">
        <div className="s-sect-lbl"><span className="s-label-text">주식 형태</span></div>
        <div className="s-tilerow">
          {[
            { v: '건식 사료', label: '건식', meta: '사료/킵블', Icon: Wheat },
            { v: '습식/화식', label: '습식·화식', meta: '캔/홈쿡', Icon: CookingPot },
            { v: '반반', label: '반반', meta: '혼합', Icon: Combine },
          ].map(({ v, label, meta, Icon }) => {
            const active = foodType === v
            return (
              <button
                key={v}
                type="button"
                className={'s-tile' + (active ? ' s-on' : '')}
                aria-pressed={active}
                onClick={() => setFoodType(v)}
              >
                <span className="s-ic">
                  <Icon
                    size={20}
                    strokeWidth={1.7}
                    color={active ? 'var(--bg)' : 'var(--ink)'}
                  />
                </span>
                <span className="s-tile-lb">{label}</span>
                <span className="s-meta">{meta}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="s-sect">
        <div className="s-sect-lbl">
          <span className="s-label-text">현재 사용 중인 브랜드</span>
          <span className="s-opt">선택</span>
        </div>
        <input
          type="text"
          className="s-inp"
          value={currentBrand}
          onChange={(e) => setCurrentBrand(e.target.value)}
          placeholder="예: 로얄캐닌 미니어처닥스훈트"
        />
      </div>

      <div className="s-sect">
        <div className="s-sect-lbl"><span className="s-label-text">간식 빈도</span></div>
        <div className="s-chiprow">
          {[
            { v: '거의 안 줌', label: '거의 안 줌', Icon: Minus },
            { v: '가끔', label: '가끔', Icon: Plus },
            { v: '매일', label: '매일', Icon: PlusCircle },
          ].map(({ v, label, Icon }) => {
            const active = snackFreq === v
            return (
              <button
                key={v}
                type="button"
                className={'s-chip' + (active ? ' s-on' : '')}
                aria-pressed={active}
                onClick={() => setSnackFreq(v)}
              >
                <Icon size={13} strokeWidth={2} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="s-sect">
        <div className="s-sect-lbl"><span className="s-label-text">식욕</span></div>
        <div className="s-chiprow">
          {[
            { v: 'strong', label: '왕성', Icon: Flame },
            { v: 'normal', label: '정상', Icon: Smile },
            { v: 'picky', label: '까다로움', Icon: Meh },
            { v: 'reduced', label: '식욕 감퇴', Icon: Frown },
          ].map(({ v, label, Icon }) => {
            const active = taste === v
            return (
              <button
                key={v}
                type="button"
                className={'s-chip' + (active ? ' s-on' : '')}
                aria-pressed={active}
                onClick={() => setTaste(v as Taste)}
              >
                <Icon size={13} strokeWidth={2} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* R34c — 첫 그룹 (식사·기호 1~4) 와 활동 그룹 (5~6) 사이 시각 분리. */}
      <div className="s-sect-divider" aria-hidden />

      <div className="s-sect">
        <div className="s-sect-lbl">
          <span className="s-label-text">하루 산책 시간</span>
          <span className="s-opt">선택</span>
        </div>
        <div className="s-input-suffix">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={300}
            className="s-inp"
            value={walkMinutes}
            onChange={(e) => setWalkMinutes(e.target.value)}
            placeholder="30"
          />
          <span className="s-unit">분 / 일</span>
        </div>
      </div>

      <div className="s-sect">
        <div className="s-sect-lbl">
          <span className="s-label-text">산책 외 실내 활동</span>
          <span className="s-opt">선택</span>
        </div>
        <div className="s-chiprow">
          {[
            { v: 'calm', label: '차분', Icon: Pause },
            { v: 'moderate', label: '보통', Icon: Activity },
            { v: 'active', label: '활발', Icon: Heart },
          ].map(({ v, label, Icon }) => {
            const active = indoorActivity === v
            return (
              <button
                key={v}
                type="button"
                className={'s-chip' + (active ? ' s-on' : '')}
                aria-pressed={active}
                onClick={() => setIndoorActivity(v as IndoorActivity)}
              >
                <Icon size={13} strokeWidth={2} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* R34c — 활동 그룹 (5~6) 와 경험·평가 그룹 (7~8) 사이 시각 분리. */}
      <div className="s-sect-divider" aria-hidden />

      <div className="s-sect">
        <div className="s-sect-lbl"><span className="s-label-text">화식 경험</span></div>
        <div className="s-tilerow">
          {[
            { v: 'first', label: '처음', meta: '한 번도 안 줘봄', Icon: Sparkles },
            { v: 'occasional', label: '가끔', meta: '월 1-2회', Icon: Soup },
            { v: 'frequent', label: '자주', meta: '주 1회 이상', Icon: Check },
          ].map(({ v, label, meta, Icon }) => {
            const active = homeCookingExp === v
            return (
              <button
                key={v}
                type="button"
                className={'s-tile' + (active ? ' s-on' : '')}
                aria-pressed={active}
                onClick={() => setHomeCookingExp(v as HomeCookingExp)}
              >
                <span className="s-ic">
                  <Icon
                    size={20}
                    strokeWidth={1.7}
                    color={active ? 'var(--bg)' : 'var(--ink)'}
                  />
                </span>
                <span className="s-tile-lb">{label}</span>
                <span className="s-meta">{meta}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="s-sect">
        <div className="s-sect-lbl"><span className="s-label-text">지금 식이 만족도</span></div>
        <div className="s-rate-row">
          {([1, 2, 3, 4, 5] as const).map((s) => {
            const active = dietSatisfaction === s
            const labels = ['매우 불만', '불만', '보통', '만족', '매우 만족']
            return (
              <button
                key={s}
                type="button"
                className="s-rate"
                aria-pressed={active}
                onClick={() => setDietSatisfaction(s)}
              >
                <span className="s-rate-num">{s}</span>
                <span className="s-rate-lb">{labels[s - 1]}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
