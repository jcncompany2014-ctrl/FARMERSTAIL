// 설문 v4 — 몸 상태 4화면 (갈비뼈 · 허리 · 배 · 체중 변화).
//
// 칼로리 v2 M2a (2026-07-12): BCS 9점 직접선택 폐기 → 체형 3분해(갈비뼈·허리·배)
// 관찰 3문항 → deriveBCS 역산 (docs/CALORIE_ALGORITHM_SPEC_V2.md §6). 역산 결과는
// 세 번째(배) 화면에서 답을 고르는 순간 판정 카드로 피드백한다.
//
// 2026-09-22 시니어 사용성 3단계: 한 화면에 3문항 + 체중변화 + 살찌는편 + 잰방법이
// 쌓여 있던 것을 화면당 질문 하나로 쪼갰다. '살 잘 찌는 편'은 체중 변화 화면의
// 둘째 줄, '체중 잰 방법'은 접힌 채(사장님 결정).
import { useState } from 'react'
import Image from 'next/image'
import {
  AlertTriangle,
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
  HelpCircle,
  Plus,
} from 'lucide-react'
import { BCS_DESCRIPTIONS, type BcsKey } from '@/lib/nutrition/guidelines'
import type { BcsConflict } from '@/lib/bcs-consistency'
import { petName } from '@/lib/korean'
import { ScreenShell, OptionList, SecondLine, ChipRow } from './ScreenShell'

// 역산 BCS 판정 카드용 시각 위계.
const BCS_VIEW: Record<
  BcsKey,
  {
    Icon: React.ComponentType<{ className?: string; strokeWidth?: number; color?: string; size?: number }>
    tag: string
    tagTone: 'good' | 'warn' | 'bad'
  }
> = {
  1: { Icon: MoonStar, tag: '위험', tagTone: 'bad' },
  2: { Icon: Moon, tag: '주의', tagTone: 'warn' },
  3: { Icon: MoonStar, tag: '주의', tagTone: 'warn' },
  4: { Icon: Sparkle, tag: '양호', tagTone: 'good' },
  5: { Icon: Sparkles, tag: '이상적', tagTone: 'good' },
  6: { Icon: Sun, tag: '주의', tagTone: 'warn' },
  7: { Icon: Sun, tag: '주의', tagTone: 'warn' },
  8: { Icon: CloudSun, tag: '위험', tagTone: 'bad' },
  9: { Icon: Cloud, tag: '위험', tagTone: 'bad' },
}

// 판정 카드의 체형 실루엣 — 웹 설문용 5단계 자산 /survey/body/*.png 재사용.
// 매핑은 SurveyClient bodyMap 과 동일 유지.
const BCS_BODY_IMG: Record<BcsKey, string> = {
  1: 'skinny', 2: 'skinny',
  3: 'slim', 4: 'slim',
  5: 'ideal',
  6: 'chubby', 7: 'chubby',
  8: 'obese', 9: 'obese',
}

/** 체형 3분해 응답 상태 ('' = 미응답). */
export type BodyAssessmentState = {
  ribs: 'visible' | 'easy' | 'slight_pressure' | 'hard' | ''
  waist: 'clear' | 'slight' | 'none' | ''
  abdomen: 'tucked' | 'level' | 'sagging' | ''
}

export type WeightTrend = 'stable' | 'gained' | 'lost' | 'unknown' | ''
export type WeightMethod =
  | 'vet_scale'
  | 'home_digital'
  | 'hold'
  | 'eyeball'
  | 'unknown'
  | ''

const RIBS_OPTIONS = [
  { v: 'visible', label: '안 만져도 보여요' },
  { v: 'easy', label: '살짝 만지면 느껴져요' },
  { v: 'slight_pressure', label: '꾹 눌러야 느껴져요' },
  { v: 'hard', label: '눌러도 잘 안 느껴져요' },
] as const

const WAIST_OPTIONS = [
  { v: 'clear', label: '잘록하게 들어가요' },
  { v: 'slight', label: '살짝 들어가요' },
  { v: 'none', label: '일자거나 볼록해요' },
] as const

const ABDOMEN_OPTIONS = [
  { v: 'tucked', label: '위로 올라가요' },
  { v: 'level', label: '거의 일자예요' },
  { v: 'sagging', label: '아래로 처져요' },
] as const

export function RibsScreen({
  dogName,
  value,
  onChange,
}: {
  dogName: string
  value: BodyAssessmentState['ribs']
  onChange: (v: BodyAssessmentState['ribs']) => void
}) {
  return (
    <ScreenShell
      kicker="몸 상태"
      title={
        <>
          {petName(dogName)}의 갈비뼈가
          <br />
          어떻게 만져지나요?
        </>
      }
      sub="양손으로 옆구리를 부드럽게 쓸어보세요."
    >
      <OptionList
        options={RIBS_OPTIONS}
        value={value}
        onChange={(v) => onChange((v ?? '') as BodyAssessmentState['ribs'])}
        ariaLabel="갈비뼈"
      />
    </ScreenShell>
  )
}

export function WaistScreen({
  value,
  onChange,
}: {
  value: BodyAssessmentState['waist']
  onChange: (v: BodyAssessmentState['waist']) => void
}) {
  return (
    <ScreenShell
      kicker="몸 상태"
      title={
        <>
          위에서 내려다보면
          <br />
          허리가 어떤가요?
        </>
      }
      sub="갈비뼈 뒤에서 골반까지의 라인이에요."
    >
      <OptionList
        options={WAIST_OPTIONS}
        value={value}
        onChange={(v) => onChange((v ?? '') as BodyAssessmentState['waist'])}
        ariaLabel="허리"
      />
    </ScreenShell>
  )
}

export function AbdomenScreen({
  value,
  onChange,
  bcs,
  bcsConflict,
}: {
  value: BodyAssessmentState['abdomen']
  onChange: (v: BodyAssessmentState['abdomen']) => void
  /** 3문항 완성 시 역산된 BCS (판정 카드 표시용). 미완성 = null. */
  bcs: BcsKey | null
  /** 체중↔체형 모순 — 경고만, 막지 않는다(사장님 2026-07-14 확정). */
  bcsConflict?: BcsConflict | null
}) {
  return (
    <ScreenShell
      kicker="몸 상태"
      title={
        <>
          옆에서 보면
          <br />
          뒷배가 어떤가요?
        </>
      }
      sub="가슴 끝에서 뒷다리 쪽 배 라인이에요."
    >
      <OptionList
        options={ABDOMEN_OPTIONS}
        value={value}
        onChange={(v) => onChange((v ?? '') as BodyAssessmentState['abdomen'])}
        ariaLabel="배"
      />

      {/* 3문항 완성 → 역산 체형 판정 카드. "BCS" 대신 "체형 n단계"(브랜드 보이스:
          전문용어 금지). */}
      {bcs !== null && (
        <div className="s-hint s-result" role="status">
          <div className="s-iconwrap">
            {(() => {
              const Icon = BCS_VIEW[bcs].Icon
              return <Icon size={16} strokeWidth={2} />
            })()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <strong style={{ lineHeight: 1 }}>체형 {bcs}단계</strong>
              <span
                className={'s-tag s-' + BCS_VIEW[bcs].tagTone}
                style={{
                  background:
                    BCS_VIEW[bcs].tagTone === 'good'
                      ? 'var(--fd-green)'
                      : BCS_VIEW[bcs].tagTone === 'warn'
                        ? 'var(--fd-gold)'
                        : 'var(--fd-coral-ink)',
                  color: BCS_VIEW[bcs].tagTone === 'warn' ? '#5E3B12' : '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  lineHeight: 1,
                }}
              >
                {BCS_VIEW[bcs].tag}
              </span>
            </div>
            {BCS_DESCRIPTIONS[bcs].desc}
          </div>
          <Image
            src={`/survey/body/${BCS_BODY_IMG[bcs]}.png`}
            alt=""
            aria-hidden
            width={60}
            height={60}
            className="s-bcs-shape"
          />
        </div>
      )}

      {bcsConflict && (
        <div className="s-warn" role="status">
          <div className="s-warn-hd">
            <AlertTriangle size={14} strokeWidth={2.5} aria-hidden />
            {bcsConflict.title}
          </div>
          <p className="s-warn-body">{bcsConflict.detail}</p>
          <p className="s-warn-body">{bcsConflict.action}</p>
        </div>
      )}
    </ScreenShell>
  )
}

const TREND_OPTIONS = [
  { v: 'stable', label: '비슷해요', Icon: Minus },
  { v: 'gained', label: '늘었어요', Icon: TrendingUp },
  { v: 'lost', label: '빠졌어요', Icon: TrendingDown },
  { v: 'unknown', label: '잘 모름', Icon: HelpCircle },
] as const

const METHOD_OPTIONS = [
  { v: 'vet_scale', label: '동물병원 체중계' },
  { v: 'home_digital', label: '가정용 저울' },
  { v: 'hold', label: '안고 재기' },
  { v: 'eyeball', label: '눈대중' },
  { v: 'unknown', label: '모름' },
] as const

export function WeightScreen({
  weightTrend,
  setWeightTrend,
  easyKeeper,
  setEasyKeeper,
  weightMethod,
  setWeightMethod,
}: {
  weightTrend: WeightTrend
  setWeightTrend: (v: WeightTrend) => void
  /** 칼로리 v2 2b — 쉽게 찌는 체질(감산 −0.1 신호). '' = 미응답. */
  easyKeeper: '' | 'yes' | 'no'
  setEasyKeeper: (v: '' | 'yes' | 'no') => void
  /** [발명 모듈 D] 체중 측정 방법 — 신뢰도 입력. 접힌 채(사장님). */
  weightMethod: WeightMethod
  setWeightMethod: (v: WeightMethod) => void
}) {
  const [methodOpen, setMethodOpen] = useState(weightMethod !== '')
  return (
    <ScreenShell
      kicker="몸 상태"
      title={
        <>
          최근 6개월,
          <br />
          체중이 어떻게 변했나요?
        </>
      }
      sub="정확히 모르면 ‘잘 모름’을 눌러도 괜찮아요."
    >
      <OptionList
        options={TREND_OPTIONS}
        value={weightTrend}
        onChange={(v) => setWeightTrend((v ?? '') as WeightTrend)}
        ariaLabel="체중 변화"
      />

      <SecondLine
        label="살이 잘 찌는 편인가요?"
        hint="조금만 더 먹여도 금방 찌는 체질이면 급여량을 살짝 보수적으로 잡아요."
      >
        <ChipRow
          options={[
            { v: 'yes', label: '네, 쉽게 쪄요' },
            { v: 'no', label: '아니요' },
          ]}
          value={easyKeeper}
          onChange={(v) => setEasyKeeper(v)}
        />
      </SecondLine>

      {!methodOpen ? (
        <button
          type="button"
          className="s-skipbtn"
          onClick={() => setMethodOpen(true)}
        >
          <Plus size={16} strokeWidth={2} aria-hidden />
          체중을 어떻게 쟀는지 알려주기 (선택)
        </button>
      ) : (
        <SecondLine
          label="체중을 어떻게 쟀어요?"
          hint="정확한 저울일수록 급여량을 더 정밀하게 계산해요."
        >
          <ChipRow
            options={METHOD_OPTIONS}
            value={weightMethod}
            onChange={(v) => setWeightMethod(v)}
          />
        </SecondLine>
      )}
    </ScreenShell>
  )
}
