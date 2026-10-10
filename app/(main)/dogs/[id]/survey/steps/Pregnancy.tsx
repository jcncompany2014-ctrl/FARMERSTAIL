// 설문 v4 — 조건부 화면.
//   PregnancyScreen  : 암컷 + 비중성화만 (수컷/중성화견에 켜져 MER ×2.5 폭주 차단).
//                      임신 주차 / 산자 수는 둘째 줄(선택).
//   (AdultWeightScreen '다 자라면 몇 kg' 는 2026-10-01 제거 — 보호자가 알 수 없는 답이 자견 칼로리
//    전체를 좌우했다. 나이·체중 성장곡선으로 추정: lib/growth-curve.ts)
//
// 2026-10-09 앱 새 디자인('A 포스터', 시안 E11 · F29 · F30 · F31): 해당 없음/임신/수유 = 선택 막대, 아래 펼침
// (주차·마릿수 칸)은 카드 안. 어린 강아지 안내가 뜨면(F31) 칸이 카드에 들어가게 주차 도움말은 뺀다.
// 숫자 범위(주차 1~9 · 마릿수 1~15)·저장은 그대로.
import { ScreenShell, Segmented, LabelBar, Help, Field } from './ScreenShell'

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

const PREGNANCY_OPTIONS = [
  { v: 'none', label: '해당 없음' },
  { v: 'pregnant', label: '임신 중' },
  { v: 'lactating', label: '수유 중' },
] as const

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
  const puppyNote = pregnancy !== '' && pregnancy !== 'none' && isPuppy
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
      sub="임신·수유 중이면 필요한 열량이 크게 달라져요"
    >
      <Segmented
        style={{ marginTop: 24 }}
        options={PREGNANCY_OPTIONS}
        value={pregnancy}
        onChange={(v) => {
          const next = v as PregnancyValue
          setPregnancy(next)
          if (next !== 'pregnant') setPregnancyWeek(null)
          if (next !== 'lactating') setLitterSize(null)
        }}
        ariaLabel="임신 / 수유"
      />

      {puppyNote && (
        <div className="s-warnbox" role="status" style={{ marginTop: 14 }}>
          <span className="s-warnbox-body">
            12개월이 안 된 강아지의 임신·수유는 매우 드물어요. 한 번 더 확인해 주세요.
          </span>
        </div>
      )}

      {pregnancy === 'pregnant' && (
        <>
          <LabelBar optional style={{ marginTop: puppyNote ? 18 : 24 }}>
            임신 몇 주차인가요?
          </LabelBar>
          {!puppyNote && <Help>6주차 이후 필요 열량이 본격적으로 늘어요. 모르면 비워 두세요.</Help>}
          <Field
            style={{ marginTop: 12 }}
            type="number"
            min={1}
            max={9}
            step={1}
            ariaLabel="임신 주차"
            value={pregnancyWeek === null ? '' : String(pregnancyWeek)}
            onChange={(v) => setPregnancyWeek(v === '' ? null : Math.max(1, Math.min(9, Number(v))))}
            placeholder="예) 5"
            unit="주차"
          />
        </>
      )}

      {pregnancy === 'lactating' && (
        <>
          <LabelBar optional style={{ marginTop: puppyNote ? 18 : 24 }}>
            새끼가 몇 마리인가요?
          </LabelBar>
          {!puppyNote && <Help>새끼 수에 따라 필요 열량이 달라져요. 모르면 비워 두세요.</Help>}
          <Field
            style={{ marginTop: 12 }}
            type="number"
            min={1}
            max={15}
            step={1}
            ariaLabel="산자 수 (출산한 새끼 마릿수)"
            value={litterSize === null ? '' : String(litterSize)}
            onChange={(v) => setLitterSize(v === '' ? null : Math.max(1, Math.min(15, Number(v))))}
            placeholder="예) 4"
            unit="마리"
          />
        </>
      )}
    </ScreenShell>
  )
}
