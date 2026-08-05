import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPlausibleMer, MER_FACTOR_MIN, MER_FACTOR_MAX } from './merSanity.ts'
import { computeRer, calculateNutrition } from '../nutrition.ts'
import type { DogInfo, SurveyAnswers } from '../nutrition.ts'

test('조작 시나리오 — 청구액을 깎으려는 값은 전부 막힌다', () => {
  // 2026-08-05 감사에서 실증한 공격: analyses 를 브라우저가 INSERT 하므로
  // mer 을 임의 값으로 넣고 compute 를 호출하면 daily_kcal → 청구액이 따라간다.
  // 5kg 강아지의 RER 은 234kcal 대 — 아래 값들은 전부 물리적으로 불가능하다.
  for (const mer of [1, 5, 20, 50]) {
    assert.equal(isPlausibleMer(mer, 5), false, `mer=${mer} 이 통과했다`)
  }
  // 반대 방향(과다 청구를 노리는 값)도 막는다.
  assert.equal(isPlausibleMer(99_999, 5), false)
})

test('판정 불가는 통과가 아니다 — "검증 못 하면 통과"가 탈출구다(규칙2)', () => {
  assert.equal(isPlausibleMer(null, 5), false)
  assert.equal(isPlausibleMer(undefined, 5), false)
  assert.equal(isPlausibleMer(0, 5), false)
  assert.equal(isPlausibleMer(-100, 5), false)
  assert.equal(isPlausibleMer(NaN, 5), false)
  assert.equal(isPlausibleMer(Infinity, 5), false)
  assert.equal(isPlausibleMer(500, null), false) // 체중 미상
  assert.equal(isPlausibleMer(500, 0), false)
})

test('경계 — 허용 범위 안팎이 정확히 갈린다', () => {
  const rer = computeRer(10)
  // 경계값 자체는 부동소수 반올림에 걸릴 수 있으므로 안쪽/바깥쪽으로 살짝 민다.
  assert.equal(isPlausibleMer(rer * (MER_FACTOR_MIN + 0.001), 10), true)
  assert.equal(isPlausibleMer(rer * (MER_FACTOR_MAX - 0.001), 10), true)
  assert.equal(isPlausibleMer(rer * (MER_FACTOR_MIN - 0.01), 10), false)
  assert.equal(isPlausibleMer(rer * (MER_FACTOR_MAX + 0.01), 10), false)
})

test('★정상 고객은 어떤 조합으로도 안 걸린다 — 실제 엔진 출력으로 검산', () => {
  /**
   * 이 게이트의 유일한 실패 모드는 **정상 고객을 막는 것**이다(규칙5 가 refuse 를
   * 버린 이유와 같다). 그래서 허용 범위를 상상으로 정하지 않고, 실제
   * calculateNutrition 이 뱉는 mer 을 극단 조합으로 돌려 전부 통과하는지 본다.
   */
  const weights = [1.2, 2.5, 5, 10, 25, 45, 70]
  const stages: Array<[number, 'years' | 'months']> = [
    [2, 'months'],
    [6, 'months'],
    [1, 'years'],
    [7, 'years'],
    [15, 'years'],
  ]
  const bodies: SurveyAnswers['bodyCondition'][] = [
    'skinny',
    'slim',
    'ideal',
    'chubby',
    'obese',
  ]
  const activities: DogInfo['activityLevel'][] = ['low', 'medium', 'high']

  let checked = 0
  for (const weight of weights) {
    for (const [ageValue, ageUnit] of stages) {
      for (const bodyCondition of bodies) {
        for (const activityLevel of activities) {
          for (const neutered of [true, false]) {
            const nu = calculateNutrition(
              { weight, ageValue, ageUnit, neutered, activityLevel },
              { bodyCondition, allergies: [], healthConcerns: [] },
            )
            assert.equal(
              isPlausibleMer(nu.mer, weight),
              true,
              `정상 고객이 막혔다 — ${weight}kg ${ageValue}${ageUnit} ${bodyCondition} ` +
                `${activityLevel} 중성화${neutered} → mer ${nu.mer} ` +
                `(factor ${(nu.mer / computeRer(weight)).toFixed(2)})`,
            )
            checked++
          }
        }
      }
    }
  }
  assert.ok(checked >= 600, `조합이 너무 적다(${checked})`)
})
