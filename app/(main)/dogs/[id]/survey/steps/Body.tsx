// audit #96: SurveyClient.tsx 분할 — body step.
// 칼로리 v2 M2a (2026-07-12): BCS 9점 직접선택 폐기 → 체형 3분해(갈비뼈·허리·배)
// 질문으로 교체. 보호자가 "몇 점?"을 고르는 것보다 관찰 3문항 → deriveBCS 역산이
// 정확 (docs/CALORIE_ALGORITHM_SPEC_V2.md §6). 역산 결과는 판정 카드로 피드백.
import {
  HelpCircle,
  MoonStar,
  Moon,
  Sun,
  CloudSun,
  Cloud,
  Sparkle,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react'
import { BCS_DESCRIPTIONS, type BcsKey } from '@/lib/nutrition/guidelines'
import { petName } from '@/lib/korean'

// 역산 BCS 판정 카드용 시각 위계 (기존 9점 그리드에서 유지).
const BCS_VIEW: Record<
  BcsKey,
  {
    group: 'under' | 'ideal' | 'over'
    Icon: React.ComponentType<{ className?: string; strokeWidth?: number; color?: string; size?: number }>
    tag: string
    tagTone: 'good' | 'warn' | 'bad'
  }
> = {
  1: { group: 'under', Icon: MoonStar, tag: '위험', tagTone: 'bad' },
  2: { group: 'under', Icon: Moon, tag: '주의', tagTone: 'warn' },
  3: { group: 'under', Icon: MoonStar, tag: '주의', tagTone: 'warn' },
  4: { group: 'ideal', Icon: Sparkle, tag: '양호', tagTone: 'good' },
  5: { group: 'ideal', Icon: Sparkles, tag: '이상적', tagTone: 'good' },
  6: { group: 'over', Icon: Sun, tag: '주의', tagTone: 'warn' },
  7: { group: 'over', Icon: Sun, tag: '주의', tagTone: 'warn' },
  8: { group: 'over', Icon: CloudSun, tag: '위험', tagTone: 'bad' },
  9: { group: 'over', Icon: Cloud, tag: '위험', tagTone: 'bad' },
}

/** 체형 3분해 응답 상태 ('' = 미응답). */
export type BodyAssessmentState = {
  ribs: 'visible' | 'easy' | 'slight_pressure' | 'hard' | ''
  waist: 'clear' | 'slight' | 'none' | ''
  abdomen: 'tucked' | 'level' | 'sagging' | ''
}

type WeightTrend = 'stable' | 'gained' | 'lost' | 'unknown' | ''
type WeightMethod =
  | 'vet_scale'
  | 'home_digital'
  | 'hold'
  | 'eyeball'
  | 'unknown'
  | ''

export type BodyProps = {
  dogName: string
  body: BodyAssessmentState
  /** 부분 갱신 — SurveyClient 가 3문항 완성 시 deriveBCS 로 bcs 역산. */
  onBody: (patch: Partial<BodyAssessmentState>) => void
  /** 3문항 완성 시 역산된 BCS (판정 카드 표시용). 미완성 = null. */
  bcs: BcsKey | null
  weightTrend: WeightTrend
  setWeightTrend: (v: WeightTrend) => void
  weightMethod: WeightMethod
  setWeightMethod: (v: WeightMethod) => void
}

const BODY_QUESTIONS: Array<{
  key: keyof BodyAssessmentState
  label: string
  hint: string
  options: Array<{ v: string; label: string }>
}> = [
  {
    key: 'ribs',
    label: '갈비뼈 — 옆구리를 만져보면?',
    hint: '양손으로 옆구리를 부드럽게 쓸어보세요.',
    options: [
      { v: 'visible', label: '안 만져도 보여요' },
      { v: 'easy', label: '살짝 만지면 느껴져요' },
      { v: 'slight_pressure', label: '꾹 눌러야 느껴져요' },
      { v: 'hard', label: '눌러도 잘 안 느껴져요' },
    ],
  },
  {
    key: 'waist',
    label: '허리 — 위에서 내려다보면?',
    hint: '갈비뼈 뒤에서 골반까지의 라인이에요.',
    options: [
      { v: 'clear', label: '잘록하게 들어가요' },
      { v: 'slight', label: '살짝 들어가요' },
      { v: 'none', label: '일자거나 볼록해요' },
    ],
  },
  {
    key: 'abdomen',
    label: '배 — 옆에서 보면 뒷배가?',
    hint: '가슴 끝에서 뒷다리 쪽 배 라인이에요.',
    options: [
      { v: 'tucked', label: '위로 올라가요' },
      { v: 'level', label: '거의 일자예요' },
      { v: 'sagging', label: '아래로 처져요' },
    ],
  },
]

export default function Body({
  dogName,
  body,
  onBody,
  bcs,
  weightTrend,
  setWeightTrend,
  weightMethod,
  setWeightMethod,
}: BodyProps) {
  return (
    <div className="s-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span className="s-kicker">
          BODY <span className="s-dot">·</span> WSAVA
        </span>
      </div>
      <h1 className="s-title">
        {petName(dogName)}의 체형을<br />같이 살펴봐요
      </h1>
      <p className="s-sub">
        세 가지만 관찰해 주시면 <strong>체형 점수(BCS)</strong>는 저희가
        계산해요. 점수를 직접 고르는 것보다 훨씬 정확해요.
      </p>

      {BODY_QUESTIONS.map((q) => (
        <div className="s-sect" key={q.key}>
          <div className="s-sect-lbl">
            <span className="s-label-text">{q.label}</span>
          </div>
          <p className="s-sub" style={{ fontSize: 10.5, marginBottom: 8 }}>
            {q.hint}
          </p>
          <div className="s-chiprow">
            {q.options.map(({ v, label }) => {
              const active = body[q.key] === v
              return (
                <button
                  key={v}
                  type="button"
                  className={'s-chip' + (active ? ' s-on' : '')}
                  aria-pressed={active}
                  onClick={() =>
                    onBody({ [q.key]: v } as Partial<BodyAssessmentState>)
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* 3문항 완성 → 역산 BCS 판정 카드 */}
      {bcs !== null && (
        <div className="s-hint">
          <div className="s-iconwrap">
            {(() => {
              const Icon = BCS_VIEW[bcs].Icon
              return <Icon size={14} strokeWidth={2} />
            })()}
          </div>
          <div>
            <div className="s-row">
              <strong>{BCS_DESCRIPTIONS[bcs].label}</strong>
              <span className={'s-tag s-' + BCS_VIEW[bcs].tagTone}>
                {BCS_VIEW[bcs].tag}
              </span>
            </div>
            {BCS_DESCRIPTIONS[bcs].desc}
          </div>
        </div>
      )}

      <div className="s-sect">
        <div className="s-sect-lbl">
          <span className="s-label-text">최근 6개월 체중 변화</span>
          <span className="s-opt">선택</span>
        </div>
        <div className="s-chiprow">
          {[
            { v: 'stable', label: '비슷', Icon: Minus },
            { v: 'gained', label: '늘었음', Icon: TrendingUp },
            { v: 'lost', label: '빠졌음', Icon: TrendingDown },
            { v: 'unknown', label: '잘 모름', Icon: HelpCircle },
          ].map(({ v, label, Icon }) => {
            const active = weightTrend === v
            return (
              <button
                key={v}
                type="button"
                className={'s-chip' + (active ? ' s-on' : '')}
                aria-pressed={active}
                onClick={() => setWeightTrend(v as WeightTrend)}
              >
                <Icon size={13} strokeWidth={2} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* [발명 모듈 D] 체중 측정 방법 — 신뢰도(W_method)의 핵심 입력. 도구가
          정확할수록 급여량 계산이 정밀해지고, 부정확하면 비대칭 케어목표에서
          안전하게 보수적으로 계산. */}
      <div className="s-sect">
        <div className="s-sect-lbl">
          <span className="s-label-text">체중을 어떻게 쟀어요?</span>
          <span className="s-opt">선택</span>
        </div>
        <p className="s-sub" style={{ fontSize: 10.5, marginBottom: 8 }}>
          측정 도구가 정확할수록 급여량을 더 정밀하게 계산해요.
        </p>
        <div className="s-chiprow">
          {[
            { v: 'vet_scale', label: '동물병원 체중계' },
            { v: 'home_digital', label: '가정용 저울' },
            { v: 'hold', label: '안고 재기' },
            { v: 'eyeball', label: '눈대중' },
            { v: 'unknown', label: '모름' },
          ].map(({ v, label }) => {
            const active = weightMethod === v
            return (
              <button
                key={v}
                type="button"
                className={'s-chip' + (active ? ' s-on' : '')}
                aria-pressed={active}
                onClick={() =>
                  setWeightMethod(active ? '' : (v as WeightMethod))
                }
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
