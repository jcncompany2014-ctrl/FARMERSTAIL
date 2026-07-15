/**
 * 체중 ↔ 체형(BCS) 모순 검증.
 *
 * 사장님 2026-07-14: "살이 빠졌는데 체형이 더 뚱뚱해질 수는 없는 거잖아?
 * 근데 만약 고객이 그런 식으로 입력을 해버리면 이상하다고 해야 하는 거 아녀?"
 *
 * # 왜 필요한가
 * 체형(BCS)은 관찰 3문항(갈비뼈·허리·배)에서 역산되고, 체중은 따로 입력된다.
 * 두 값은 서로 독립이라 물리적으로 앞뒤가 안 맞는 조합이 들어올 수 있다.
 * 그대로 두면 그 위에서 계산된 급여량 전체가 틀어진다 — 계산 전에 짚어야 한다.
 *
 * # 판정 (이전 분석이 있을 때만 — 비교 대상이 있어야 성립)
 *  · 체중 3%+ 감소 + BCS 1점+ 상승 → 모순. 살이 빠졌는데 더 통통해질 수 없다.
 *  · 체중 3%+ 증가 + BCS 1점+ 하락 → 모순. 단 **성장기(자견)는 예외** —
 *    키가 크면서 체중은 늘고 체형은 날씬해지는 게 정상이다.
 *
 * # 막지 않는다
 * 경고만 하고 진행은 시킨다(사장님 확정). 둘 다 맞을 수도 있고(측정 오차·
 * 관찰 착오), 보호자를 설문 중간에 가두면 이탈한다. 대신 그대로 제출되면
 * 분석에 플래그로 남겨 수의 상담을 권한다.
 *
 * # 왜 3% 인가
 * 가정용 저울 오차·식사 전후·털 상태로 1~2%는 흔들린다. 3% 미만은 '측정 노이즈'
 * 로 보고 모순으로 치지 않는다(5kg 견 기준 150g).
 */
import { petName, iGa } from './korean.ts'

/** 이 미만의 체중 변화는 측정 노이즈로 보고 모순 판정하지 않는다. */
const MEANINGFUL_WEIGHT_PCT = 3
/** 토이견 역산 오차 방어 — 절대량도 이만큼은 움직여야 한다. */
const MEANINGFUL_WEIGHT_KG = 0.15

export type BcsConflictKind =
  /** 체중은 줄었는데 체형은 더 통통해졌다 — 사장님이 짚은 그 케이스. */
  | 'weight_down_bcs_up'
  /** 체중은 늘었는데 체형은 더 말라졌다 (성장기 제외). */
  | 'weight_up_bcs_down'

export interface BcsConflictInput {
  dogName: string
  /** 이전 분석의 BCS(1-9). 없으면 판정 불가 → null. */
  prevBcs?: number | null
  /** 이전 분석 당시 체중 kg (RER 역산). */
  prevWeightKg?: number | null
  /** 이번 설문에서 역산된 BCS(1-9). 3문항 미완성이면 null. */
  currentBcs?: number | null
  /** 지금 입력된 체중 kg. */
  currentWeightKg?: number | null
  /** 생애주기 — 'puppy' 면 체중↑ + 체형↓ 는 정상이라 모순으로 보지 않는다. */
  lifeStage?: 'puppy' | 'adult' | 'senior' | null
}

export interface BcsConflict {
  kind: BcsConflictKind
  /** 설문 중 인라인 경고 카드 제목. */
  title: string
  /** 무엇이 어긋났는지 — 숫자를 그대로 보여준다. */
  detail: string
  /** 어떻게 해달라는 부탁. */
  action: string
  /** 분석에 남길 짧은 라벨(수의 상담 권장 문구 포함). */
  flagLabel: string
  prevWeightKg: number
  currentWeightKg: number
  prevBcs: number
  currentBcs: number
}

/** BCS 점수 → 보호자가 알아듣는 말. */
function bcsWord(bcs: number): string {
  if (bcs <= 3) return '마른 편'
  if (bcs <= 5) return '이상적인 편'
  if (bcs <= 6) return '살짝 통통한 편'
  return '통통한 편'
}

/**
 * 체중과 체형이 서로 앞뒤가 맞는지 본다. 모순이면 경고 내용을, 아니면 null.
 * 비교 대상(이전 분석)이 없거나 값이 비면 항상 null — 조용히 통과시킨다.
 */
export function detectBcsWeightConflict(
  input: BcsConflictInput,
): BcsConflict | null {
  const { dogName, prevBcs, prevWeightKg, currentBcs, currentWeightKg } = input

  if (
    prevBcs == null ||
    currentBcs == null ||
    prevWeightKg == null ||
    currentWeightKg == null
  ) {
    return null
  }
  if (
    !Number.isFinite(prevWeightKg) ||
    !Number.isFinite(currentWeightKg) ||
    prevWeightKg <= 0 ||
    currentWeightKg <= 0
  ) {
    return null
  }

  const deltaKg = currentWeightKg - prevWeightKg
  const deltaPct = (deltaKg / prevWeightKg) * 100
  const bcsDelta = currentBcs - prevBcs

  const meaningful =
    Math.abs(deltaPct) >= MEANINGFUL_WEIGHT_PCT &&
    Math.abs(deltaKg) >= MEANINGFUL_WEIGHT_KG
  if (!meaningful || bcsDelta === 0) return null

  const name = petName(dogName)
  const prevW = prevWeightKg.toFixed(1)
  const curW = currentWeightKg.toFixed(1)

  // 체중 ↓ + 체형 ↑ — 사장님이 짚은 케이스.
  if (deltaPct <= -MEANINGFUL_WEIGHT_PCT && bcsDelta >= 1) {
    return {
      kind: 'weight_down_bcs_up',
      title: '체중과 체형이 서로 안 맞아요',
      detail: `체중은 ${prevW} → ${curW}kg으로 줄었는데, 체형은 지난번보다 통통해졌다고 나왔어요(${bcsWord(prevBcs)} → ${bcsWord(currentBcs)}).`,
      action:
        '살이 빠지면서 체형이 더 통통해지긴 어려워요. 체중을 다시 재보시거나, 갈비뼈·허리·배 관찰을 한 번 더 확인해 주세요.',
      flagLabel: '체중은 줄었는데 체형 점수는 올라감 · 수의 상담 권장',
      prevWeightKg,
      currentWeightKg,
      prevBcs,
      currentBcs,
    }
  }

  // 체중 ↑ + 체형 ↓ — 성장기엔 정상이므로 예외.
  if (deltaPct >= MEANINGFUL_WEIGHT_PCT && bcsDelta <= -1) {
    if (input.lifeStage === 'puppy') return null
    return {
      kind: 'weight_up_bcs_down',
      title: '체중과 체형이 서로 안 맞아요',
      detail: `체중은 ${prevW} → ${curW}kg으로 늘었는데, 체형은 지난번보다 말라졌다고 나왔어요(${bcsWord(prevBcs)} → ${bcsWord(currentBcs)}).`,
      action: `${iGa(name)} 근육이 붙은 경우라면 맞을 수 있어요. 그게 아니라면 체중이나 체형 관찰 중 하나를 다시 확인해 주세요.`,
      flagLabel: '체중은 늘었는데 체형 점수는 내려감 · 수의 상담 권장',
      prevWeightKg,
      currentWeightKg,
      prevBcs,
      currentBcs,
    }
  }

  return null
}
