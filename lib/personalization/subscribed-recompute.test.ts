import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  appliedLinesConflictWithAllergies,
  subscribedRecomputeDecision,
} from './subscribed-recompute.ts'

/**
 * 2026-09-25 출시 전 점검 3차 — 구독자가 재설문하면 compute 가 적용 중 처방을 덮어
 * 청구(옛 금액·옛 품목)와 포장(새 레시피)이 갈렸다. 안전 사유만 예외로 덮는다.
 */

// weight=닭, premium=소, joint=돼지, basic=오리 (skuModel LEGACY_LINE_TO_PROTEIN)
const CHICKEN_BEEF = { weight: 0.5, premium: 0.5 }

test('구독 없음 → 종전대로 덮는다 (가입 전 미세조정)', () => {
  const d = subscribedRecomputeDecision({
    hasLiveSubscription: false,
    appliedLineRatios: CHICKEN_BEEF,
    newAllergies: [],
    newNeedsConsultation: false,
  })
  assert.deepEqual(d, { overwrite: true, reason: 'no_subscription' })
})

test('★구독 중 + 안전 사유 없음(체중·선호 변화) → 덮지 않는다 — 재제안·동의 경로로', () => {
  const d = subscribedRecomputeDecision({
    hasLiveSubscription: true,
    appliedLineRatios: CHICKEN_BEEF,
    newAllergies: ['오리'], // 지금 포장 라인(닭·소)과 무관한 알레르기
    newNeedsConsultation: false,
  })
  assert.deepEqual(d, { overwrite: false, reason: 'deferred_to_proposal' })
})

test('★구독 중 + 새 알레르기가 지금 포장 라인과 겹침 → 즉시 덮는다(안전 우선)', () => {
  const d = subscribedRecomputeDecision({
    hasLiveSubscription: true,
    appliedLineRatios: CHICKEN_BEEF,
    newAllergies: ['닭·칠면조'],
    newNeedsConsultation: false,
  })
  assert.deepEqual(d, { overwrite: true, reason: 'allergy_conflict' })
})

test('구독 중 + 상담 필요 → 덮는다(상담 플래그가 저장 정본에 실려야 한다)', () => {
  const d = subscribedRecomputeDecision({
    hasLiveSubscription: true,
    appliedLineRatios: CHICKEN_BEEF,
    newAllergies: [],
    newNeedsConsultation: true,
  })
  assert.deepEqual(d, { overwrite: true, reason: 'needs_consultation' })
})

test('비율 0 인 라인은 겹침으로 치지 않는다', () => {
  assert.equal(appliedLinesConflictWithAllergies({ weight: 0, premium: 1 }, ['닭·칠면조']), false)
  assert.equal(appliedLinesConflictWithAllergies({ premium: 1 }, ['소고기']), true)
  assert.equal(appliedLinesConflictWithAllergies({}, ['소고기']), false)
})
