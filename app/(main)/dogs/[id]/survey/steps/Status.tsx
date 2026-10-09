// 설문 v4 — 건강 화면들.
//   필수: ChronicScreen — 진단 질환 있나요? (없어요/있어요 → 질환 칩 → 조건부 신장 단계·
//         췌장염 상태 → 처방식 이름)
//   선택 묶음: OptMedsScreen — 복용 약·보충제 (약 키워드 → 질환 자동 제안)
//
// 파일명은 옛 명세 그대로 Status.tsx. 2026-09-22 시니어 사용성 3단계: 약은 선택
// 묶음으로 분리(사장님 결정 — 선택 4 = 현재 사료·실내 활동·격한 운동·약).
// "CKD IRIS" 같은 전문용어는 화면에서 뺐다(브랜드 보이스).
//
// 2026-10-09 앱 새 디자인('A 포스터', 시안 E10 · F23 · F24 · E17 · F28): 유무·단계·상태 = 선택 막대(펼침은 카드 안
// 스크롤), 질환 = 칩. 문구(앱시안 결정 3번): '처방식' 금지 → "병원에서 권한 사료", 타사 제품명 예시 삭제,
// "주치 수의사와 상담" → "다니는 병원과 먼저 상의". 답 키·값(irisStage 1~4 · moderate/severe)·저장은 그대로.
import {
  CHRONIC_CONDITION_LABELS,
  type ChronicConditionKey,
} from '@/lib/nutrition/guidelines'
import { detectChronicFromMedications } from '@/lib/nutrition/drugs'
import { ScreenShell, Segmented, LabelBar, Help, Chips, Note, Field } from './ScreenShell'

export type IrisStage = 1 | 2 | 3 | 4 | null
export type PancreatitisSeverity = 'moderate' | 'severe' | null
export type HasChronic = '' | 'yes' | 'no'

/**
 * 질환 칩 라벨 — 정본(CHRONIC_CONDITION_LABELS)의 영어 약어 괄호는 뺀다:
 * "염증성 장질환 (IBD)" → "염증성 장질환". 수의사용 리포트에는 약어가 유용하지만
 * 설문을 채우는 보호자(부모님 세대)에겐 "못 읽는 것"이 된다(2026-09-22).
 */
export function plainConditionLabel(label: string): string {
  return label.replace(/\s*\([A-Za-z'’\s]+\)\s*$/, '').trim()
}

function toggleArr<T>(arr: T[], v: T, setter: (x: T[]) => void) {
  if (arr.includes(v)) setter(arr.filter((x) => x !== v))
  else setter([...arr, v])
}

const HAS_OPTIONS = [
  { v: 'no', label: '없어요' },
  { v: 'yes', label: '있어요' },
] as const

const IRIS_OPTIONS = [
  { v: '1', label: '1단계' },
  { v: '2', label: '2단계' },
  { v: '3', label: '3단계' },
  { v: '4', label: '4단계' },
] as const

const PANCREATITIS_OPTIONS = [
  { v: 'moderate', label: '만성 · 관리 중' },
  { v: 'severe', label: '급성 · 중증' },
] as const

export function ChronicScreen({
  hasChronic,
  setHasChronic,
  chronicConditions,
  setChronicConditions,
  irisStage,
  setIrisStage,
  pancreatitisSeverity,
  setPancreatitisSeverity,
  prescriptionDiet,
  setPrescriptionDiet,
}: {
  hasChronic: HasChronic
  setHasChronic: (v: HasChronic) => void
  chronicConditions: ChronicConditionKey[]
  setChronicConditions: (v: ChronicConditionKey[]) => void
  irisStage: IrisStage
  setIrisStage: (v: IrisStage) => void
  pancreatitisSeverity: PancreatitisSeverity
  setPancreatitisSeverity: (v: PancreatitisSeverity) => void
  prescriptionDiet: string
  setPrescriptionDiet: (v: string) => void
}) {
  const keys = Object.keys(CHRONIC_CONDITION_LABELS) as ChronicConditionKey[]
  return (
    <ScreenShell
      kicker="건강"
      title={
        <>
          동물병원에서 진단받은
          <br />
          질환이 있나요?
        </>
      }
      sub="식이 관리가 중요한 질환은 분석에 꼭 반영돼요"
    >
      <Segmented
        style={{ marginTop: 24 }}
        options={HAS_OPTIONS}
        value={hasChronic}
        onChange={(v) => {
          if (v === 'no') {
            setHasChronic('no')
            setChronicConditions([])
            setIrisStage(null)
            setPancreatitisSeverity(null)
            setPrescriptionDiet('')
          } else if (v === 'yes') {
            setHasChronic('yes')
          }
        }}
        ariaLabel="진단받은 질환"
      />

      {hasChronic === 'yes' && (
        <>
          <LabelBar style={{ marginTop: 16 }}>해당하는 질환을 모두 골라 주세요</LabelBar>
          <Chips
            style={{ marginTop: 12 }}
            options={keys.map((k) => ({ v: k, label: plainConditionLabel(CHRONIC_CONDITION_LABELS[k]) }))}
            isOn={(v) => chronicConditions.includes(v as ChronicConditionKey)}
            onToggle={(v) => {
              const k = v as ChronicConditionKey
              const active = chronicConditions.includes(k)
              // 토글 off 시 하위 단계 입력 reset (stale 방지)
              if (k === 'kidney' && active) setIrisStage(null)
              if (k === 'pancreatitis' && active) setPancreatitisSeverity(null)
              toggleArr(chronicConditions, k, setChronicConditions)
            }}
            ariaLabel="질환"
          />

          {/* CKD → IRIS 단계. Stage 1-2 단백질 정상, 3+ 제한. 미입력 = 보수적(3+). */}
          {chronicConditions.includes('kidney') && (
            <>
              <LabelBar optional style={{ marginTop: 24 }}>
                신장질환은 몇 단계인가요?
              </LabelBar>
              <Help>
                병원에서 알려준 단계예요(1 = 초기, 4 = 말기). 모르면 비워 두세요 — 안전하게 단백질을 줄여
                계산해요.
              </Help>
              <Segmented
                style={{ marginTop: 10 }}
                options={IRIS_OPTIONS}
                value={irisStage === null ? '' : (String(irisStage) as '1' | '2' | '3' | '4')}
                onChange={(v) => setIrisStage(v === '' ? null : (Number(v) as 1 | 2 | 3 | 4))}
                allowClear
                ariaLabel="신장질환 단계"
              />
            </>
          )}

          {/* 췌장염 — 급성/중증은 화식 부적합 하드 게이트(firstBox). 미입력 = 만성. */}
          {chronicConditions.includes('pancreatitis') && (
            <>
              <LabelBar optional style={{ marginTop: 24 }}>
                췌장염은 어떤 상태인가요?
              </LabelBar>
              <Help>
                급성·중증(입원했거나 병원에서 저지방 사료를 권한 경우)은 화식으로 관리하기 어려워 따로
                안내해요. 모르면 비워 두세요.
              </Help>
              <Segmented
                style={{ marginTop: 10 }}
                options={PANCREATITIS_OPTIONS}
                value={pancreatitisSeverity ?? ''}
                onChange={(v) => setPancreatitisSeverity(v === '' ? null : v)}
                allowClear
                ariaLabel="췌장염 상태"
              />
            </>
          )}

          {/* 저장 칸은 그대로 dogs.prescription_diet — 화면 말만 '병원에서 권한 사료'(금지어 '처방식'). */}
          <LabelBar optional style={{ marginTop: 24 }}>
            병원에서 권한 사료를 먹고 있다면 이름
          </LabelBar>
          <Field
            style={{ marginTop: 10 }}
            ariaLabel="병원에서 권한 사료 이름"
            value={prescriptionDiet}
            onChange={setPrescriptionDiet}
            placeholder="사료 이름"
          />

          {chronicConditions.length > 0 && (
            <Note>
              분석 결과는 <strong>영양 기준에 따른 권장</strong>이에요. 사료·약을 바꿀 땐 꼭 다니는 병원과
              먼저 상의해 주세요.
            </Note>
          )}
        </>
      )}
    </ScreenShell>
  )
}

export function OptMedsScreen({
  medications,
  setMedications,
  chronicConditions,
  onAddCondition,
}: {
  medications: string
  setMedications: (v: string) => void
  chronicConditions: ChronicConditionKey[]
  /** 약 키워드에서 제안된 질환 추가 — 질환 화면이 '없어요'였다면 '있어요'로 바뀌어야 한다(SurveyClient 가 처리). */
  onAddCondition: (k: ChronicConditionKey) => void
}) {
  const matches = detectChronicFromMedications(medications).filter(
    (m) => !chronicConditions.includes(m.condition),
  )
  return (
    <ScreenShell
      kicker="선택"
      optional
      title={
        <>
          복용 중인 약이나
          <br />
          보충제가 있나요?
        </>
      }
      sub="쉼표로 나눠 적어 주세요. 없으면 건너뛰어도 돼요"
    >
      {/* 질환 제안 상자가 뜨면 칸을 낮춘다(시안 E17 120 → F28 96 — 둘이 카드에 같이 들어가게). */}
      <Field
        multiline
        height={matches.length > 0 ? 96 : 120}
        style={{ marginTop: 20 }}
        ariaLabel="복용 중인 약 / 보충제"
        value={medications}
        onChange={setMedications}
        placeholder="예) 갑상선 호르몬, 글루코사민, 오메가-3"
      />
      {matches.length > 0 && (
        <div className="s-suggest">
          <span className="s-suggest-text">
            적어 주신 약으로 보면 아래 질환이 있을 수 있어요. 해당하면 눌러서 추가해 주세요.
          </span>
          <span className="s-chips">
            {matches.map((m) => (
              <button
                key={m.condition}
                type="button"
                className="s-chip-add"
                onClick={() => onAddCondition(m.condition)}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {m.label}
              </button>
            ))}
          </span>
        </div>
      )}
    </ScreenShell>
  )
}
