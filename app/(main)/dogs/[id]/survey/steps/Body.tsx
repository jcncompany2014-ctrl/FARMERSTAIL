// 설문 v4 — 몸 상태 4화면 (갈비뼈 · 허리 · 배 · 체중 변화).
//
// 칼로리 v2 M2a (2026-07-12): BCS 9점 직접선택 폐기 → 체형 3분해(갈비뼈·허리·배)
// 관찰 3문항 → deriveBCS 역산 (docs/CALORIE_ALGORITHM_SPEC_V2.md §6). 역산 결과는
// 세 번째(배) 화면에서 답을 고르는 순간 판정 카드로 피드백한다.
//
// 2026-09-22 시니어 사용성 3단계: 한 화면에 3문항 + 체중변화 + 살찌는편 + 잰방법이
// 쌓여 있던 것을 화면당 질문 하나로 쪼갰다. '살 잘 찌는 편'은 체중 변화 화면의
// 둘째 줄, '체중 잰 방법'은 접힌 채(사장님 결정).
//
// 2026-10-09 앱 새 디자인('A 포스터', 시안 E01~E04 · F25 · F32): 갈비뼈·허리·배 = AI 사진 칸(같은 강아지·같은 배율,
// 칸 모양에 맞게 오림 — public/survey/ai/<질문>-<답 값>.jpg, 파일 이름이 답 값이라 보기와 사진이 어긋나지 않는다).
// 배 화면 판정 카드는 "체형 n단계 · 9단계 중"(전문용어 BCS 대신) + 설명은 '이상적' 을 반복하지 않는 말로.
// 체중 잰 방법은 접힌 링크 → 아래에서 올라오는 창(F25). 답 키·값·역산은 그대로.
import { useState } from 'react'
import type { BcsKey } from '@/lib/nutrition/guidelines'
import type { BcsConflict } from '@/lib/bcs-consistency'
import { petName } from '@/lib/korean'
import {
  ScreenShell,
  PhotoGrid,
  PhotoRows,
  Segmented,
  LabelBar,
  TextLink,
  LineList,
} from './ScreenShell'
import { SurveySheet } from './Sheet'

/**
 * 역산 체형 판정 카드 — 단계별 꼬리표·색·설명(시안 E03 5단계 · F32 6단계 문구 그대로, 나머지 단계는 같은 말투로).
 * 설명은 lib/nutrition/guidelines 의 BCS_DESCRIPTIONS 를 보호자 말투로 옮긴 것 — 이상적(5)은 꼬리표가 이미
 * '이상적'이라 설명에서 반복하지 않는다(앱시안 결정 3번 '이상적 중복').
 */
const BCS_RESULT: Record<BcsKey, { tag: string; tone: 'good' | 'warn' | 'bad'; desc: string }> = {
  1: { tag: '관리 필요', tone: 'bad', desc: '심한 저체중이에요 — 갈비뼈·등뼈·골반뼈가 멀리서도 보이고, 근육이 줄었어요.' },
  2: { tag: '주의', tone: 'warn', desc: '저체중이에요 — 갈비뼈가 쉽게 보이고 만져지며, 허리가 매우 잘록해요.' },
  3: { tag: '주의', tone: 'warn', desc: '약간 저체중이에요 — 갈비뼈가 만져지고 윤곽이 보이며, 허리가 잘록해요.' },
  4: { tag: '양호', tone: 'good', desc: '약간 마른 편이에요 — 갈비뼈가 쉽게 만져지고, 옆에서 보면 배 라인이 살짝 들어가요.' },
  5: { tag: '이상적', tone: 'good', desc: '갈비뼈는 만져지지만 보이지 않고,\n허리·배 라인이 깔끔해요.' },
  6: { tag: '주의', tone: 'warn', desc: '약간 과체중이에요 — 갈비뼈가 조금 어렵게 만져지고, 허리 라인이 흐려져요.' },
  7: { tag: '주의', tone: 'warn', desc: '과체중이에요 — 갈비뼈를 만지기 어렵고, 허리 라인이 거의 사라졌어요.' },
  8: { tag: '관리 필요', tone: 'bad', desc: '비만이에요 — 갈비뼈를 만지기 매우 어렵고, 배가 처지고 허리가 사라졌어요.' },
  9: { tag: '관리 필요', tone: 'bad', desc: '심한 비만이에요 — 가슴·등·허리에 지방이 두껍고, 배가 크게 처졌어요.' },
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

// 사진 = 답 값 이름(ai2-ribs-thin/ideal/over/obese = 보여요/살짝/꾹/잘 안). 줄바꿈 자리는 시안.
const RIBS_OPTIONS = [
  { v: 'visible', label: '안 만져도 보여요', img: '/survey/ai/ribs-visible.jpg' },
  { v: 'easy', label: '살짝 만지면\n느껴져요', img: '/survey/ai/ribs-easy.jpg' },
  { v: 'slight_pressure', label: '꾹 눌러야 느껴져요', img: '/survey/ai/ribs-slight_pressure.jpg' },
  { v: 'hard', label: '눌러도 잘 안\n느껴져요', img: '/survey/ai/ribs-hard.jpg' },
] as const

const WAIST_OPTIONS = [
  { v: 'clear', label: '잘록하게\n들어가요', img: '/survey/ai/waist-clear.jpg' },
  { v: 'slight', label: '살짝\n들어가요', img: '/survey/ai/waist-slight.jpg' },
  { v: 'none', label: '일자거나\n볼록해요', img: '/survey/ai/waist-none.jpg' },
] as const

const ABDOMEN_OPTIONS = [
  { v: 'tucked', label: '위로 올라가요', img: '/survey/ai/belly-tucked.jpg' },
  { v: 'level', label: '거의 일자예요', img: '/survey/ai/belly-level.jpg' },
  { v: 'sagging', label: '아래로 처져요', img: '/survey/ai/belly-sagging.jpg' },
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
          {petName(dogName)} 갈비뼈가
          <br />
          어떻게 만져지나요?
        </>
      }
      sub="양손으로 옆구리를 부드럽게 쓸어보세요"
    >
      <PhotoGrid
        options={RIBS_OPTIONS}
        value={value}
        onChange={(v) => onChange(v)}
        columns={2}
        gap={10}
        photoHeight={98}
        badge={{ size: 24, inset: 8 }}
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
      sub="갈비뼈 뒤에서 골반까지의 라인이에요"
    >
      <PhotoGrid
        options={WAIST_OPTIONS}
        value={value}
        onChange={(v) => onChange(v)}
        columns={3}
        gap={8}
        photoHeight={188}
        center
        badge={{ size: 22, inset: 6 }}
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
  const result = bcs !== null ? BCS_RESULT[bcs] : null
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
      sub="가슴 끝에서 뒷다리 쪽 배 라인이에요"
    >
      <div style={{ marginTop: 16 }}>
        <PhotoRows
          options={ABDOMEN_OPTIONS}
          value={value}
          onChange={(v) => onChange(v)}
          kind="body"
          ariaLabel="배"
        />
      </div>

      {/* 3문항 완성 → 역산 체형 판정 카드. "BCS" 대신 "체형 n단계 · 9단계 중"(브랜드 보이스: 전문용어 금지). */}
      {bcs !== null && result && (
        <div className="s-result" data-tone={result.tone} role="status">
          <span className="s-result-head">
            <strong>체형 {bcs}단계</strong>
            <span className="s-result-of">9단계 중</span>
            <span className="s-result-tag">{result.tag}</span>
          </span>
          <span className="s-result-desc">
            {result.desc.split('\n').map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </span>
        </div>
      )}

      {bcsConflict && (
        <div className="s-warnbox" role="status">
          <span className="s-warnbox-hd">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3.5l9.5 16.5h-19z" />
              <path d="M12 10v4.5" />
              <circle cx="12" cy="17.3" r="0.9" fill="currentColor" />
            </svg>
            {bcsConflict.title}
          </span>
          <span className="s-warnbox-body">
            {bcsConflict.detail}
            <br />
            <br />
            {bcsConflict.action}
          </span>
        </div>
      )}
    </ScreenShell>
  )
}

const TREND_OPTIONS = [
  { v: 'stable', label: '비슷해요' },
  { v: 'gained', label: '늘었어요' },
  { v: 'lost', label: '빠졌어요' },
  { v: 'unknown', label: '잘 모름' },
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
  /** [발명 모듈 D] 체중 측정 방법 — 신뢰도 입력. 접힌 채(사장님) → 링크로 여는 창. */
  weightMethod: WeightMethod
  setWeightMethod: (v: WeightMethod) => void
}) {
  const [methodOpen, setMethodOpen] = useState(false)
  return (
    <ScreenShell
      kicker="몸 상태"
      title={
        <>
          최근 6개월 동안
          <br />
          체중이 어떻게 변했나요?
        </>
      }
      sub="정확히 모르면 ‘잘 모름’도 괜찮아요"
    >
      <LabelBar style={{ marginTop: 24 }}>체중 변화</LabelBar>
      <Segmented
        style={{ marginTop: 12 }}
        options={TREND_OPTIONS}
        value={weightTrend}
        onChange={(v) => setWeightTrend(v)}
        ariaLabel="체중 변화"
      />

      <LabelBar optional style={{ marginTop: 16 }}>
        살이 잘 찌는 편인가요?
      </LabelBar>
      <Segmented
        style={{ marginTop: 12 }}
        options={[
          { v: 'yes', label: '네, 쉽게 쪄요' },
          { v: 'no', label: '아니요' },
        ]}
        value={easyKeeper}
        onChange={(v) => setEasyKeeper(v)}
        allowClear
        ariaLabel="살이 잘 찌는 편"
      />

      <TextLink style={{ marginTop: 16 }} onClick={() => setMethodOpen(true)}>
        체중을 어떻게 쟀는지 알려주기 (선택)
      </TextLink>
      <SurveySheet
        open={methodOpen}
        onClose={() => setMethodOpen(false)}
        title="체중을 어떻게 쟀어요?"
        optional
        sub="정확한 저울일수록 급여량을 더 정밀하게 계산해요"
      >
        <LineList
          style={{ marginTop: 12 }}
          options={METHOD_OPTIONS}
          value={weightMethod}
          onChange={(v) => setWeightMethod(v)}
          allowClear
          ariaLabel="체중 잰 방법"
        />
      </SurveySheet>
    </ScreenShell>
  )
}
