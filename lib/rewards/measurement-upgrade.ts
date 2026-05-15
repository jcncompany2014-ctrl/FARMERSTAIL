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

// audit #25: tier 3단계 분리 + 부분 보상.
// 이전: home_analog 가 MID (보상 X). eyeball → home_analog 정확도 +75% 향상인데 0P.
// 새: LOW (0.3-0.6) / MID (0.7) / HIGH (0.9-1.0). 단계별 부분 보상.
const WEIGHT_HIGH = new Set(['vet_scale', 'home_digital'])
const WEIGHT_MID = new Set(['home_analog'])
const WEIGHT_LOW = new Set(['unknown', 'eyeball', 'hold'])

const ACTIVITY_HIGH = new Set(['pedometer', 'gps'])
const ACTIVITY_LOW = new Set(['unknown', 'subjective'])

const FEED_HIGH = new Set(['scale', 'auto_delivery'])
const FEED_LOW = new Set(['unknown', 'eyeball', 'cup'])

export type MethodKind = 'weight' | 'activity' | 'feed'
export type UpgradeTier = 'low_to_mid' | 'mid_to_high' | 'low_to_high' | null

/**
 * 업그레이드 tier 판정. null 이면 보상 없음.
 */
export function upgradeTier(
  kind: MethodKind,
  prev: string | null | undefined,
  next: string | null | undefined,
): UpgradeTier {
  if (!next) return null
  const sets =
    kind === 'weight'
      ? { LOW: WEIGHT_LOW, MID: WEIGHT_MID, HIGH: WEIGHT_HIGH }
      : kind === 'activity'
        ? { LOW: ACTIVITY_LOW, MID: new Set<string>(), HIGH: ACTIVITY_HIGH }
        : { LOW: FEED_LOW, MID: new Set<string>(), HIGH: FEED_HIGH }
  const prevKey = prev ?? 'unknown'
  const prevLow = sets.LOW.has(prevKey)
  const prevMid = sets.MID.has(prevKey)
  const nextMid = sets.MID.has(next)
  const nextHigh = sets.HIGH.has(next)
  if (prevLow && nextHigh) return 'low_to_high'
  if (prevLow && nextMid) return 'low_to_mid'
  if (prevMid && nextHigh) return 'mid_to_high'
  return null
}

/**
 * @deprecated 호환용 — 새 코드는 upgradeTier 사용. tier 가 'low_to_high' 면 true.
 */
export function isUpgrade(
  kind: MethodKind,
  prev: string | null | undefined,
  next: string | null | undefined,
): boolean {
  return upgradeTier(kind, prev, next) === 'low_to_high'
}

export const UPGRADE_REWARD_AMOUNT = 1000 // P (low_to_high 또는 legacy)
export const UPGRADE_REWARD_PARTIAL = 500 // P (low_to_mid / mid_to_high)

/** tier 별 보상 금액. */
export function rewardAmount(tier: UpgradeTier): number {
  if (tier === 'low_to_high') return UPGRADE_REWARD_AMOUNT
  if (tier === 'low_to_mid' || tier === 'mid_to_high') return UPGRADE_REWARD_PARTIAL
  return 0
}

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
