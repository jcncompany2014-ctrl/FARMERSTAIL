// 설문 v4 — 알레르기 화면 (유무 → 재료 칩, 둘째 줄: 잘 먹는 고기).
// 잘 먹는 고기에 연어는 없다 — 판매 계획이 없어 고객이 골라도 쓸 데가 없고 근거 문구에 '연어'만 남는다(사장님 2026-09-24).
// 알레르기 쪽 '연어'·'흰살생선'은 기록용으로 유지 — ★차단 판정엔 안 쓰인다: 판매 4종의 blockingAllergies 엔
// 생선이 없다(연어유는 4종 공통 소량 원료). 고객 안내는 FAQ(2026-09-26 정정)가 한다 —
// "주재료 단백질이 아니라 가능성 매우 낮음, 걱정되면 카카오톡 문의". (예전 주석은 '차단 판정에 쓴다'였다 — 거짓.)
// ★2026-10-09 보기 정리(앱시안 결정 20번): 보기는 정본 lib/survey/allergy-options 의 두 묶음('고기·생선' ·
// '그 밖의 재료'). '계란'·'곡물 (밀/옥수수)' 삭제, '연어·생선' → '연어'. 라벨 = 저장값 = 차단 키라 여기서 글자를
// 바꾸지 말고 정본을 고칠 것(차단 표·/start 번역과 테스트가 같이 묶여 있다).
// 2026-10-09 앱 새 디자인('A 포스터', 시안 E09 · F22 · F22b): 유무 = 선택 막대, 재료·고기 = 칩, 펼침은 카드 안에서 스크롤.
// 잘 먹는 고기 보기 이름 '닭/칠면조' → '닭·칠면조'(시안 — 값 'chicken' 그대로).
import { ScreenShell, Segmented, LabelBar, Help, Chips, Note } from './ScreenShell'
import { ALLERGY_GROUPS } from '@/lib/survey/allergy-options'

const PROTEIN_OPTIONS: Array<{ v: string; label: string }> = [
  { v: 'chicken', label: '닭·칠면조' },
  { v: 'duck', label: '오리' },
  { v: 'beef', label: '소고기' },
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
  pork: ['돼지고기'],
  lamb: ['양고기'],
}

export type DlMode = 'none' | 'unknown' | 'has' | ''

const MODE_OPTIONS = [
  { v: 'none', label: '없어요' },
  { v: 'unknown', label: '잘 몰라요' },
  { v: 'has', label: '있어요' },
] as const

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
  const conflicted = (v: string) => (PROTEIN_ALLERGENS[v] ?? []).some((a) => allergies.includes(a))
  const anyConflict = PROTEIN_OPTIONS.some(({ v }) => conflicted(v))
  return (
    <ScreenShell
      kicker="알레르기"
      title={
        <>
          피해야 할 재료가
          <br />
          있나요?
        </>
      }
      sub="고른 재료는 추천에서 완전히 빼드려요"
    >
      <Segmented
        style={{ marginTop: 24 }}
        options={MODE_OPTIONS}
        value={dlMode}
        onChange={(v) => {
          // '없어요'·'잘 몰라요'는 고른 재료를 비운다(예전과 같다). 고른 칸을 다시 눌러도 그대로.
          if (v === 'none' || v === 'unknown') {
            setDlMode(v)
            setAllergies([])
          } else if (v === 'has') {
            setDlMode('has')
          }
        }}
        ariaLabel="피해야 할 재료"
      />

      {dlMode === 'has' && (
        <>
          <LabelBar style={{ marginTop: 16 }}>해당하는 재료를 모두 골라 주세요</LabelBar>
          {ALLERGY_GROUPS.map((g) => (
            <div key={g.label} style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="s-glabel">{g.label}</span>
              <Chips
                style={{ marginTop: 8 }}
                options={g.options.map((v) => ({ v, label: v }))}
                isOn={(v) => allergies.includes(v)}
                onToggle={(v) => toggleArr(allergies, v, setAllergies)}
                ariaLabel={g.label}
              />
            </div>
          ))}
          {allergies.length > 0 && (
            <Note>
              고른 재료는 추천 레시피에서 <strong>모두 빼드려요.</strong> 안심하고 골라 주세요.
            </Note>
          )}
        </>
      )}

      {dlMode !== '' && (
        <>
          <LabelBar optional style={{ marginTop: 24 }}>
            잘 먹는 고기가 있나요?
          </LabelBar>
          <Help>여러 개 골라도 돼요</Help>
          <Chips
            style={{ marginTop: 12 }}
            options={PROTEIN_OPTIONS.map(({ v, label }) => ({ v, label, disabled: conflicted(v) }))}
            isOn={(v) => preferredProteins.includes(v)}
            onToggle={(v) => toggleArr(preferredProteins, v, setPreferredProteins)}
            ariaLabel="잘 먹는 고기"
          />
          {anyConflict && (
            <Note>
              알레르기로 고른 고기는 <strong>자동으로 빠져요</strong> — 좋아해도 추천엔 넣지 않아요.
            </Note>
          )}
        </>
      )}
    </ScreenShell>
  )
}
