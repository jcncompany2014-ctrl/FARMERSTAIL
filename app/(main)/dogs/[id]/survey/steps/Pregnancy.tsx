// audit #96: SurveyClient.tsx 분할 — status step 의 임신/수유 sub-section (조건부).
// 암컷 + 비중성화일 때만 임신/수유 선택 노출. puppy 경고 + 임신주차/산자수 +
// <18mo puppy 의 예상 성견 체중 (대형견 Ca cap).
import { Check, Baby, Heart, AlertCircle } from 'lucide-react'

type Pregnancy = 'none' | 'pregnant' | 'lactating' | ''

type Dog = {
  id: string
  name: string
  weight: number
  age_value: number
  age_unit: 'years' | 'months'
  neutered: boolean
  activity_level: 'low' | 'medium' | 'high'
  gender: 'male' | 'female' | null
}

export type PregnancyProps = {
  dog: Dog
  pregnancy: Pregnancy
  setPregnancy: (v: Pregnancy) => void
  pregnancyWeek: number | null
  setPregnancyWeek: (v: number | null) => void
  litterSize: number | null
  setLitterSize: (v: number | null) => void
  expectedAdultWeightKg: number | null
  setExpectedAdultWeightKg: (v: number | null) => void
}

export default function Pregnancy({
  dog,
  pregnancy,
  setPregnancy,
  pregnancyWeek,
  setPregnancyWeek,
  litterSize,
  setLitterSize,
  expectedAdultWeightKg,
  setExpectedAdultWeightKg,
}: PregnancyProps) {
  return (
    <>
      {/* 임신/수유는 암컷 + 비중성화 만 표시 (수컷/중성화견에 잘못 켜져
         MER × 2.5 폭주 차단). dog.gender 미상 (legacy) 또는 female + non-
         neutered 인 경우만 노출. */}
      {(dog.gender === 'female' || dog.gender == null) && !dog.neutered && (
        <div className="s-sect">
          <div className="s-sect-lbl">
            <span className="s-label-text">임신 / 수유 상태</span>
          </div>
          <div className="s-chiprow">
            {[
              { v: 'none', label: '해당 없음', Icon: Check },
              { v: 'pregnant', label: '임신 중', Icon: Baby },
              { v: 'lactating', label: '수유 중', Icon: Heart },
            ].map(({ v, label, Icon }) => {
              const active = pregnancy === v
              return (
                <button
                  key={v}
                  type="button"
                  className={'s-chip' + (active ? ' s-on' : '')}
                  aria-pressed={active}
                  onClick={() => {
                    // pregnancy 변경 시 week/litter conditional state stale 방지
                    const next = v as Pregnancy
                    setPregnancy(next)
                    if (next !== 'pregnant') setPregnancyWeek(null)
                    if (next !== 'lactating') setLitterSize(null)
                  }}
                >
                  <Icon size={13} strokeWidth={2} />
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* puppy + pregnancy 모순 경고 — 12개월 미만 puppy 의 임신은 매우 드묾 */}
      {pregnancy !== '' &&
        pregnancy !== 'none' &&
        (dog.age_unit === 'years'
          ? dog.age_value * 12 < 12
          : dog.age_value < 12) && (
          <div
            className="s-note"
            style={{
              background: 'color-mix(in srgb, var(--fd-gold) 14%, transparent)',
              color: 'var(--fd-pine)',
            }}
          >
            <span className="s-ic-warn" style={{ background: 'var(--fd-gold)' }}>
              <AlertCircle size={13} strokeWidth={2.2} color="#fff" />
            </span>
            <span>
              12개월 미만 강아지의 임신·수유는 매우 드물어요. 한 번 더
              확인해 주세요.
            </span>
          </div>
        )}

      {/* v1.3 — 임신 주차 (1-9). NRC 2006 ch.15 — 후기 (≥6주차) RER × 1.6-2.0 */}
      {pregnancy === 'pregnant' && (
        <div className="s-sect">
          <div className="s-sect-lbl">
            <span className="s-label-text">임신 주차</span>
            <span className="s-opt">선택</span>
          </div>
          <p className="s-sub" style={{ fontSize: 10.5, marginBottom: 8 }}>
            6주차 이후가 영양 요구량이 본격적으로 ↑. 미입력 시 보수적
            multiplier (×1.5).
          </p>
          <input
            type="number"
            inputMode="numeric"
            enterKeyHint="next"
            className="s-inp"
            aria-label="임신 주차"
            min={1}
            max={9}
            step={1}
            value={pregnancyWeek ?? ''}
            onChange={(e) => {
              const v = e.target.value
              setPregnancyWeek(v === '' ? null : Math.max(1, Math.min(9, Number(v))))
            }}
            placeholder="1-9"
          />
        </div>
      )}

      {/* v1.3 — 수유 산자수. NRC 2006 Table 15-3 — RER × (2.0+0.25n) */}
      {pregnancy === 'lactating' && (
        <div className="s-sect">
          <div className="s-sect-lbl">
            <span className="s-label-text">산자 수</span>
            <span className="s-opt">선택</span>
          </div>
          <p className="s-sub" style={{ fontSize: 10.5, marginBottom: 8 }}>
            수유 영양 요구량은 산자 수에 비례 (×2.0~4.0). 미입력 시 ×2.0.
          </p>
          <input
            type="number"
            inputMode="numeric"
            enterKeyHint="next"
            className="s-inp"
            aria-label="산자 수 (출산한 새끼 마릿수)"
            min={1}
            max={15}
            step={1}
            value={litterSize ?? ''}
            onChange={(e) => {
              const v = e.target.value
              setLitterSize(v === '' ? null : Math.max(1, Math.min(15, Number(v))))
            }}
            placeholder="1-15"
          />
        </div>
      )}

      {/* v1.3 — 대형견 puppy Ca cap. <18mo puppy 만 노출. AAFCO 2024. */}
      {(dog.age_unit === 'years'
        ? dog.age_value * 12 < 18
        : dog.age_value < 18) && (
        <div className="s-sect">
          <div className="s-sect-lbl">
            <span className="s-label-text">예상 성견 체중 (kg)</span>
            <span className="s-opt">선택</span>
          </div>
          <p className="s-sub" style={{ fontSize: 10.5, marginBottom: 8 }}>
            18개월 미만 강아지 — 25kg+ 대형견은 Ca 1.8% DM 상한
            (AAFCO 2024) 권고. 정확한 추천을 위해 입력해 주세요.
          </p>
          <input
            type="number"
            inputMode="decimal"
            enterKeyHint="done"
            className="s-inp"
            aria-label="예상 성견 체중 (kg)"
            min={0.5}
            max={100}
            step={0.5}
            value={expectedAdultWeightKg ?? ''}
            onChange={(e) => {
              const v = e.target.value
              setExpectedAdultWeightKg(
                v === ''
                  ? null
                  : Math.max(0.5, Math.min(100, Number(v))),
              )
            }}
            placeholder="예: 30 (대형견)"
          />
        </div>
      )}
    </>
  )
}
