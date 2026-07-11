/**
 * 칼로리 v2 3단계 — M10 재측정 피드백 판정 (docs/CALORIE_ALGORITHM_SPEC_V2.md §6).
 *
 * "감산 지배형(낮게 시작)"의 안전을 보증하는 수렴 엔진. 2~4주 체중 변화율을
 * 보고 DER 을 ±10% 스텝으로 조정 제안한다. 시작 추정치의 개체차(±30%)를
 * 관찰로 흡수 — 정밀도의 진짜 출처는 재측정 루프(스펙 설계 원칙 5).
 *
 * 순수 판정만 — 실제 기록(reweighs)·알림·formula 반영은 호출부(cron)가.
 * 청구 금액에 닿는 자동 변경은 하지 않는다(제안 → 보호자 확인 흐름).
 */
import { feedbackAdjustment, type FeedbackGoal } from './engine.ts'

export interface ReweighInput {
  /** 현재 적용 중인 DER (formula.daily_kcal). */
  prevDer: number
  baselineWeightKg: number
  latestWeightKg: number
  /** baseline → latest 측정 간격 (일). */
  days: number
  /** 최신 분석 BCS — 목표(lose/gain/maintain) 유도. 없으면 maintain. */
  bcsScore?: number | null
}

export interface ReweighDecision {
  action: 'adjust' | 'hold' | 'insufficient'
  goal: FeedbackGoal
  weightDeltaPct: number
  newDer: number
  note: string
}

/** BCS → 피드백 목표. ≥6 감량 / ≤3 증량 / 그 외 유지. */
export function goalFromBcs(bcs?: number | null): FeedbackGoal {
  if (bcs != null && bcs >= 6) return 'lose'
  if (bcs != null && bcs <= 3) return 'gain'
  return 'maintain'
}

export function decideReweigh(i: ReweighInput): ReweighDecision {
  const goal = goalFromBcs(i.bcsScore)
  // 게이트: 2주 미만 간격·비정상 입력은 판정하지 않음 (스펙 "2~4주 재측정").
  if (
    i.days < 14 ||
    i.prevDer <= 0 ||
    i.baselineWeightKg <= 0 ||
    i.latestWeightKg <= 0
  ) {
    return {
      action: 'insufficient',
      goal,
      weightDeltaPct: 0,
      newDer: i.prevDer,
      note: '재측정 간격/입력 부족 — 판정 보류.',
    }
  }
  const weightDeltaPct =
    ((i.latestWeightKg - i.baselineWeightKg) / i.baselineWeightKg) * 100
  const fb = feedbackAdjustment(i.prevDer, weightDeltaPct, i.days, goal)
  return {
    action: fb.newDer !== i.prevDer ? 'adjust' : 'hold',
    goal,
    weightDeltaPct: +weightDeltaPct.toFixed(2),
    newDer: fb.newDer,
    note: fb.note,
  }
}
