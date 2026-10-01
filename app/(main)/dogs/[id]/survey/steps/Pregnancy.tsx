// 설문 v4 — 조건부 화면.
//   PregnancyScreen  : 암컷 + 비중성화만 (수컷/중성화견에 켜져 MER ×2.5 폭주 차단).
//                      임신 주차 / 산자 수는 둘째 줄(선택).
//   (AdultWeightScreen '다 자라면 몇 kg' 는 2026-10-01 제거 — 보호자가 알 수 없는 답이 자견 칼로리
//    전체를 좌우했다. 나이·체중 성장곡선으로 추정: lib/growth-curve.ts)
import { Check, Baby, Heart, AlertCircle } from 'lucide-react'
import { ScreenShell, OptionList, SecondLine } from './ScreenShell'

export type PregnancyValue = 'none' | 'pregnant' | 'lactating' | ''

export type SurveyDog = {
  id: string
  name: string
  weight: number
  age_value: number
  age_unit: 'years' | 'months'
  neutered: boolean
  activity_level: 'low' | 'medium' | 'high'
  gender: 'male' | 'female' | null
  /** 생일(YYYY-MM-DD) — 자견 성장곡선 주령. 없으면 월령 근사. */
  birth_date?: string | null
}

function ageMonths(dog: SurveyDog): number {
  return dog.age_unit === 'years' ? dog.age_value * 12 : dog.age_value
}

export function PregnancyScreen({
  dog,
  pregnancy,
  setPregnancy,
  pregnancyWeek,
  setPregnancyWeek,
  litterSize,
  setLitterSize,
}: {
  dog: SurveyDog
  pregnancy: PregnancyValue
  setPregnancy: (v: PregnancyValue) => void
  pregnancyWeek: number | null
  setPregnancyWeek: (v: number | null) => void
  litterSize: number | null
  setLitterSize: (v: number | null) => void
}) {
  const isPuppy = ageMonths(dog) < 12
  return (
    <ScreenShell
      kicker="건강"
      title={
        <>
          지금 임신 중이거나
          <br />
          수유 중인가요?
        </>
      }
      sub="임신·수유 중이면 필요한 열량이 크게 달라져요."
    >
      <OptionList
        options={[
          { v: 'none', label: '해당 없음', Icon: Check },
          { v: 'pregnant', label: '임신 중', Icon: Baby },
          { v: 'lactating', label: '수유 중', Icon: Heart },
        ]}
        value={pregnancy}
        onChange={(v) => {
          const next = (v ?? '') as PregnancyValue
          setPregnancy(next)
          if (next !== 'pregnant') setPregnancyWeek(null)
          if (next !== 'lactating') setLitterSize(null)
        }}
        ariaLabel="임신 / 수유"
      />

      {pregnancy !== '' && pregnancy !== 'none' && isPuppy && (
        <div
          className="s-note"
          style={{
            background: 'color-mix(in srgb, var(--fd-gold) 14%, transparent)',
            color: 'var(--fd-pine)',
          }}
        >
          <span className="s-ic-warn" style={{ background: 'var(--fd-gold)' }}>
            <AlertCircle size={14} strokeWidth={2.2} color="#7A5B1B" />
          </span>
          <span>12개월 미만 강아지의 임신·수유는 매우 드물어요. 한 번 더 확인해 주세요.</span>
        </div>
      )}

      {pregnancy === 'pregnant' && (
        <SecondLine
          label="임신 몇 주차인가요?"
          hint="6주차 이후 필요 열량이 본격적으로 늘어요. 모르면 비워 두세요."
        >
          <div className="s-input-suffix">
            <input
              type="number"
              onWheel={(e) => e.currentTarget.blur()}
              inputMode="numeric"
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
              placeholder="1~9"
            />
            <span className="s-unit">주차</span>
          </div>
        </SecondLine>
      )}

      {pregnancy === 'lactating' && (
        <SecondLine
          label="새끼가 몇 마리인가요?"
          hint="새끼 수에 따라 필요 열량이 달라져요. 모르면 비워 두세요."
        >
          <div className="s-input-suffix">
            <input
              type="number"
              onWheel={(e) => e.currentTarget.blur()}
              inputMode="numeric"
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
              placeholder="1~15"
            />
            <span className="s-unit">마리</span>
          </div>
        </SecondLine>
      )}
    </ScreenShell>
  )
}
