// 설문 v4 — 건강 화면들.
//   필수: ChronicScreen — 진단 질환 있나요? (없어요/있어요 → 질환 칩 → 조건부 신장 단계·
//         췌장염 상태 → 처방식 이름)
//   선택 묶음: OptMedsScreen — 복용 약·보충제 (약 키워드 → 질환 자동 제안)
//
// 파일명은 옛 명세 그대로 Status.tsx. 2026-09-22 시니어 사용성 3단계: 약은 선택
// 묶음으로 분리(사장님 결정 — 선택 4 = 현재 사료·실내 활동·격한 운동·약).
// "CKD IRIS" 같은 전문용어는 화면에서 뺐다(브랜드 보이스).
import { Check, ShieldAlert } from 'lucide-react'
import {
  CHRONIC_CONDITION_LABELS,
  type ChronicConditionKey,
} from '@/lib/nutrition/guidelines'
import { detectChronicFromMedications } from '@/lib/nutrition/drugs'
import { ScreenShell, SecondLine, ChipRow } from './ScreenShell'

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
      sub="식이 관리가 중요한 질환은 분석에 꼭 반영돼요."
    >
      <div className="s-seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button
          type="button"
          aria-pressed={hasChronic === 'no'}
          onClick={() => {
            setHasChronic('no')
            setChronicConditions([])
            setIrisStage(null)
            setPancreatitisSeverity(null)
            setPrescriptionDiet('')
          }}
        >
          <Check size={18} strokeWidth={2} />
          없어요
        </button>
        <button
          type="button"
          className="s-danger"
          aria-pressed={hasChronic === 'yes'}
          onClick={() => setHasChronic('yes')}
        >
          <ShieldAlert size={18} strokeWidth={2} />
          있어요
        </button>
      </div>

      {hasChronic === 'yes' && (
        <>
          <p className="s-qhint" style={{ marginTop: 14 }}>
            해당하는 질환을 모두 눌러 주세요.
          </p>
          <div className="s-chiprow">
            {(Object.keys(CHRONIC_CONDITION_LABELS) as ChronicConditionKey[]).map((k) => {
              const active = chronicConditions.includes(k)
              return (
                <button
                  key={k}
                  type="button"
                  className={'s-chip s-terra' + (active ? ' s-on' : '')}
                  aria-pressed={active}
                  onClick={() => {
                    // 토글 off 시 하위 단계 입력 reset (stale 방지)
                    if (k === 'kidney' && active) setIrisStage(null)
                    if (k === 'pancreatitis' && active) setPancreatitisSeverity(null)
                    toggleArr(chronicConditions, k, setChronicConditions)
                  }}
                >
                  {active && <Check size={14} strokeWidth={2.4} color="#fff" />}
                  {plainConditionLabel(CHRONIC_CONDITION_LABELS[k])}
                </button>
              )
            })}
          </div>

          {/* CKD → IRIS 단계. Stage 1-2 단백질 정상, 3+ 제한. 미입력 = 보수적(3+). */}
          {chronicConditions.includes('kidney') && (
            <SecondLine
              label="신장질환은 몇 단계인가요?"
              hint="수의사가 알려준 단계(1=초기, 4=말기)예요. 모르면 비워 두세요 — 안전하게 단백질을 제한해 계산해요."
            >
              <ChipRow
                tone="terra"
                options={[
                  { v: '1', label: '1단계' },
                  { v: '2', label: '2단계' },
                  { v: '3', label: '3단계' },
                  { v: '4', label: '4단계' },
                ]}
                value={irisStage === null ? '' : (String(irisStage) as '1' | '2' | '3' | '4')}
                onChange={(v) => setIrisStage(v === '' ? null : (Number(v) as 1 | 2 | 3 | 4))}
              />
            </SecondLine>
          )}

          {/* 췌장염 — 급성/중증은 화식 부적합 하드 게이트(firstBox). 미입력 = 만성. */}
          {chronicConditions.includes('pancreatitis') && (
            <SecondLine
              label="췌장염은 어떤 상태인가요?"
              hint="급성·중증(입원했거나 수의사가 저지방 처방식을 권한 경우)은 화식으로 관리가 어려워 따로 안내해요. 모르면 비워 두세요."
            >
              <ChipRow
                tone="terra"
                options={[
                  { v: 'moderate', label: '만성 · 관리 중' },
                  { v: 'severe', label: '급성 · 중증' },
                ]}
                value={pancreatitisSeverity ?? ''}
                onChange={(v) => setPancreatitisSeverity(v === '' ? null : v)}
              />
            </SecondLine>
          )}

          <SecondLine label="처방식을 먹고 있다면 이름">
            <input
              type="text"
              className="s-inp"
              aria-label="처방식 이름"
              value={prescriptionDiet}
              onChange={(e) => setPrescriptionDiet(e.target.value)}
              placeholder="예: 로얄캐닌 레날"
            />
          </SecondLine>

          {chronicConditions.length > 0 && (
            <div className="s-note">
              <span className="s-ic-warn">
                <ShieldAlert size={14} strokeWidth={2.2} color="#fff" />
              </span>
              <span>
                분석 결과는 <strong>가이드라인 기반 권장</strong>이에요. 처방식·약 변경은
                반드시 주치 수의사와 상담 후 진행해 주세요.
              </span>
            </div>
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
      kicker="추가 질문"
      optional
      title={
        <>
          복용 중인 약이나
          <br />
          보충제가 있나요?
        </>
      }
      sub="쉼표로 나눠 적어 주세요. 없으면 건너뛰어도 돼요."
    >
      <textarea
        className="s-inp"
        rows={3}
        aria-label="복용 중인 약 / 보충제"
        value={medications}
        onChange={(e) => setMedications(e.target.value)}
        placeholder="예: 갑상선 호르몬, 글루코사민, 오메가-3"
      />
      {matches.length > 0 && (
        <div className="s-hint" style={{ marginTop: 12, display: 'block' }}>
          <div style={{ marginBottom: 8 }}>
            적어 주신 약으로 보아 아래 질환이 있을 수 있어요. 해당하면 눌러서 추가해
            주세요.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {matches.map((m) => (
              <button
                key={m.condition}
                type="button"
                onClick={() => onAddCondition(m.condition)}
                className="s-chip s-terra"
              >
                + {m.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </ScreenShell>
  )
}
