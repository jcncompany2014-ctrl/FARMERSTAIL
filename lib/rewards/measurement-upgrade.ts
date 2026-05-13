/**
 * 측정 도구 개선 보상 (사용자 A-12).
 *
 * 보호자가 측정 도구를 더 정확한 것으로 업그레이드하면 +1,000P 적립.
 * 멱등성: ledger 의 reference_type='measurement_upgrade' + reference_id=
 *   `${dog_id}:${method_kind}` 로 같은 dog 의 같은 측정 종류 업그레이드는
 *   1회만 보상.
 *
 * # 정의
 * "업그레이드" = 정확도가 낮은 그룹 → 정확도가 높은 그룹 으로 이동.
 *
 * # 정확도 그룹
 *  weight:
 *   - LOW : unknown / eyeball / hold
 *   - HIGH: vet_scale / home_digital / home_analog
 *  activity:
 *   - LOW : unknown / subjective
 *   - HIGH: pedometer / gps
 *  feed:
 *   - LOW : unknown / eyeball / cup
 *   - HIGH: scale / auto_delivery
 */

// [B12 fix] home_analog 그룹 일관성.
// reliability.ts 의 WEIGHT_METHOD_SCORE: vet_scale 1.0 / home_digital 0.9 /
// home_analog 0.7 / hold 0.6 / eyeball 0.4 / unknown 0.3
// 이전: home_analog 가 HIGH 그룹 — 0.7 인데 hold 0.6 보다 약간 높은 것 뿐.
// 새: home_analog 를 MID 로 분리. HIGH = vet_scale + home_digital 만. MID 는 보상 X.
const WEIGHT_HIGH = new Set([
  'vet_scale',
  'home_digital',
])
const WEIGHT_LOW = new Set(['unknown', 'eyeball', 'hold'])
// home_analog 는 LOW 도 HIGH 도 아닌 mid — 업그레이드 보상 안 함 (양방향).

const ACTIVITY_HIGH = new Set(['pedometer', 'gps'])
const ACTIVITY_LOW = new Set(['unknown', 'subjective'])

const FEED_HIGH = new Set(['scale', 'auto_delivery'])
const FEED_LOW = new Set(['unknown', 'eyeball', 'cup'])

export type MethodKind = 'weight' | 'activity' | 'feed'

/**
 * 업그레이드 여부 판정. true 면 호출처가 보상 RPC 호출.
 */
export function isUpgrade(
  kind: MethodKind,
  prev: string | null | undefined,
  next: string | null | undefined,
): boolean {
  if (!next) return false
  const prevLow =
    kind === 'weight'
      ? WEIGHT_LOW.has(prev ?? 'unknown')
      : kind === 'activity'
        ? ACTIVITY_LOW.has(prev ?? 'unknown')
        : FEED_LOW.has(prev ?? 'unknown')
  const nextHigh =
    kind === 'weight'
      ? WEIGHT_HIGH.has(next)
      : kind === 'activity'
        ? ACTIVITY_HIGH.has(next)
        : FEED_HIGH.has(next)
  return prevLow && nextHigh
}

export const UPGRADE_REWARD_AMOUNT = 1000 // P

export function rewardReason(kind: MethodKind): string {
  return kind === 'weight'
    ? '체중 측정 도구를 정확한 도구로 바꿔주신 응원 포인트'
    : kind === 'activity'
      ? '활동량 측정 도구를 정확한 도구로 바꿔주신 응원 포인트'
      : '급여량 측정 도구를 정확한 도구로 바꿔주신 응원 포인트'
}

export function makeReferenceId(dogId: string, kind: MethodKind): string {
  return `${dogId}:${kind}`
}
