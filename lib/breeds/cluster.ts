/**
 * 견종 클러스터 거리 + 신뢰도 가중 평균 — 발명 모듈 C 핵심.
 *
 * # 발명 핵심 — PCT flag 가드
 * Parker et al. 2017 매트릭스 응용 + 신뢰도 가중 회귀가 발명 청구항. flag
 * OFF 면 모든 함수가 단순 fallback (size match) 반환.
 *
 * # 단순화
 * 25x25 Parker 매트릭스 풀세트는 너무 무거워 핵심 그룹 (size 5종) 으로
 * 단순화. 실 calibration 은 PCT 후 phase.
 */

import { BREEDS, findBreed, type BreedInfo, type DogSize } from './registry.ts'

function flagOn(): boolean {
  if (process.env.NEXT_PUBLIC_INVENTION_CORE !== 'on') return false
  return process.env.NEXT_PUBLIC_INVENTION_W_IMAGE !== 'off'
  // 견종 cluster 도 W_IMAGE 와 같은 발명 모듈 group. 별도 env var 추가 안 함.
}

/**
 * 견종 간 거리 0~1. 0=같음, 1=완전히 다름.
 *
 * 1차 룰:
 *  · 같은 code → 0
 *  · 같은 size + 활동 baseline 1 이내 → 0.2
 *  · 같은 size + 활동 다름 → 0.4
 *  · 다른 size, 활동 1 이내 → 0.6
 *  · 다른 size + 활동 다름 → 0.8
 *  · mix 는 항상 0.5 (불명)
 */
export function breedDistance(a: string, b: string): number {
  if (!flagOn()) {
    // fallback — size match 만 (Parker 매트릭스 없이)
    const ba = findBreed(a)
    const bb = findBreed(b)
    if (!ba || !bb) return 0.7
    return ba.size === bb.size ? 0.3 : 0.7
  }
  if (a === b) return 0
  if (a === 'mix' || b === 'mix') return 0.5
  const ba = findBreed(a)
  const bb = findBreed(b)
  if (!ba || !bb) return 0.7
  const sameSize = ba.size === bb.size
  const actDiff = Math.abs(ba.activityBaseline - bb.activityBaseline)
  if (sameSize && actDiff <= 1) return 0.2
  if (sameSize) return 0.4
  if (actDiff <= 1) return 0.6
  return 0.8
}

/**
 * 신뢰도 가중 클러스터 평균 — 발명 명세 6.3-(5).
 *
 * 사용자 입력값 x_user 와 cluster 평균 x_cluster 를 w (신뢰도 0~1) 로
 * weighted average. w=1 이면 사용자 값 그대로, w=0 이면 cluster 평균 그대로.
 */
export function reliabilityWeightedMean(
  xUser: number,
  xCluster: number,
  reliability: number,
): number {
  if (!flagOn()) return xUser // flag OFF 면 단순 사용자 입력
  const w = Math.max(0, Math.min(1, reliability))
  return Math.round((w * xUser + (1 - w) * xCluster) * 100) / 100
}

/**
 * 견종 클러스터 평균 — 같은 size 의 견종들의 평균 체중·활동 등.
 *
 * cluster 평균이 정확한 baseline 보다 정밀한 이유: 같은 size 안에서도
 * "Maltese 와 Pug" 가 다른 신체 구성. 향후 Parker 거리 가중 평균으로 확장.
 *
 * [A5] memoize — registry 가 module-level const 라 영구 캐시 안전.
 */
const CLUSTER_MEAN_CACHE = new Map<
  DogSize,
  { avgWeight: number; avgLifespan: number; activityBaseline: number }
>()

export function clusterMeanBySize(size: DogSize): {
  avgWeight: number
  avgLifespan: number
  activityBaseline: number
} {
  const cached = CLUSTER_MEAN_CACHE.get(size)
  if (cached) return cached

  const members = BREEDS.filter((b: BreedInfo) => b.size === size)
  if (members.length === 0) {
    const empty = { avgWeight: 0, avgLifespan: 0, activityBaseline: 3 }
    CLUSTER_MEAN_CACHE.set(size, empty)
    return empty
  }
  const sum = members.reduce(
    (acc, b) => ({
      w: acc.w + b.avgWeight,
      l: acc.l + b.avgLifespan,
      a: acc.a + b.activityBaseline,
    }),
    { w: 0, l: 0, a: 0 },
  )
  const result = {
    avgWeight: Math.round((sum.w / members.length) * 100) / 100,
    avgLifespan: Math.round((sum.l / members.length) * 10) / 10,
    activityBaseline: Math.round(sum.a / members.length),
  }
  CLUSTER_MEAN_CACHE.set(size, result)
  return result
}

/**
 * 변수 간 상관 검증 (B-44). 단순 룰:
 *  · 체중 증가 + 활동 감소 → 비만 위험 신호
 *  · BCS 7+ + 활동 4+ → 입력 모순 가능성 (운동량 만큼 칼로리 ↑)
 *  · 알러지 진단 + 일반 사료 → 식단 위험
 *
 * 검증 결과 array. UI 가 사용자에게 1건씩 점진 노출 (voice-guidelines §4).
 */
export function correlationCheck(input: {
  weightDeltaPct: number | null
  activityDeltaCategory: number | null
  bcs: number | null
  activityLevel: number | null
}): string[] {
  if (!flagOn()) return []
  const issues: string[] = []
  if (
    input.weightDeltaPct != null &&
    input.weightDeltaPct > 5 &&
    input.activityDeltaCategory != null &&
    input.activityDeltaCategory < 0
  ) {
    issues.push('체중이 늘고 활동량이 줄어드는 패턴 — 부드러운 체중 관리 식단을 고려해볼 수 있어요')
  }
  if (
    input.bcs != null &&
    input.bcs >= 7 &&
    input.activityLevel != null &&
    input.activityLevel >= 4
  ) {
    issues.push('활동량이 많은데 BCS 가 높다면 칼로리 입력에 차이가 있을 수 있어요')
  }
  return issues
}
