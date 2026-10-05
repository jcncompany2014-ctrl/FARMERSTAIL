import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isCustomerSafeAiLine } from './ai-safe-line.ts'

test('실제 저장분의 영양소 % 줄은 걸러지고, 말로 된 행동·표준 간식 원칙은 남는다', () => {
  assert.equal(isCustomerSafeAiLine('단백질 32% 이상 사료 비중을 현재 식단에 조금씩 늘려 근손실 예방'), false)
  assert.equal(isCustomerSafeAiLine('BCS 4(정상)를 유지해요'), false)
  assert.equal(isCustomerSafeAiLine('Bristol 6/7 이면 급여량을 줄여 보세요'), false)
  assert.equal(isCustomerSafeAiLine('간식은 하루 열량의 10% 이내로 줄여 보세요'), true)
  assert.equal(isCustomerSafeAiLine('산책을 조금씩 늘려 보세요'), true)
  assert.equal(isCustomerSafeAiLine('간식을 20% 줄여 보세요'), false)
})
