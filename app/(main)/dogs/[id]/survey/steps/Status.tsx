// audit #96: SurveyClient.tsx 분할 — chronic step (만성질환 / 처방식 / 약물).
// 파일명은 명세 따라 Status.tsx — 실제 STEPS 키는 'chronic'.
import { Check, ShieldAlert } from 'lucide-react'
import {
  CHRONIC_CONDITION_LABELS,
  type ChronicConditionKey,
} from '@/lib/nutrition/guidelines'
import { detectChronicFromMedications } from '@/lib/nutrition/drugs'

type IrisStage = 1 | 2 | 3 | 4 | null
type PancreatitisSeverity = 'moderate' | 'severe' | null

export type StatusProps = {
  chronicConditions: ChronicConditionKey[]
  setChronicConditions: (v: ChronicConditionKey[]) => void
  irisStage: IrisStage
  setIrisStage: (v: IrisStage) => void
  pancreatitisSeverity: PancreatitisSeverity
  setPancreatitisSeverity: (v: PancreatitisSeverity) => void
  prescriptionDiet: string
  setPrescriptionDiet: (v: string) => void
  medications: string
  setMedications: (v: string) => void
}

function toggleArr<T>(arr: T[], v: T, setter: (x: T[]) => void) {
  if (arr.includes(v)) setter(arr.filter((x) => x !== v))
  else setter([...arr, v])
}

export default function Status({
  chronicConditions,
  setChronicConditions,
  irisStage,
  setIrisStage,
  pancreatitisSeverity,
  setPancreatitisSeverity,
  prescriptionDiet,
  setPrescriptionDiet,
  medications,
  setMedications,
}: StatusProps) {
  return (
    <div className="s-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span className="s-kicker">
          HEALTH <span className="s-dot">·</span> 만성질환
        </span>
        <span className="s-opt-badge">선택</span>
      </div>
      <h1 className="s-title">현재 진단받은<br />질환이 있나요?</h1>
      <p className="s-sub">
        식이 관리가 중요한 질환은 분기에 꼭 필요해요.
        <span className="s-pill">없으면 건너뛰세요</span>
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
                // CKD 토글 off 시 irisStage 자동 reset (stale 입력 방지)
                if (k === 'kidney' && chronicConditions.includes('kidney')) {
                  setIrisStage(null)
                }
                // 췌장염 토글 off 시 중증도 reset (stale 입력 방지)
                if (
                  k === 'pancreatitis' &&
                  chronicConditions.includes('pancreatitis')
                ) {
                  setPancreatitisSeverity(null)
                }
                toggleArr(chronicConditions, k, setChronicConditions)
              }}
            >
              {active && <Check size={13} strokeWidth={2.4} color="#fff" />}
              {CHRONIC_CONDITION_LABELS[k]}
            </button>
          )
        })}
      </div>

      {/* v1.3 — CKD 진단 시 IRIS stage. Stage 1-2 는 단백질 정상 처방,
          Stage 3+ 는 단백질 제한. 미입력 시 보수적 (Stage 3+) 처방. */}
      {chronicConditions.includes('kidney') && (
        <div className="s-sect">
          <div className="s-sect-lbl">
            <span className="s-label-text">CKD IRIS 단계</span>
            <span className="s-opt">선택</span>
          </div>
          <p className="s-sub" style={{ fontSize: 10.5, marginBottom: 8 }}>
            IRIS = 만성 신장질환의 국제 표준 진단 단계 (1=초기, 4=말기).
            수의사가 알려주지 않았으면 건너뛰세요 — 미입력 시 보수적
            추천 (단백질 제한) 적용.
          </p>
          <div className="s-chiprow">
            {([1, 2, 3, 4] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={
                  's-chip s-terra' + (irisStage === s ? ' s-on' : '')
                }
                aria-pressed={irisStage === s}
                onClick={() =>
                  setIrisStage(irisStage === s ? null : s)
                }
              >
                {irisStage === s && (
                  <Check size={13} strokeWidth={2.4} color="#fff" />
                )}
                Stage {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 췌장염 중증도 — 급성/중증은 화식(최저지방 ~19%DM)으로 관리 불가
          (지방 <10% 필요) → 추천이 "수의 처방식 필요"로 게이트. 만성/경증은
          저지방 닭 보조 가능. 미입력 시 만성(moderate) 기준. */}
      {chronicConditions.includes('pancreatitis') && (
        <div className="s-sect">
          <div className="s-sect-lbl">
            <span className="s-label-text">췌장염 단계</span>
            <span className="s-opt">선택</span>
          </div>
          <p className="s-sub" style={{ fontSize: 10.5, marginBottom: 8 }}>
            급성·중증(입원 또는 수의사 저지방 처방식 권고)은 화식으로 관리가
            어려워 별도 안내가 나가요. 모르면 건너뛰세요 — 만성 기준 적용.
          </p>
          <div className="s-chiprow">
            {[
              { v: 'moderate' as const, label: '만성 · 관리 중' },
              { v: 'severe' as const, label: '급성 · 중증' },
            ].map(({ v, label }) => (
              <button
                key={v}
                type="button"
                className={
                  's-chip s-terra' +
                  (pancreatitisSeverity === v ? ' s-on' : '')
                }
                aria-pressed={pancreatitisSeverity === v}
                onClick={() =>
                  setPancreatitisSeverity(
                    pancreatitisSeverity === v ? null : v,
                  )
                }
              >
                {pancreatitisSeverity === v && (
                  <Check size={13} strokeWidth={2.4} color="#fff" />
                )}
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="s-sect">
        <div className="s-sect-lbl">
          <span className="s-label-text">처방식</span>
          <span className="s-opt">선택</span>
        </div>
        <input
          type="text"
          className="s-inp"
          aria-label="처방식 이름"
          value={prescriptionDiet}
          onChange={(e) => setPrescriptionDiet(e.target.value)}
          placeholder="예: Royal Canin Renal RF14"
        />
      </div>

      <div className="s-sect">
        <div className="s-sect-lbl">
          <span className="s-label-text">복용 중인 약 / 보충제</span>
          <span className="s-opt">선택</span>
        </div>
        <textarea
          className="s-inp"
          rows={2}
          aria-label="복용 중인 약 / 보충제"
          value={medications}
          onChange={(e) => setMedications(e.target.value)}
          placeholder="예: 갑상선 호르몬, 글루코사민, 오메가-3"
        />
        {/* 약물 키워드 → 만성질환 자동 제안 (사용자 confirm 후 추가) */}
        {(() => {
          const matches = detectChronicFromMedications(medications)
            .filter((m) => !chronicConditions.includes(m.condition))
          if (matches.length === 0) return null
          return (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                background: 'var(--bg-2)',
                borderRadius: 10,
                fontSize: 12,
                color: 'var(--muted)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ marginBottom: 6 }}>
                💡 입력한 약물에서 진단 가능성을 발견했어요. 해당하면 추가:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {matches.map((m) => (
                  <button
                    key={m.condition}
                    type="button"
                    onClick={() =>
                      setChronicConditions([...chronicConditions, m.condition])
                    }
                    style={{
                      appearance: 'none',
                      border: '1px solid var(--fd-coral)',
                      background: '#fff',
                      color: 'var(--fd-coral)',
                      padding: '4px 10px',
                      borderRadius: 99,
                      fontSize: 10.5,
                      fontWeight: 700,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    + {m.label}
                    <span
                      style={{
                        fontSize: 9,
                        fontFamily: 'var(--font-mono), monospace',
                        marginLeft: 4,
                        color: 'var(--muted)',
                        fontWeight: 500,
                      }}
                    >
                      {m.keyword}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        })()}
      </div>

      {chronicConditions.length > 0 && (
        <div className="s-note">
          <span className="s-ic-warn">
            <ShieldAlert size={13} strokeWidth={2.2} color="#fff" />
          </span>
          <span>
            분석 결과는 <strong>가이드라인 기반 권장</strong>이에요. 처방식·약물
            변경은 반드시 주치 수의사와 상담 후 진행해 주세요.
          </span>
        </div>
      )}
    </div>
  )
}
