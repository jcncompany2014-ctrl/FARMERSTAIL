// 설문 v4 — 조건부 화면 2개.
//   PregnancyScreen  : 암컷 + 비중성화만 (수컷/중성화견에 켜져 MER ×2.5 폭주 차단).
//                      임신 주차 / 산자 수는 둘째 줄(선택).
//   AdultWeightScreen: 18개월 미만 자견만 — 예상 성견 체중 (대형견 Ca 상한, 건너뛰기 가능).
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

export function AdultWeightScreen({
  expectedAdultWeightKg,
  setExpectedAdultWeightKg,
}: {
  expectedAdultWeightKg: number | null
  setExpectedAdultWeightKg: (v: number | null) => void
}) {
  return (
    <ScreenShell
      kicker="몸 상태"
      optional
      title={
        <>
          다 자라면
          <br />
          몇 kg쯤 될까요?
        </>
      }
      sub="어린 강아지는 다 컸을 때 체중으로 뼈에 필요한 칼슘 양을 정해요. 모르면 건너뛰어도 돼요."
    >
      <div className="s-input-suffix">
        <input
          type="number"
          onWheel={(e) => e.currentTarget.blur()}
          inputMode="decimal"
          className="s-inp"
          aria-label="예상 성견 체중 (kg)"
          min={0.5}
          max={100}
          step={0.5}
          value={expectedAdultWeightKg ?? ''}
          onChange={(e) => {
            const v = e.target.value
            setExpectedAdultWeightKg(
              v === '' ? null : Math.max(0.5, Math.min(100, Number(v))),
            )
          }}
          placeholder="예: 30"
        />
        <span className="s-unit">kg</span>
      </div>
    </ScreenShell>
  )
}
