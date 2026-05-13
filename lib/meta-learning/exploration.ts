/**
 * Exploration-Exploitation 균형 — 발명 명세 6.7 (B-83).
 *
 * 능동 개입 (nudge / push) 의 메시지·시점·채널 선택을 학습할 때, 이미
 * 잘 작동하는 옵션(exploit) 만 쓰면 더 좋은 옵션을 못 찾고, 무작위(explore)
 * 만 쓰면 사용자 경험이 흔들린다.
 *
 * # 알고리즘 — epsilon-greedy
 *  · 확률 ε: 무작위 선택 (explore)
 *  · 확률 1-ε: 가장 높은 reward 옵션 (exploit)
 *  · ε 는 시간에 따라 감소 (decaying)
 *
 * # PCT 핵심 — flag 가드
 * flag OFF 면 모든 selection 이 첫 번째 옵션 반환 (단순 fallback).
 */

export type Arm<T> = {
  id: string
  /** 옵션 본체 (메시지 변형 / 시점 / 채널 등) */
  value: T
  /** 누적 reward (push open rate, CTR 등) */
  reward: number
  /** 누적 시도 횟수 */
  trials: number
}

function flagOn(): boolean {
  if (process.env.NEXT_PUBLIC_INVENTION_CORE !== 'on') return false
  return process.env.NEXT_PUBLIC_INVENTION_META_LEARNING !== 'off'
}

/**
 * epsilon-greedy 선택. arms 의 reward/trials 평균을 비교해 가장 좋은 arm 또는
 * 무작위 arm 반환.
 *
 * @param arms — 후보 옵션 array. 최소 1개.
 * @param epsilon — 0~1 explore 확률. default 0.1 (10% explore)
 * @param random — 0~1 무작위 값 (테스트 용 injection 가능)
 */
export function epsilonGreedy<T>(
  arms: Arm<T>[],
  epsilon: number = 0.1,
  random: () => number = Math.random,
): Arm<T> | null {
  if (!flagOn()) {
    // fallback — 첫 arm 반환 (deterministic)
    return arms[0] ?? null
  }
  if (arms.length === 0) return null
  if (arms.length === 1) return arms[0]

  const eps = Math.max(0, Math.min(1, epsilon))
  if (random() < eps) {
    // explore — 무작위
    const idx = Math.floor(random() * arms.length)
    return arms[Math.min(idx, arms.length - 1)]
  }
  // exploit — best mean reward
  let best = arms[0]
  let bestMean = best.trials > 0 ? best.reward / best.trials : -Infinity
  for (const arm of arms.slice(1)) {
    const mean = arm.trials > 0 ? arm.reward / arm.trials : 0
    if (mean > bestMean) {
      best = arm
      bestMean = mean
    }
  }
  return best
}

/**
 * 시간에 따라 감소하는 epsilon — 초기엔 explore 많이, 후엔 exploit.
 *
 * epsilon(t) = max(0.01, epsilon_0 × decay^t)
 */
export function decayingEpsilon(
  totalTrials: number,
  initialEpsilon: number = 0.3,
  decay: number = 0.95,
  min: number = 0.01,
): number {
  const e = initialEpsilon * Math.pow(decay, totalTrials)
  return Math.max(min, e)
}

/**
 * arm 의 reward 업데이트 — 학습 신호. 다음 epsilonGreedy 호출이 더 좋은
 * arm 을 선호하도록.
 */
export function recordReward<T>(arm: Arm<T>, reward: number): Arm<T> {
  return {
    ...arm,
    reward: arm.reward + reward,
    trials: arm.trials + 1,
  }
}
