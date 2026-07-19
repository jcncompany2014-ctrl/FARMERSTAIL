// audit #96: SurveyClient.tsx 분할 — diet step.
// 주식 / 브랜드 / 간식 / 산책(리드) / 활동(조건부) / 화식경험.
// 정돈(2026-07-12): 식욕·식이만족도 질문 삭제(칼로리·라인 경성 소비처 없음).
import {
  Wheat,
  CookingPot,
  Combine,
  Minus,
  Plus,
  PlusCircle,
  Pause,
  Activity,
  Heart,
  Sparkles,
  Soup,
  Check,
} from 'lucide-react'

type IndoorActivity = 'calm' | 'moderate' | 'active' | ''
type HomeCookingExp = 'first' | 'occasional' | 'frequent' | ''

export type DietProps = {
  /** 식사(meal) / 생활(life) 2스텝 분리 — 정돈 P2(2026-07-12). */
  part: 'meal' | 'life'
  foodType: string
  setFoodType: (v: string) => void
  currentBrand: string
  setCurrentBrand: (v: string) => void
  snackFreq: string
  setSnackFreq: (v: string) => void
  /** 칼로리 v2 2d — 하루 간식 kcal (선택, 아는 경우만). '' = 모름 → 빈도 추정. */
  treatKcal: string
  setTreatKcal: (v: string) => void
  /** 칼로리 v2 5단계 — 건사료 라벨 열량 kcal/kg (선택). '' = 모름 → 평균 350/100g. */
  kibbleKcal: string
  setKibbleKcal: (v: string) => void
  walkMinutes: string
  setWalkMinutes: (v: string) => void
  indoorActivity: IndoorActivity
  setIndoorActivity: (v: IndoorActivity) => void
  // ── 칼로리 v2 2b — 활동 증거 게이트 · 주거 환경 ──
  vigorous: '' | 'none' | 'self' | 'objective'
  setVigorous: (v: '' | 'none' | 'self' | 'objective') => void
  housing: '' | 'indoor' | 'indoor_outdoor' | 'outdoor'
  setHousing: (v: '' | 'indoor' | 'indoor_outdoor' | 'outdoor') => void
  coldOutdoor: '' | 'yes' | 'no'
  setColdOutdoor: (v: '' | 'yes' | 'no') => void
  homeCookingExp: HomeCookingExp
  setHomeCookingExp: (v: HomeCookingExp) => void
}

export default function Diet({
  part,
  foodType,
  setFoodType,
  currentBrand,
  setCurrentBrand,
  snackFreq,
  setSnackFreq,
  treatKcal,
  setTreatKcal,
  kibbleKcal,
  setKibbleKcal,
  walkMinutes,
  setWalkMinutes,
  indoorActivity,
  setIndoorActivity,
  vigorous,
  setVigorous,
  housing,
  setHousing,
  coldOutdoor,
  setColdOutdoor,
  homeCookingExp,
  setHomeCookingExp,
}: DietProps) {
  // progressive disclosure — 산책을 나가는 경우에만 활동 상세(실내 활동·격한
  // 운동)를 펼친다. '거의 안 가요'(walkMinutes '0')면 후속 질문 없이 끝.
  const walksOut = walkMinutes.trim() !== '' && walkMinutes.trim() !== '0'
  return (
    <div className="s-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span className="s-kicker">
          {part === 'meal' ? 'EATING HABITS' : 'DAILY LIFE'}
        </span>
      </div>
      {part === 'meal' ? (
        <>
          <h1 className="s-title">식사를<br />알려주세요</h1>
          <p className="s-sub">현재 식이 패턴이 영양 권장량 계산의 기준이 돼요.</p>
        </>
      ) : (
        <>
          <h1 className="s-title">생활 패턴을<br />알려주세요</h1>
          <p className="s-sub">활동량과 환경이 하루 필요 열량을 좌우해요.</p>
        </>
      )}

      {part === 'meal' && (
      <>
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
                    color={active ? 'var(--bg)' : 'var(--fd-pine)'}
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
          aria-label="현재 사용 중인 사료 브랜드"
          value={currentBrand}
          onChange={(e) => setCurrentBrand(e.target.value)}
          placeholder="예: 로얄캐닌 미니어처닥스훈트"
        />
        {/* 칼로리 v2 5단계(M9b) — 건사료 라벨 kcal. 건식/반반 주식일 때만.
            입력 시 mix 급여의 건사료 g 이 정확해지고(미입력=평균 350kcal/100g),
            브랜드만 있고 kcal 모르면 kibble_requests 자가성장 로그 대상. */}
        {(foodType === '건식 사료' || foodType === '반반') && (
          <>
            <p className="s-sub" style={{ fontSize: 13, margin: '10px 0 8px' }}>
              사료 봉투 뒷면의 열량(대사에너지 ME) 표기를 아신다면 적어 주세요.
              모르면 비워두셔도 돼요 — 평균값으로 계산해요.
            </p>
            <div className="s-input-suffix">
              <input
                type="number"
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
          </>
        )}
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
        {/* 칼로리 v2 2d — 간식 kcal 숫자(선택). 아는 만큼 정확히 차감(10% 캡),
            초과분은 경고로 식별(헤비유저). 모름 = 빈도 기반 추정(가끔5%/매일10%). */}
        {(snackFreq === '가끔' || snackFreq === '매일') && (
          <>
            <p className="s-sub" style={{ fontSize: 13, margin: '10px 0 8px' }}>
              하루 간식 칼로리를 아신다면 적어 주세요. 포장 뒷면에 있어요 —
              모르면 비워두셔도 돼요.
            </p>
            <div className="s-input-suffix">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={2000}
                className="s-inp"
                aria-label="하루 간식 칼로리 (kcal)"
                value={treatKcal}
                onChange={(e) => setTreatKcal(e.target.value)}
                placeholder="예: 50"
              />
              <span className="s-unit">kcal / 일</span>
            </div>
          </>
        )}
      </div>
      </>
      )}

      {part === 'life' && (
      <>
      <div className="s-sect">
        <div className="s-sect-lbl">
          <span className="s-label-text">하루 산책, 얼마나 나가요?</span>
        </div>
        <div className="s-chiprow">
          {[
            { v: '0', label: '거의 안 가요' },
            { v: '30', label: '하루 1번' },
            { v: '60', label: '하루 2번 이상' },
          ].map(({ v, label }) => {
            const active = walkMinutes === v
            return (
              <button
                key={v}
                type="button"
                className={'s-chip' + (active ? ' s-on' : '')}
                aria-pressed={active}
                onClick={() => {
                  const nv = active ? '' : v
                  setWalkMinutes(nv)
                  // '거의 안 가요'/해제 시 숨겨질 활동 상세를 비워 stale 방지.
                  if (nv === '' || nv === '0') {
                    setIndoorActivity('')
                    setVigorous('')
                  }
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {walksOut && (
      <>
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

      {/* 칼로리 v2 2b — 격한 운동 + 증거 수준. '기록·측정'만 +0.2 가산 게이트
          통과(자가 신고는 +0.1 상한) — 자가보고 활동은 과대추정 경향. */}
      <div className="s-sect">
        <div className="s-sect-lbl">
          <span className="s-label-text">격한 운동을 규칙적으로 하나요?</span>
          <span className="s-opt">선택</span>
        </div>
        <p className="s-sub" style={{ fontSize: 13, marginBottom: 8 }}>
          달리기·등산·어질리티 등. 앱이나 웨어러블로 기록하면 &lsquo;기록·측정&rsquo;을
          골라 주세요.
        </p>
        <div className="s-chiprow">
          {[
            { v: 'none', label: '안 해요' },
            { v: 'self', label: '해요 (느낌상)' },
            { v: 'objective', label: '해요 (기록·측정)' },
          ].map(({ v, label }) => {
            const active = vigorous === v
            return (
              <button
                key={v}
                type="button"
                className={'s-chip' + (active ? ' s-on' : '')}
                aria-pressed={active}
                onClick={() =>
                  setVigorous(active ? '' : (v as 'none' | 'self' | 'objective'))
                }
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      </>
      )}

      {/* 칼로리 v2 2b — 주거 환경. 실외 + 한랭일 때만 +0.15 가산. */}
      <div className="s-sect">
        <div className="s-sect-lbl">
          <span className="s-label-text">주로 어디서 지내요?</span>
          <span className="s-opt">선택</span>
        </div>
        <div className="s-chiprow">
          {[
            { v: 'indoor', label: '실내' },
            { v: 'indoor_outdoor', label: '실내+마당' },
            { v: 'outdoor', label: '실외' },
          ].map(({ v, label }) => {
            const active = housing === v
            return (
              <button
                key={v}
                type="button"
                className={'s-chip' + (active ? ' s-on' : '')}
                aria-pressed={active}
                onClick={() =>
                  setHousing(
                    active
                      ? ''
                      : (v as 'indoor' | 'indoor_outdoor' | 'outdoor'),
                  )
                }
              >
                {label}
              </button>
            )
          })}
        </div>
        {housing === 'outdoor' && (
          <>
            <p className="s-sub" style={{ fontSize: 13, margin: '10px 0 8px' }}>
              겨울에도 주로 밖에서 지내요? (추위에 노출되면 필요 열량이 늘어요)
            </p>
            <div className="s-chiprow">
              {[
                { v: 'yes', label: '네' },
                { v: 'no', label: '아니요' },
              ].map(({ v, label }) => {
                const active = coldOutdoor === v
                return (
                  <button
                    key={v}
                    type="button"
                    className={'s-chip' + (active ? ' s-on' : '')}
                    aria-pressed={active}
                    onClick={() =>
                      setColdOutdoor(active ? '' : (v as 'yes' | 'no'))
                    }
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
      </>
      )}

      {part === 'meal' && (
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
                    color={active ? 'var(--bg)' : 'var(--fd-pine)'}
                  />
                </span>
                <span className="s-tile-lb">{label}</span>
                <span className="s-meta">{meta}</span>
              </button>
            )
          })}
        </div>
      </div>
      )}
    </div>
  )
}
