// 설문 v4 — 변 상태 화면 (Bristol 4단계 + 둘째 줄: 사료 바꿀 때 무른 변).
//
// 2026-09-22 시니어 사용성 3단계: '사료 바꿀 때 무른 변'(giSensitivity — 첫 박스
// 구성에 쓰임)은 지우지 않고 이 화면의 둘째 줄로(사장님). 건너뛰기는 **명시적으로**
// "잘 모르겠어요"를 눌러야 넘어간다 — 예전엔 아무것도 안 눌러도 통과라, 어르신이
// "내가 답한 건가?" 헷갈렸다.
import {
  Check,
  HelpCircle,
  Meh,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react'
import { petName } from '@/lib/korean'
import { ScreenShell, SecondLine, ChipRow } from './ScreenShell'

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
  signal: string
  tag: string
  tone: 'good' | 'warn' | 'bad'
  img: string
}[] = [
  { v: 2, label: '딱딱한 편', signal: '수분·섬유가 부족한 신호', tag: '변비', tone: 'bad', img: '/survey/stool/hard.png' },
  { v: 4, label: '적당해요', signal: '건강한 변이에요', tag: '이상적', tone: 'good', img: '/survey/stool/ideal.png' },
  { v: 6, label: '조금 무른 편', signal: '식이섬유를 보강하면 좋아요', tag: '무름', tone: 'warn', img: '/survey/stool/soft.png' },
  { v: 7, label: '물설사 같아요', signal: '잦으면 수의사 상담 권장', tag: '설사', tone: 'bad', img: '/survey/stool/watery.png' },
]

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
      sub="변 상태는 식이섬유·수분 배합에 반영돼요."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {BRISTOL_OPTIONS.map(({ v, label, signal, tag, tone, img }) => {
          const active = bristol === v
          return (
            <button
              key={v}
              type="button"
              className={
                's-listbtn' +
                (tone === 'good' ? ' s-listbtn-good' : '') +
                (v === 7 ? ' s-listbtn-danger' : '')
              }
              aria-pressed={active}
              onClick={() => {
                setBristol(active ? null : v)
                setSkipped(false)
              }}
            >
              <span className="s-lb-icon s-lb-icon-lg s-lb-icon-bare">
                <span
                  className="s-stool-ic"
                  aria-hidden
                  style={{
                    WebkitMaskImage: `url(${img})`,
                    maskImage: `url(${img})`,
                    backgroundColor: active
                      ? '#fff'
                      : tone === 'good'
                        ? 'var(--sage)'
                        : tone === 'warn'
                          ? '#7A5B1B'
                          : 'var(--fd-coral)',
                  }}
                />
              </span>
              <span className="s-lb-body">
                <span className="s-lb-title">{label}</span>
                <span className="s-lb-sub">{signal}</span>
              </span>
              <span className={'s-tag s-' + tone}>{tag}</span>
            </button>
          )
        })}
        <div className="s-skip-divider"><span>또는</span></div>
        <button
          type="button"
          className={'s-skipbtn' + (skipped ? ' s-active' : '')}
          onClick={() => {
            setBristol(null)
            setSkipped(true)
          }}
          aria-pressed={skipped}
        >
          {skipped ? (
            <>
              <Check size={16} strokeWidth={2.5} aria-hidden />
              이번엔 건너뛸게요
            </>
          ) : (
            <>
              <HelpCircle size={16} strokeWidth={2} aria-hidden />
              잘 모르겠어요 — 건너뛸게요
            </>
          )}
        </button>
      </div>

      <SecondLine label="사료를 바꿀 때 변이 자주 무르나요?">
        <ChipRow
          options={[
            { v: 'rare', label: '거의 없음', Icon: Check },
            { v: 'sometimes', label: '가끔', Icon: Meh },
            { v: 'frequent', label: '자주', Icon: AlertTriangle },
            { v: 'always', label: '매번', Icon: AlertCircle },
          ]}
          value={giSensitivity}
          onChange={(v) => setGiSensitivity(v)}
        />
      </SecondLine>
    </ScreenShell>
  )
}
