// audit #96: SurveyClient.tsx 분할 — body step.
// 칼로리 v2 M2a (2026-07-12): BCS 9점 직접선택 폐기 → 체형 3분해(갈비뼈·허리·배)
// 질문으로 교체. 보호자가 "몇 점?"을 고르는 것보다 관찰 3문항 → deriveBCS 역산이
// 정확 (docs/CALORIE_ALGORITHM_SPEC_V2.md §6). 역산 결과는 판정 카드로 피드백.
import { useState } from 'react'
import Image from 'next/image'
import {
  AlertTriangle,
  Check,
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
  Plus,
} from 'lucide-react'
import { BCS_DESCRIPTIONS, type BcsKey } from '@/lib/nutrition/guidelines'
import type { BcsConflict } from '@/lib/bcs-consistency'
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

// 판정 카드 여백에 살짝 띄우는 체형 실루엣 (사장님 2026-07-23 — 웹 설문용
// 5단계 자산 /survey/body/*.png 재사용, 처음부터 5개 나열하지 않고 역산 BCS가
// 뜨는 순간 해당 체형 하나만 작게). 매핑은 SurveyClient bodyMap과 동일 유지.
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
  /** 칼로리 v2 2b — 쉽게 찌는 체질(easy-keeper, 감산 −0.1 신호). '' = 미응답. */
  easyKeeper: '' | 'yes' | 'no'
  setEasyKeeper: (v: '' | 'yes' | 'no') => void
  /**
   * 체중↔체형 모순 (사장님 2026-07-14). 이전 분석과 비교해 앞뒤가 안 맞으면
   * 판정 카드 바로 아래에 경고. 막지는 않는다 — 진행 버튼은 그대로 살아 있다.
   */
  bcsConflict?: BcsConflict | null
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
  easyKeeper,
  setEasyKeeper,
  bcsConflict,
}: BodyProps) {
  // 뒤로 접기 — 체중 측정법은 기본 숨김, 탭하면 열림(정확도 refinement).
  const [weightMethodOpen, setWeightMethodOpen] = useState(weightMethod !== '')
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
      {/* 뒷문장("점수를 직접 고르는 것보다…") 삭제 — 글 과밀 다이어트
          (사장님 2026-07-23: "너무 글이 많아서 어지러운 느낌"). */}
      <p className="s-sub">
        세 가지만 관찰해 주시면 <strong>체형 점수(BCS)</strong>는 저희가
        계산해요.
      </p>

      {/* 소질문 카드 v2 (2026-07-23 2차) — 번호칩이 답하면 초록 체크로 변신해
          진행감을 주고, 보조설명은 항상 보이되(사장님: 없애는 게 아니라 정돈)
          들여쓰기 정렬된 절제 톤(s-qhint)으로. */}
      {BODY_QUESTIONS.map((q, qi) => {
        const answered = body[q.key] !== ''
        return (
          <div
            className={'s-sect s-qcard' + (answered ? ' s-qcard-done' : '')}
            key={q.key}
          >
            <div className="s-qhead">
              {/* 답하면 번호→체크 (사장님 2026-07-23 재확정: 체크로 복구). */}
              <span className="s-qnum" aria-hidden>
                {answered ? <Check size={12} strokeWidth={3} /> : qi + 1}
              </span>
              <div className="s-sect-lbl">
                <span className="s-label-text">{q.label}</span>
              </div>
            </div>
            <p className="s-qhint">{q.hint}</p>
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
        )
      })}

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
            {/* 줄 정렬도 인라인으로(사장님 2026-07-23: dev Turbopack이 .s-row
                CSS 를 안 물어와 태그가 아래로 처져 보이던 것 우회). BCS 라벨과
                태그를 한 줄·수직중앙으로 확정. */}
            <div
              className="s-row"
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <strong>{BCS_DESCRIPTIONS[bcs].label}</strong>
              {/* 신호등 색을 인라인으로(CSS 캐시 우회 — JS 번들이라 확실히 반영).
                  이상적=초록·주의=앰버·위험=딥레드 솔리드 + 텍스트 수직 중앙. */}
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
          {/* 해당 BCS 체형 실루엣 — 강아지 옆모습만(-dog, 탑뷰 제거·크기 통일한
              앱 전용 크롭. 웹 원본 2뷰는 그대로). 카드 오른쪽 여백 장식이라
              스크린리더 숨김(라벨·설명이 이미 말로 전달). */}
          <Image
            src={`/survey/body/${BCS_BODY_IMG[bcs]}-dog.png`}
            alt=""
            aria-hidden
            width={56}
            height={56}
            className="s-bcs-shape"
          />
        </div>
      )}

      {/* 체중↔체형 모순 경고 — 판정 카드 바로 아래. 계산의 재료 두 개가 서로
          어긋난 상태라 그 위에서 나온 급여량 전체가 틀어진다. 그래서 결과가
          아니라 '입력하는 이 자리'에서 짚는다. 단 막지는 않는다(사장님 확정). */}
      {bcsConflict && (
        <div className="s-warn" role="status">
          <div className="s-warn-hd">
            <AlertTriangle size={13} strokeWidth={2.5} aria-hidden />
            {bcsConflict.title}
          </div>
          <p className="s-warn-body">{bcsConflict.detail}</p>
          <p className="s-warn-body">{bcsConflict.action}</p>
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

      {/* 칼로리 v2 2b — easy-keeper. '네'만 감산 −0.1, 미응답/아니요 = 무보정. */}
      <div className="s-sect">
        <div className="s-sect-lbl">
          <span className="s-label-text">살이 잘 찌는 편인가요?</span>
          <span className="s-opt">선택</span>
        </div>
        <p className="s-sub" style={{ fontSize: 13, marginBottom: 8 }}>
          조금만 더 먹여도 금방 찌는 체질이면 급여량을 살짝 보수적으로 잡아요.
        </p>
        <div className="s-chiprow">
          {[
            { v: 'yes', label: '네, 쉽게 쪄요' },
            { v: 'no', label: '아니요' },
          ].map(({ v, label }) => {
            const active = easyKeeper === v
            return (
              <button
                key={v}
                type="button"
                className={'s-chip' + (active ? ' s-on' : '')}
                aria-pressed={active}
                onClick={() => setEasyKeeper(active ? '' : (v as 'yes' | 'no'))}
              >
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
        {!weightMethodOpen ? (
          <button
            type="button"
            className="s-skipbtn"
            onClick={() => setWeightMethodOpen(true)}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
            체중을 어떻게 쟀는지 알려주기 (선택 · 정확도 ↑)
          </button>
        ) : (
          <>
            <div className="s-sect-lbl">
              <span className="s-label-text">체중을 어떻게 쟀어요?</span>
              <span className="s-opt">선택</span>
            </div>
            <p className="s-sub" style={{ fontSize: 13, marginBottom: 8 }}>
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
          </>
        )}
      </div>
    </div>
  )
}
