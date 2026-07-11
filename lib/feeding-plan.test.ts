import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildFeedingPlan } from './feeding-plan.ts'

/**
 * 칼로리 v2 5단계(M9b) — 건사료 라벨 kcal 반영 회귀.
 * mix 시나리오의 건사료 g 이 신고 열량으로 계산되는지 (미신고 = 평균 350).
 */
describe('buildFeedingPlan — 건사료 kcal 폴백 (M9b)', () => {
  it('미신고 → 평균 350kcal/100g: 400kcal·50% mix → 사료 57g', () => {
    const plan = buildFeedingPlan({
      dogName: '테스트',
      dailyMerKcal: 400,
      budgetTier: null,
      customRatio: 0.5,
    })
    // 사료 몫 200kcal ÷ 3.5kcal/g = 57g
    assert.equal(plan.mixCalc.dry_food_g_per_day, 57)
  })

  it('라벨 400kcal/100g 신고 → 같은 조건에서 사료 50g (실제 열량 반영)', () => {
    const plan = buildFeedingPlan({
      dogName: '테스트',
      dailyMerKcal: 400,
      budgetTier: null,
      customRatio: 0.5,
      kibbleKcalPer100g: 400,
    })
    // 200kcal ÷ 4.0kcal/g = 50g
    assert.equal(plan.mixCalc.dry_food_g_per_day, 50)
  })

  it('비정상 신고(0 이하) → 평균값 폴백', () => {
    const plan = buildFeedingPlan({
      dogName: '테스트',
      dailyMerKcal: 400,
      budgetTier: null,
      customRatio: 0.5,
      kibbleKcalPer100g: 0,
    })
    assert.equal(plan.mixCalc.dry_food_g_per_day, 57)
  })
})
