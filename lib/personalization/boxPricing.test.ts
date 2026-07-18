import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  mealPortionG,
  lineCycleTotal,
  displayPricePerPack,
  topperPacksForCycle,
  computeBoxItems,
  priceBox,
} from './boxPricing.ts'

/**
 * 가격·분량 올림 규칙 회귀 가드 (사장님 2026-07-19 확정).
 *
 *  1. 그램 = 5g 단위 무조건 올림 (절대 내림 없음 — 처방량 미만 발송 금지)
 *  2. 최종가(라인 총액) = 원값 × 팩수를 100원 단위 올림, **총액에서 한 번만**
 *     (팩당 올림 ×14 증폭 금지)
 *  3. 팩당 표시가 = 최종가 ÷ 팩수, 1원 단위면 10원 올림
 *     → 팩당 × 팩수 ≥ 최종가 (고객 검산에서 올림이 안 드러나는 방향)
 *  4. 반올림·내림은 어디에도 없다
 */

describe('mealPortionG — 5g 단위 무조건 올림', () => {
  test('164g → 165g (올림)', () => {
    assert.equal(mealPortionG(164), 165)
  })
  test('161g → 165g (내림처럼 보이는 구간도 올림)', () => {
    assert.equal(mealPortionG(161), 165)
  })
  test('165g → 165g (경계값은 그대로)', () => {
    assert.equal(mealPortionG(165), 165)
  })
  test('0 이하 → 0', () => {
    assert.equal(mealPortionG(0), 0)
    assert.equal(mealPortionG(-3), 0)
  })
  test('불변식: 결과는 항상 입력 이상 + 5g 배수', () => {
    for (let g = 1; g <= 500; g += 7) {
      const out = mealPortionG(g)
      assert.ok(out >= g, `${g} → ${out} 내림 발생`)
      assert.equal(out % 5, 0, `${g} → ${out} 5g 배수 아님`)
      assert.ok(out - g < 5, `${g} → ${out} 과잉 올림`)
    }
  })
})

describe('lineCycleTotal — 100원 올림은 총액에서 한 번만', () => {
  test('닭 165g × 4,080원/100g × 14팩 = 94,248 → 94,300', () => {
    // raw = 1.65 × 4080 × 14 = 94,248 → 100원 올림 94,300.
    assert.equal(lineCycleTotal(4080, 165, 14), 94300)
  })
  test('팩당 선(先)올림 증폭 금지 — 총액올림이 항상 같거나 싸다', () => {
    // 옛 방식: 팩당 6,732 → 6,800 × 14 = 95,200 (952원 마크업).
    // 새 방식: 94,300 (52원 마크업). 차이 = 증폭 제거분.
    const packCeilStyle = Math.ceil((1.65 * 4080) / 100) * 100 * 14
    assert.ok(lineCycleTotal(4080, 165, 14) <= packCeilStyle)
    assert.equal(packCeilStyle - lineCycleTotal(4080, 165, 14), 900)
  })
  test('불변식: 원값 이상(내림 없음) + 100원 배수', () => {
    for (const unit of [4080, 4590, 5185, 7055, 4800, 8300]) {
      for (let g = 50; g <= 400; g += 15) {
        const raw = (g / 100) * unit * 14
        const total = lineCycleTotal(unit, g, 14)
        assert.ok(total >= raw, `${unit}·${g}g: ${total} < raw ${raw} 내림`)
        assert.ok(total - raw < 100, `${unit}·${g}g: 과잉 올림`)
        assert.equal(total % 100, 0)
      }
    }
  })
})

describe('displayPricePerPack — 최종가 ÷ 팩수, 10원 올림', () => {
  test('94,300 ÷ 14 = 6,735.7 → 6,740', () => {
    assert.equal(displayPricePerPack(94300, 14), 6740)
  })
  test('딱 떨어지면 그대로 (68,600 ÷ 14 = 4,900)', () => {
    assert.equal(displayPricePerPack(68600, 14), 4900)
  })
  test('★핵심 불변식: 팩당 × 팩수 ≥ 최종가 (검산해도 총액이 안 비싸다)', () => {
    for (let total = 10000; total <= 200000; total += 1357) {
      const per = displayPricePerPack(total, 14)
      assert.ok(per * 14 >= total, `${total}: ${per}×14=${per * 14} < 총액 — 들킴`)
      assert.equal(per % 10, 0, `${total}: 팩당 ${per} 10원 단위 아님`)
    }
  })
  test('팩수 0 → 0 (0 나눗셈 가드)', () => {
    assert.equal(displayPricePerPack(10000, 0), 0)
  })
})

describe('topperPacksForCycle — 무조건 올림 (±5% 내림 허용 폐지)', () => {
  test('105g 필요 → 2팩 (옛 규칙은 1팩 floor)', () => {
    assert.deepEqual(topperPacksForCycle(105), { packs: 2, deliveredG: 200 })
  })
  test('100g 정확 → 1팩', () => {
    assert.deepEqual(topperPacksForCycle(100), { packs: 1, deliveredG: 100 })
  })
  test('불변식: 발송량 ≥ 필요량', () => {
    for (let g = 1; g <= 900; g += 37) {
      const { deliveredG } = topperPacksForCycle(g)
      assert.ok(deliveredG >= g, `${g}g: ${deliveredG}g 미달 발송`)
    }
  })
})

describe('computeBoxItems + priceBox — 정본 일관성', () => {
  const products = {
    'FT-C01': { slug: 'FT-C01', price: 4800, sale_price: 4080, stock: 99, is_subscribable: true },
    'FT-B05': { slug: 'FT-B05', price: 8300, sale_price: 7055, stock: 99, is_subscribable: true },
  }
  const formula = {
    lineRatios: { basic: 0, weight: 0.5, skin: 0, premium: 0.5, joint: 0 },
    toppers: { vegetable: 0, protein: 0 },
    dailyKcal: 400,
  }

  test('총액 = Σ cycleTotal (팩당 표시가 합산 아님)', () => {
    const items = computeBoxItems({ formula, freshRatio: 100, products })
    const { total } = priceBox(items)
    assert.equal(total, items.reduce((s, it) => s + it.cycleTotal, 0))
    // 표시가 합(≥)과 구분되는지 — 같아질 수도 있지만 절대 총액보다 작지 않다.
    const displaySum = items.reduce((s, it) => s + it.pricePerPack * it.quantity, 0)
    assert.ok(displaySum >= total)
  })
  test('각 항목: 표시가×팩수 ≥ cycleTotal, cycleTotal은 100원 배수, 팩그램 5g 배수', () => {
    for (const fresh of [30, 60, 100]) {
      const items = computeBoxItems({ formula, freshRatio: fresh, products })
      for (const it of items) {
        assert.ok(it.pricePerPack * it.quantity >= it.cycleTotal)
        assert.equal(it.cycleTotal % 100, 0)
        assert.equal(it.packG % 5, 0)
        assert.ok(it.packG >= it.dailyG, '팩이 처방 일일량 미만')
      }
    }
  })
})
