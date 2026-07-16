/**
 * 화식 전환 스케줄 — "첫 2주, 어떻게 바꿔주면 되나".
 *
 * # 왜 만드나 (2026-07-16)
 * 화식으로 갈아탈 때 제일 흔한 실패가 **급하게 바꿔서 배탈**이다. 무른 변이 나오면
 * 보호자는 "이 음식이 안 맞나 보다" 하고 그만둔다 — 실제로는 속도 문제인데.
 * 우리는 이미 `transitionStrategy`(화식 경험·장 예민도로 결정)를 **계산해서 저장까지
 * 하고 있었는데 고객에게 한 번도 안 보여줬다**(approve 페이지만 읽음). 그걸 날짜별
 * 급여표로 푼다.
 *
 * # ⚠️ 설계 원칙 — 숫자는 AI 에게 맡기지 않는다
 * 이 표는 **순수 함수**다. 살아 있는 동물이 먹을 양이라 환각이 섞이면 안 되고,
 * 재현·테스트가 되어야 한다. AI(/api/analysis/structured)는 같은 스키마에 transition
 * 을 만들 수 있지만, **AI 는 그 아이 사정을 읽고 '설명'을 붙이는 데만** 쓴다
 * (현재 사료 브랜드·만성질환·복용 약·변 상태 같은 건 규칙으로 못 푸는 영역).
 * 숫자=규칙 / 말=AI 로 갈라 두면, AI 가 실패해도 급여표는 멀쩡하다.
 *
 * # 근거
 * 개·고양이 식이 전환은 통상 7~10일에 걸쳐 기존식 비중을 단계적으로 낮추는 게 표준
 * (WSAVA 급여 가이드 일반 권고). 장이 예민하거나 화식이 처음이면 더 길게 잡는다 —
 * 우리 conservative 는 14일.
 */
import type { TransitionStrategy } from './personalization/types.ts'

export type TransitionStep = {
  /** 1일차부터. */
  day: number
  /** 기존 사료 비중 (%). */
  oldPct: number
  /** 파머스테일 화식 비중 (%). */
  newPct: number
}

/**
 * ⚠️ 목표는 **100% 가 아니라 보호자가 고른 화식 비율**이다.
 *
 * 우리 제품엔 이미 티어가 있다 — 곁들임 30 / 반반 60 / 완전 100. 곁들임 설명이
 * 그대로 "화식이 처음이라면 익숙해질 때까지 건사료와 섞어 급여하는 걸 권장"이다.
 * 즉 티어 자체가 한 겹의 전환이다. 여기서 또 100% 를 목표로 잡으면 **보호자가 고른
 * 비율을 무시하고 딴소리**를 하게 된다. 그래서 램프는 '목표 비율까지' 올라간다.
 */

export type TransitionPlan = {
  strategy: TransitionStrategy
  /** 도착점 — 보호자가 고른 화식 비율(30/60/100). */
  targetPct: number
  /** 며칠에 걸쳐 바꾸나. */
  totalDays: number
  /** 한 줄 요약 — 카드 제목 옆. */
  headline: string
  /** 왜 이 속도인지 — 보호자가 납득해야 지킨다. */
  why: string
  steps: TransitionStep[]
  /** 이 속도에서 꼭 지켜봐야 할 것. */
  watchFor: string
}

/**
 * 단계 정의 — 각 원소가 '며칠 동안 화식 N%'.
 * 표준 7일(gradual)을 기준으로, 처음/장 예민은 14일로 늘리고, 이미 화식을 자주 먹는
 * 아이는 3일만에 붙인다.
 */
const RAMPS: Record<TransitionStrategy, Array<{ days: number; frac: number }>> = {
  // 화식이 처음이거나 장이 예민 — 14일. 25%씩 4단계, 각 단계를 3~4일씩 버틴다.
  conservative: [
    { days: 4, frac: 0.25 },
    { days: 4, frac: 0.5 },
    { days: 3, frac: 0.75 },
    { days: 3, frac: 1 },
  ],
  // 화식을 가끔 먹어본 아이 — 표준 7일.
  gradual: [
    { days: 2, frac: 0.25 },
    { days: 2, frac: 0.5 },
    { days: 2, frac: 0.75 },
    { days: 1, frac: 1 },
  ],
  // 화식을 자주/매일 먹던 아이 — 이미 적응돼 있어 3일이면 충분.
  aggressive: [
    { days: 1, frac: 0.5 },
    { days: 1, frac: 0.75 },
    { days: 1, frac: 1 },
  ],
}

const COPY: Record<
  TransitionStrategy,
  { headline: string; why: string; watchFor: string }
> = {
  conservative: {
    headline: '2주에 걸쳐 천천히',
    why: '화식이 처음이거나 속이 예민한 아이는 천천히 바꿔야 탈이 없어요. 급하게 바꿔서 무른 변이 나오면 음식이 안 맞는 건지 속도가 빠른 건지 구분이 안 돼요.',
    watchFor:
      '변이 무르면 다음 단계로 넘어가지 말고 그 비율에서 2~3일 더 머물러 주세요.',
  },
  gradual: {
    headline: '일주일에 걸쳐',
    why: '화식을 조금 먹어본 아이라 일주일이면 충분해요. 그래도 한 번에 바꾸는 것보다 단계를 두는 게 속이 편해요.',
    watchFor: '변이 무르면 그 단계에서 하루 이틀 더 머물러 주세요.',
  },
  aggressive: {
    headline: '3일이면 충분',
    why: '이미 화식에 익숙한 아이라 길게 끌 필요가 없어요. 그래도 첫 끼부터 100%는 피해요.',
    watchFor: '평소와 다르게 변이 무르면 하루 정도 비율을 낮춰 주세요.',
  },
}

/**
 * 전환 스케줄 — 날짜별 기존 사료 : 화식 비율.
 *
 * @param strategy 알고리즘이 결정한 전환 전략(formula.transitionStrategy)
 */
export function buildTransitionPlan(
  strategy: TransitionStrategy,
  /** 보호자가 고른 화식 비율 (30 | 60 | 100). 램프의 **도착점**. */
  targetPct: number,
): TransitionPlan {
  const target = Math.max(0, Math.min(100, Math.round(targetPct)))
  const steps: TransitionStep[] = []
  let day = 1
  let prev = 0
  for (const phase of RAMPS[strategy]) {
    // 5% 단위로 반올림 — "화식 22.5%" 같은 걸 보호자가 계량할 수 없다.
    // 마지막 단계는 반올림 오차 없이 정확히 목표에 꽂는다.
    const raw = phase.frac === 1 ? target : Math.round((target * phase.frac) / 5) * 5
    // 반올림 때문에 뒤로 가는 일이 없게(예: 목표 30 에서 0.5→15, 0.75→25 는 OK).
    const newPct = Math.max(prev, Math.min(target, raw))
    prev = newPct
    for (let i = 0; i < phase.days; i++) {
      steps.push({ day, oldPct: 100 - newPct, newPct })
      day += 1
    }
  }
  return {
    strategy,
    targetPct: target,
    totalDays: steps.length,
    ...COPY[strategy],
    steps,
  }
}

/**
 * 표를 그리기 좋게 '단계'로 묶는다 — 14일치 14줄을 보여주면 아무도 안 읽는다.
 * "1~4일차 · 화식 25%" 처럼 같은 비율끼리 묶어 4줄로.
 */
export type TransitionPhase = {
  fromDay: number
  toDay: number
  oldPct: number
  newPct: number
}

export function groupTransitionPhases(plan: TransitionPlan): TransitionPhase[] {
  const out: TransitionPhase[] = []
  for (const s of plan.steps) {
    const last = out[out.length - 1]
    if (last && last.newPct === s.newPct) {
      last.toDay = s.day
    } else {
      out.push({ fromDay: s.day, toDay: s.day, oldPct: s.oldPct, newPct: s.newPct })
    }
  }
  return out
}
