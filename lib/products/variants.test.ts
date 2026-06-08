/**
 * variants.ts characterization tests — Node native test runner.
 *
 * product_variants 유효가격/재고집계/기본선택 표시 로직(고객 PLP·PDP 노출)을
 * 고정한다. 가격이 잘못 표시되면 고객 영향이 직접적이라 회귀 가드 의미가 큼.
 * 코드 변경 없음 — 현재 동작을 그대로 핀고정.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  effectivePrice,
  hasSale,
  effectiveListPrice,
  variantPriceRange,
  aggregateStock,
  productStockState,
  defaultVariant,
  type ProductVariant,
} from './variants.ts'

let seq = 0
function v(p: Partial<ProductVariant> = {}): ProductVariant {
  seq += 1
  return {
    id: `var-${seq}`,
    product_id: 'prod-1',
    sku: null,
    name: `옵션 ${seq}`,
    option_values: {},
    price: null,
    sale_price: null,
    stock: 10,
    position: 0,
    is_active: true,
    ...p,
  }
}

describe('effectivePrice — sale 우선, 없으면 정가, 없으면 부모', () => {
  const parent = { price: 20000, sale_price: null as number | null }

  it('variant sale_price 있으면 그 값', () => {
    assert.equal(effectivePrice(v({ price: 18000, sale_price: 15000 }), parent), 15000)
  })

  it('variant sale 없고 parent sale 있으면 parent sale', () => {
    assert.equal(effectivePrice(v({ price: 18000 }), { price: 20000, sale_price: 12000 }), 12000)
  })

  it('sale 둘 다 없으면 variant.price', () => {
    assert.equal(effectivePrice(v({ price: 18000 }), parent), 18000)
  })

  it('variant.price 도 없으면 parent.price', () => {
    assert.equal(effectivePrice(v({ price: null }), parent), 20000)
  })

  it('sale_price 0 도 유효 값으로 취급(0 반환)', () => {
    assert.equal(effectivePrice(v({ sale_price: 0 }), parent), 0)
  })
})

describe('hasSale', () => {
  it('variant 또는 parent sale 있으면 true', () => {
    assert.equal(hasSale(v({ sale_price: 9000 }), { price: 20000, sale_price: null }), true)
    assert.equal(hasSale(v(), { price: 20000, sale_price: 9000 }), true)
  })
  it('둘 다 없으면 false', () => {
    assert.equal(hasSale(v(), { price: 20000, sale_price: null }), false)
  })
})

describe('effectiveListPrice', () => {
  it('variant.price 우선, 없으면 parent.price (sale 무시)', () => {
    assert.equal(effectiveListPrice(v({ price: 18000 }), { price: 20000 }), 18000)
    assert.equal(effectiveListPrice(v({ price: null }), { price: 20000 }), 20000)
  })
})

describe('variantPriceRange', () => {
  const parent = { price: 20000, sale_price: null }
  it('빈 배열 → null', () => {
    assert.equal(variantPriceRange([], parent), null)
  })
  it('활성 variant 없으면 → null', () => {
    assert.equal(variantPriceRange([v({ is_active: false })], parent), null)
  })
  it('활성들의 유효가격 min/max', () => {
    const range = variantPriceRange(
      [v({ price: 12000 }), v({ price: 28000 }), v({ price: 18000, is_active: false })],
      parent,
    )
    assert.deepEqual(range, { min: 12000, max: 28000 })
  })
  it('재고 0 variant 도 가격 범위에 포함', () => {
    const range = variantPriceRange([v({ price: 12000, stock: 0 }), v({ price: 25000 })], parent)
    assert.deepEqual(range, { min: 12000, max: 25000 })
  })
})

describe('aggregateStock — 활성만, 음수는 0 클램프', () => {
  it('활성 재고 합', () => {
    assert.equal(aggregateStock([v({ stock: 3 }), v({ stock: 7 })]), 10)
  })
  it('비활성 제외', () => {
    assert.equal(aggregateStock([v({ stock: 3 }), v({ stock: 100, is_active: false })]), 3)
  })
  it('음수 재고는 0 으로', () => {
    assert.equal(aggregateStock([v({ stock: -5 }), v({ stock: 4 })]), 4)
  })
})

describe('productStockState', () => {
  it('variants 비면 parent.stock 기준', () => {
    assert.equal(productStockState([], { stock: 0 }), 'out')
    assert.equal(productStockState([], { stock: 3 }), 'low') // <=5
    assert.equal(productStockState([], { stock: 50 }), 'in_stock')
  })
  it('variants 있으면 집계 기준', () => {
    assert.equal(productStockState([v({ stock: 0 }), v({ stock: 0 })], { stock: 999 }), 'out')
    assert.equal(productStockState([v({ stock: 2 }), v({ stock: 2 })], { stock: 0 }), 'low') // 합 4 <=5
    assert.equal(productStockState([v({ stock: 30 })], { stock: 0 }), 'in_stock')
  })
})

describe('defaultVariant — 재고 있는 position 첫째, 없으면 position 첫째', () => {
  it('빈 배열 → null', () => {
    assert.equal(defaultVariant([]), null)
  })
  it('활성 없으면 → null', () => {
    assert.equal(defaultVariant([v({ is_active: false })]), null)
  })
  it('재고 있는 것 중 position 최소', () => {
    const picked = defaultVariant([
      v({ position: 2, stock: 10, name: 'B' }),
      v({ position: 0, stock: 0, name: 'A품절' }),
      v({ position: 1, stock: 5, name: 'C' }),
    ])
    assert.equal(picked?.name, 'C') // position 1 이 재고 있는 것 중 최소
  })
  it('모두 품절이면 position 첫째 반환', () => {
    const picked = defaultVariant([
      v({ position: 1, stock: 0, name: '둘째' }),
      v({ position: 0, stock: 0, name: '첫째' }),
    ])
    assert.equal(picked?.name, '첫째')
  })
})
