import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  hasPancreatitisGate,
  isSeverePancreatitis,
  PANCREATITIS_CONSULT_REASON,
  PANCREATITIS_GATE_RULE_ID,
} from './consultation-gate.ts'

/** 급성·중증 췌장염 상담 게이트(2026-10-13 점검 E8). */
test('급성·중증 췌장염만 막는다 — 만성(경·중등)은 막지 않는다', () => {
  assert.equal(isSeverePancreatitis({ chronicConditions: ['pancreatitis'], diagnosedSeverity: { pancreatitis: 'severe' } }), true)
  assert.equal(isSeverePancreatitis({ chronicConditions: ['pancreatitis'], diagnosedSeverity: { pancreatitis: 'moderate' } }), false)
  assert.equal(isSeverePancreatitis({ chronicConditions: ['pancreatitis'], diagnosedSeverity: null }), false, '중증도 미입력 = 만성 취급')
  assert.equal(isSeverePancreatitis({ chronicConditions: ['kidney'], diagnosedSeverity: { pancreatitis: 'severe' } }), false, '진단 목록에 없으면 아님')
  assert.equal(isSeverePancreatitis({ chronicConditions: null, diagnosedSeverity: undefined }), false)
})

test('옛 저장 처방은 근거 ruleId 로 알아본다', () => {
  assert.equal(hasPancreatitisGate([{ ruleId: 'chronic-pancreatitis' }, { ruleId: PANCREATITIS_GATE_RULE_ID }]), true)
  assert.equal(hasPancreatitisGate([{ ruleId: 'chronic-pancreatitis' }]), false)
  assert.equal(hasPancreatitisGate(null), false)
  assert.equal(hasPancreatitisGate(undefined), false)
})

test('상담 안내 문구 — 처방·정확한 % 를 쓰지 않는다(고객 문구 규칙)', () => {
  assert.doesNotMatch(PANCREATITIS_CONSULT_REASON, /처방|\d+\s*%|언제든/)
  assert.match(PANCREATITIS_CONSULT_REASON, /상담/)
})
