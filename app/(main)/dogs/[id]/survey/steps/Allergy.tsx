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
