// 설문 v4 — 변 상태 화면 (Bristol 4단계 + 둘째 줄: 사료 바꿀 때 무른 변).
//
// 2026-09-22 시니어 사용성 3단계: '사료 바꿀 때 무른 변'(giSensitivity — 첫 박스
// 구성에 쓰임)은 지우지 않고 이 화면의 둘째 줄로(사장님). 건너뛰기는 **명시적으로**
// "잘 모르겠어요"를 눌러야 넘어간다 — 예전엔 아무것도 안 눌러도 통과라, 어르신이
// "내가 답한 건가?" 헷갈렸다.
//
// 2026-10-09 앱 새 디자인('A 포스터', 시안 E05): 네 칸 2×2(이름 + 색 글자 꼬리표) · 건너뛰기는 밑줄 글자 버튼 ·
// 둘째 줄은 선택 막대. 답 값(2·4·6·7)·건너뛰기 규칙은 그대로.
import { petName } from '@/lib/korean'
import { ScreenShell, Segmented, LabelBar, TextLink, CheckIcon } from './ScreenShell'

export type BristolKey = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type GiSensitivity = 'rare' | 'sometimes' | 'frequent' | 'always' | ''

/**
 * 변 상태 4단계 — 알고리즘상 의미 있는 상태만 (2026-07-12 사장님: 7단계 과함).
 * value 는 nutrition.ts 의 bristolScore 임계(≤2 변비 / 4 이상 / ≥6 무름 / 7 설사)에
 * 그대로 매핑 → 7→4 축소로 알고리즘 신호 손실 없음.
 */
const BRISTOL_OPTIONS: {
  v: BristolKey
  label: string
  tag: string
  tone: 'good' | 'warn' | 'bad'
}[] = [
  { v: 2, label: '딱딱한 편', tag: '변비', tone: 'bad' },
  { v: 4, label: '적당해요', tag: '이상적', tone: 'good' },
  { v: 6, label: '조금 무른 편', tag: '무름', tone: 'warn' },
  { v: 7, label: '물설사 같아요', tag: '설사', tone: 'bad' },
]

const GI_OPTIONS = [
  { v: 'rare', label: '거의 없음' },
  { v: 'sometimes', label: '가끔' },
  { v: 'frequent', label: '자주' },
  { v: 'always', label: '매번' },
] as const

export function StoolScreen({
  dogName,
  bristol,
  setBristol,
  skipped,
  setSkipped,
  giSensitivity,
  setGiSensitivity,
}: {
  dogName: string
  bristol: BristolKey | null
  setBristol: (v: BristolKey | null) => void
  /** "잘 모르겠어요"를 명시적으로 눌렀는지. */
  skipped: boolean
  setSkipped: (v: boolean) => void
  giSensitivity: GiSensitivity
  setGiSensitivity: (v: GiSensitivity) => void
}) {
  return (
    <ScreenShell
      kicker="소화"
      title={
        <>
          {petName(dogName)}의 평소 변은
          <br />
          어떤가요?
        </>
      }
      sub="변 상태는 식이섬유와 수분 배합에 반영돼요"
    >
      <div className="s-stoolgrid" role="group" aria-label="변 상태" style={{ marginTop: 16 }}>
        {BRISTOL_OPTIONS.map(({ v, label, tag, tone }) => {
          const active = bristol === v
          return (
            <button
              key={v}
              type="button"
              className="s-stool"
              data-tone={tone}
              aria-pressed={active}
              onClick={() => {
                setBristol(active ? null : v)
                setSkipped(false)
              }}
            >
              <span className="s-stool-lb">{label}</span>
              <span className="s-stool-tag">{tag}</span>
              {active && (
                <span className="s-badge" style={{ width: 22, height: 22, top: 10, right: 10 }} aria-hidden="true">
                  <CheckIcon />
                </span>
              )}
            </button>
          )
        })}
      </div>
      <TextLink
        style={{ marginTop: 12 }}
        pressed={skipped}
        onClick={() => {
          setBristol(null)
          setSkipped(true)
        }}
      >
        {skipped ? (
          <>
            <CheckIcon size={14} color="currentColor" />
            이번엔 건너뛸게요
          </>
        ) : (
          '잘 모르겠어요 · 건너뛸게요'
        )}
      </TextLink>

      <LabelBar optional style={{ marginTop: 18 }}>
        사료 바꿀 때 자주 무르나요?
      </LabelBar>
      <Segmented
        style={{ marginTop: 12 }}
        options={GI_OPTIONS}
        value={giSensitivity}
        onChange={(v) => setGiSensitivity(v)}
        allowClear
        ariaLabel="사료 바꿀 때 무른 변"
      />
    </ScreenShell>
  )
}
