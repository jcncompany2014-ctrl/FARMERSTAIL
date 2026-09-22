// 설문 v4 — 알레르기 화면 (유무 → 재료 칩, 둘째 줄: 잘 먹는 고기).
import { Check, HelpCircle, AlertTriangle } from 'lucide-react'
import { ScreenShell, SecondLine } from './ScreenShell'

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

/**
 * 선호 단백질 → 이 단백질을 차단하는 알레르기 라벨 (lib skuModel blockingAllergies 와
 * 정합 — 설문 라벨 기준). 알레르기로 고른 단백질은 '잘 먹는 고기'에서 자동 제외.
 */
const PROTEIN_ALLERGENS: Record<string, string[]> = {
  chicken: ['닭·칠면조'],
  duck: ['오리'],
  beef: ['소고기', '양고기'],
  salmon: ['연어·생선', '흰살생선'],
  pork: ['돼지고기'],
  lamb: ['양고기'],
}

export type DlMode = 'none' | 'unknown' | 'has' | ''

function toggleArr<T>(arr: T[], v: T, setter: (x: T[]) => void) {
  if (arr.includes(v)) setter(arr.filter((x) => x !== v))
  else setter([...arr, v])
}

export function AllergyScreen({
  dlMode,
  setDlMode,
  allergies,
  setAllergies,
  preferredProteins,
  setPreferredProteins,
}: {
  dlMode: DlMode
  setDlMode: (v: DlMode) => void
  allergies: string[]
  setAllergies: (v: string[]) => void
  preferredProteins: string[]
  setPreferredProteins: (v: string[]) => void
}) {
  const anyConflict = PROTEIN_OPTIONS.some(({ v }) =>
    (PROTEIN_ALLERGENS[v] ?? []).some((a) => allergies.includes(a)),
  )
  return (
    <ScreenShell
      kicker="알레르기"
      title={
        <>
          피해야 할
          <br />
          재료가 있나요?
        </>
      }
      sub="알레르기가 있는 재료는 추천에서 완전히 빼드려요."
    >
      <div className="s-seg">
        <button
          type="button"
          aria-pressed={dlMode === 'none'}
          onClick={() => {
            setDlMode('none')
            setAllergies([])
          }}
        >
          <Check size={18} strokeWidth={2} />
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
          <HelpCircle size={18} strokeWidth={2} />
          잘 몰라요
        </button>
        <button
          type="button"
          className="s-danger"
          aria-pressed={dlMode === 'has'}
          onClick={() => setDlMode('has')}
        >
          <AlertTriangle size={18} strokeWidth={2} />
          있어요
        </button>
      </div>

      {dlMode === 'has' && (
        <>
          <p className="s-qhint" style={{ marginTop: 14 }}>
            해당하는 재료를 모두 눌러 주세요.
          </p>
          <div className="s-chiprow">
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
          {allergies.length > 0 && (
            <div className="s-hint" style={{ marginTop: 12 }}>
              <div className="s-iconwrap">
                <Check size={14} strokeWidth={2.4} />
              </div>
              <div>
                고른 재료는 추천 레시피에서 <strong>100% 빼드려요.</strong> 안심하고
                골라 주세요.
              </div>
            </div>
          )}
        </>
      )}

      {dlMode !== '' && (
        <SecondLine label="잘 먹는 고기가 있나요?" hint="여러 개 골라도 돼요.">
          <div className="s-chiprow">
            {PROTEIN_OPTIONS.map(({ v, label }) => {
              const active = preferredProteins.includes(v)
              const conflicted = (PROTEIN_ALLERGENS[v] ?? []).some((a) =>
                allergies.includes(a),
              )
              return (
                <button
                  key={v}
                  type="button"
                  className={'s-chip' + (active && !conflicted ? ' s-on' : '')}
                  aria-pressed={active && !conflicted}
                  disabled={conflicted}
                  onClick={() => toggleArr(preferredProteins, v, setPreferredProteins)}
                  style={
                    conflicted
                      ? { opacity: 0.45, textDecoration: 'line-through', cursor: 'not-allowed' }
                      : undefined
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>
          {anyConflict && (
            <div className="s-hint" style={{ marginTop: 12 }}>
              <div className="s-iconwrap">
                <Check size={14} strokeWidth={2.4} />
              </div>
              <div>
                알레르기로 고른 고기는 <strong>자동으로 빠져요</strong> — 좋아해도
                추천엔 넣지 않아요.
              </div>
            </div>
          )}
        </SecondLine>
      )}
    </ScreenShell>
  )
}
