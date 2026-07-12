// audit #96: SurveyClient.tsx 분할 — allergy step. 알레르기 모드/항목 + 선호 단백질.
import { Check, HelpCircle, AlertTriangle } from 'lucide-react'

const ALLERGY_OPTIONS = [
  '닭·칠면조',
  '소고기',
  '양고기',
  '연어·생선',
  '오리',
  '흰살생선',
  '돼지고기',
  '유제품',
  '계란',
  '곡물 (밀/옥수수)',
  '대두',
  '감자',
  '견과류',
]

const PROTEIN_OPTIONS: Array<{ v: string; label: string }> = [
  { v: 'chicken', label: '닭/칠면조' },
  { v: 'duck', label: '오리' },
  { v: 'beef', label: '소고기' },
  { v: 'salmon', label: '연어/생선' },
  { v: 'pork', label: '돼지고기' },
  { v: 'lamb', label: '양고기' },
]

type DlMode = 'none' | 'unknown' | 'has' | ''

export type AllergyProps = {
  dlMode: DlMode
  setDlMode: (v: DlMode) => void
  allergies: string[]
  setAllergies: (v: string[]) => void
  preferredProteins: string[]
  setPreferredProteins: (v: string[]) => void
}

function toggleArr<T>(arr: T[], v: T, setter: (x: T[]) => void) {
  if (arr.includes(v)) setter(arr.filter((x) => x !== v))
  else setter([...arr, v])
}

export default function Allergy({
  dlMode,
  setDlMode,
  allergies,
  setAllergies,
  preferredProteins,
  setPreferredProteins,
}: AllergyProps) {
  return (
    <div className="s-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span className="s-kicker">ALLERGIES</span>
      </div>
      <h1 className="s-title">피해야 할<br />재료가 있나요?</h1>
      <p className="s-sub">알레르기 + 선호 단백질을 함께 알려주시면 정확도가 올라가요.</p>

      <div className="s-sect">
        <div className="s-sect-lbl"><span className="s-label-text">알레르기 유무</span></div>
        <div className="s-seg">
          <button
            type="button"
            // R35 revert: "없어요" sage 강조 제거. 사용자가 "안전" 을 default
            // 정답으로 유도받는 느낌 차단. "있어요" 만 위험 신호 (s-danger 유지).
            aria-pressed={dlMode === 'none'}
            onClick={() => {
              setDlMode('none')
              setAllergies([])
            }}
          >
            <Check size={16} strokeWidth={2} />
            없어요
          </button>
          <button
            type="button"
            aria-pressed={dlMode === 'unknown'}
            onClick={() => {
              setDlMode('unknown')
              setAllergies([])
            }}
          >
            <HelpCircle size={16} strokeWidth={2} />
            잘 몰라요
          </button>
          <button
            type="button"
            // R34d — "있어요" terracotta fill (위험 신호) — survey.css 에 정의된
            // .s-seg button[aria-pressed="true"].s-danger 룰 활성화.
            className="s-danger"
            aria-pressed={dlMode === 'has'}
            onClick={() => setDlMode('has')}
          >
            <AlertTriangle size={16} strokeWidth={2} />
            있어요
          </button>
        </div>
        {dlMode === 'has' && (
          <div className="s-chiprow" style={{ marginTop: 12 }}>
            {ALLERGY_OPTIONS.map((v) => {
              const active = allergies.includes(v)
              return (
                <button
                  key={v}
                  type="button"
                  className={'s-chip' + (active ? ' s-on' : '')}
                  aria-pressed={active}
                  onClick={() => toggleArr(allergies, v, setAllergies)}
                >
                  {v}
                </button>
              )
            })}
          </div>
        )}
        {/* 정돈 P3 — 응답 반영 피드백. 알레르겐을 고르면 '100% 제외' 안심 문구로
            "앱이 내 답을 이해하고 반영한다"는 감각 + 안전 신뢰. */}
        {dlMode === 'has' && allergies.length > 0 && (
          <div className="s-hint" style={{ marginTop: 12 }}>
            <div className="s-iconwrap">
              <Check size={14} strokeWidth={2.4} />
            </div>
            <div>
              선택한 재료는 추천 레시피에서 <strong>100% 빼드려요.</strong>{' '}
              안심하고 골라 주세요.
            </div>
          </div>
        )}
      </div>

      <div className="s-sect">
        <div className="s-sect-lbl">
          <span className="s-label-text">잘 먹는 단백질</span>
          <span className="s-opt">선택 · 복수</span>
        </div>
        <div className="s-chiprow">
          {PROTEIN_OPTIONS.map(({ v, label }) => {
            const active = preferredProteins.includes(v)
            return (
              <button
                key={v}
                type="button"
                className={'s-chip' + (active ? ' s-on' : '')}
                aria-pressed={active}
                onClick={() => toggleArr(preferredProteins, v, setPreferredProteins)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
