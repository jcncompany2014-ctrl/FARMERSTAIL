/**
 * lineDailyGrams / dailyGramsFromMix — **비율은 칼로리에 적용**된다.
 *
 * 사장님 2026-07-15: "반반했는데 칼로리가 서로 다른 단백질을 고르면 하나가
 * 칼로리는 그대로지만 무게는 줄어야 하지 않아? 가격도 그에 맞춰져야 된다."
 * → 맞다. 이 규칙을 테스트로 못박는다.
 *
 * 핵심 회귀 방지:
 *  1. 50:50 = **칼로리** 반반. 무게는 밀도(kcal/100g)에 따라 다르다.
 *  2. `dailyGrams × 0.5` 로 나누면 안 된다 — 밀도가 다르면 실제 팩 무게와 어긋난다.
 *  3. 라인별 g 합 = 전체 g (두 함수가 같은 규칙을 쓴다).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  lineDailyGrams,
  dailyGramsFromMix,
  FOOD_LINE_META,
} from './lines.ts'
import type { FoodLine } from './types.ts'

// v4.0 확정(2026-07-18): 닭130·오리125·돼지125·소145 kcal/100g.
const CHICKEN: FoodLine = 'weight'
const DUCK: FoodLine = 'basic'
const BEEF: FoodLine = 'premium'
const PORK: FoodLine = 'joint'

describe('전제 — 레시피 밀도가 실제로 다르다', () => {
  it('닭 130 / 소 145 / 돼지 125 (v4.0)', () => {
    assert.equal(FOOD_LINE_META[CHICKEN].kcalPer100g, 130)
    assert.equal(FOOD_LINE_META[BEEF].kcalPer100g, 145)
    assert.equal(FOOD_LINE_META[PORK].kcalPer100g, 125)
  })
})

describe('lineDailyGrams — 칼로리 기준 분배', () => {
  it('단일 100% → 하루 칼로리 전부를 그 레시피 밀도로 환산', () => {
    // 184kcal / 1.30 = 141.5g
    assert.equal(+lineDailyGrams(CHICKEN, 1, 184).toFixed(1), 141.5)
    // 184kcal / 1.45 = 126.9g — 같은 칼로리인데 무게가 다르다
    assert.equal(+lineDailyGrams(BEEF, 1, 184).toFixed(1), 126.9)
  })

  it('밀도가 다른 50:50 → 칼로리는 같고 무게는 다르다 (사장님 케이스)', () => {
    const chickenG = lineDailyGrams(CHICKEN, 0.5, 184)
    const beefG = lineDailyGrams(BEEF, 0.5, 184)
    assert.equal(+chickenG.toFixed(1), 70.8)
    assert.equal(+beefG.toFixed(1), 63.4)
    assert.ok(chickenG > beefG, '밀도가 낮은 닭이 더 무거워야 한다')

    // 칼로리는 정확히 반반
    assert.equal(+((chickenG / 100) * 130).toFixed(1), 92.0)
    assert.equal(+((beefG / 100) * 145).toFixed(1), 92.0)
  })

  it('밀도가 같은 50:50 → 무게도 같다 (오리·돼지 둘 다 125)', () => {
    assert.equal(
      +lineDailyGrams(DUCK, 0.5, 184).toFixed(1),
      +lineDailyGrams(PORK, 0.5, 184).toFixed(1),
    )
  })

  it('무게를 반반으로 쪼개는 것과 다르다 (옛 버그)', () => {
    const total = dailyGramsFromMix(
      { basic: 0, weight: 0.5, skin: 0, premium: 0.5, joint: 0 },
      184,
    )
    const naiveHalf = total / 2 // ✗ 이렇게 하면 안 된다
    const realChicken = lineDailyGrams(CHICKEN, 0.5, 184)
    assert.notEqual(+naiveHalf.toFixed(1), +realChicken.toFixed(1))
  })

  it('비율 0 이거나 음수면 0 (NaN/음수 방어)', () => {
    assert.equal(lineDailyGrams(CHICKEN, 0, 184), 0)
    assert.equal(lineDailyGrams(CHICKEN, -1, 184), 0)
  })
})

describe('dailyGramsFromMix — 라인별 합과 일치', () => {
  it('50:50 총 g = 각 라인 g 의 합', () => {
    const ratios = { basic: 0, weight: 0.5, skin: 0, premium: 0.5, joint: 0 }
    const total = dailyGramsFromMix(ratios, 184)
    const sum =
      lineDailyGrams(CHICKEN, 0.5, 184) + lineDailyGrams(BEEF, 0.5, 184)
    assert.equal(total, Math.round(sum))
  })

  it('단일 100% 도 일치', () => {
    const ratios = { basic: 0, weight: 1, skin: 0, premium: 0, joint: 0 }
    assert.equal(
      dailyGramsFromMix(ratios, 184),
      Math.round(lineDailyGrams(CHICKEN, 1, 184)),
    )
  })

  it('칼로리가 크면 무게도 비례해 커진다', () => {
    const ratios = { basic: 0, weight: 1, skin: 0, premium: 0, joint: 0 }
    // 닭 130kcal/100g — 130kcal→100g, 260kcal→200g (반올림 오차 없이 정확히 2배)
    assert.equal(dailyGramsFromMix(ratios, 260), dailyGramsFromMix(ratios, 130) * 2)
  })
})
