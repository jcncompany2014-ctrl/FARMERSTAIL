import test from 'node:test'
import {
  computeBoxItems,
  priceBox,
  priceForFormula,
  lineCycleTotal,
  displayPricePerPack,
  mealPortionG,
  topperPacksForCycle,
  subscribableItems,
  type BoxProduct,
} from './lib/personalization/boxPricing.ts'
import { applyDiscount, computeAutoDiscount } from './lib/discount.ts'
import { pickBetterDiscount } from './lib/promotions.ts'
import { SKU_PRICING } from './lib/pricing.ts'

const P = (price: number, sale: number | null, stock = 100): BoxProduct => ({
  slug: '',
  price,
  sale_price: sale,
  stock,
  is_subscribable: true,
})

// 실제 DB 가격 앵커 (lib/pricing.ts SKU_PRICING)
const products: Record<string, BoxProduct> = {
  'chicken-basic': { ...P(4800, 4080), slug: 'chicken-basic' },
  'duck-weight': { ...P(5400, 4590), slug: 'duck-weight' },
  'pork-joint': { ...P(6100, 5185), slug: 'pork-joint' },
  'beef-premium': { ...P(8300, 7055), slug: 'beef-premium' },
  'farm-protein-mix': { ...P(9000, 8000), slug: 'farm-protein-mix' },
  'garden-layer-cake-summer': { ...P(7000, 6000), slug: 'garden-layer-cake-summer' },
}

const NO_TOP = { protein: 0, vegetable: 0 }
const R = (o: Partial<Record<string, number>>) => ({
  basic: 0, weight: 0, skin: 0, premium: 0, joint: 0, ...o,
}) as never

function line(label: string, v: unknown) {
  console.log(label, JSON.stringify(v))
}

test('A. 반올림 함수 단독', () => {
  line('lineCycleTotal(4080,165,14)=', lineCycleTotal(4080, 165, 14))
  line('raw 4080*1.65*14=', 4080 * 1.65 * 14)
  line('displayPricePerPack(94300,14)=', displayPricePerPack(94300, 14))
  line('perPack*14 =', displayPricePerPack(94300, 14) * 14)
  line('mealPortionG(0.0001)=', mealPortionG(0.0001))
  line('mealPortionG(NaN)=', mealPortionG(NaN))
  line('lineCycleTotal(4080,NaN,14)=', lineCycleTotal(4080, NaN, 14))
  line('topperPacksForCycle(0)=', topperPacksForCycle(0))
  line('topperPacksForCycle(NaN)=', topperPacksForCycle(NaN))
  line('displayPricePerPack(NaN,14)=', displayPricePerPack(NaN, 14))
})

test('B. freshRatio 비례성 — 같은 강아지 30/50/100', () => {
  for (const kcal of [80, 184, 400, 900, 2400]) {
    const row: Record<string, unknown> = { kcal }
    for (const fr of [30, 50, 100]) {
      const { total } = priceForFormula({
        formula: { lineRatios: R({ weight: 1 }), toppers: NO_TOP, dailyKcal: kcal },
        freshRatio: fr,
        products,
      })
      row['f' + fr] = total
    }
    const r30 = (row.f30 as number) / (row.f100 as number)
    const r50 = (row.f50 as number) / (row.f100 as number)
    line('닭100% kcal=' + kcal, { ...row, ratio30: +r30.toFixed(4), ratio50: +r50.toFixed(4) })
  }
})

test('C. 2종 50:50 vs 1종 — 라인별 100원 올림 횟수', () => {
  for (const kcal of [184, 500, 1000]) {
    const one = priceForFormula({
      formula: { lineRatios: R({ weight: 1 }), toppers: NO_TOP, dailyKcal: kcal },
      freshRatio: 100, products,
    })
    const two = priceForFormula({
      formula: { lineRatios: R({ weight: 0.5, premium: 0.5 }), toppers: NO_TOP, dailyKcal: kcal },
      freshRatio: 100, products,
    })
    const items = computeBoxItems({
      formula: { lineRatios: R({ weight: 0.5, premium: 0.5 }), toppers: NO_TOP, dailyKcal: kcal },
      freshRatio: 100, products,
    })
    line('kcal=' + kcal, {
      one: one.total, two: two.total,
      lines: items.map((i) => ({ slug: i.slug, dailyG: +i.dailyG.toFixed(2), mealG: i.mealG, cycleTotal: i.cycleTotal, perPack: i.pricePerPack, perPackX14: i.pricePerPack * 14 })),
    })
  }
})

test('D. 몸무게 경계 — dailyKcal 극단', () => {
  for (const kcal of [0, 1, 5, 20, 50, 5000, 1e9]) {
    const { total } = priceForFormula({
      formula: { lineRatios: R({ weight: 1 }), toppers: NO_TOP, dailyKcal: kcal },
      freshRatio: 30, products,
    })
    const items = computeBoxItems({
      formula: { lineRatios: R({ weight: 1 }), toppers: NO_TOP, dailyKcal: kcal },
      freshRatio: 30, products,
    })
    line('kcal=' + kcal + ' fresh30', { total, mealG: items[0]?.mealG, dailyG: items[0]?.dailyG })
  }
})

test('E. NaN / null / 음수 오염 경로', () => {
  const bad = [NaN, null, undefined, -100, Infinity]
  for (const k of bad) {
    let out: unknown
    try {
      out = priceForFormula({
        formula: { lineRatios: R({ weight: 1 }), toppers: NO_TOP, dailyKcal: k as number },
        freshRatio: 100, products,
      })
    } catch (e) { out = 'THROW ' + (e as Error).message }
    line('dailyKcal=' + String(k), out)
  }
  // lineRatios 자체가 오염된 경우
  line('ratio=NaN', priceForFormula({
    formula: { lineRatios: R({ weight: NaN }), toppers: NO_TOP, dailyKcal: 500 },
    freshRatio: 100, products,
  }))
  line('ratio=-1(weight) +1(premium)', priceForFormula({
    formula: { lineRatios: R({ weight: -1, premium: 1 }), toppers: NO_TOP, dailyKcal: 500 },
    freshRatio: 100, products,
  }))
  line('freshRatio=NaN', priceForFormula({
    formula: { lineRatios: R({ weight: 1 }), toppers: NO_TOP, dailyKcal: 500 },
    freshRatio: NaN, products,
  }))
  line('freshRatio=-50', priceForFormula({
    formula: { lineRatios: R({ weight: 1 }), toppers: NO_TOP, dailyKcal: 500 },
    freshRatio: -50, products,
  }))
  line('freshRatio=1000', priceForFormula({
    formula: { lineRatios: R({ weight: 1 }), toppers: NO_TOP, dailyKcal: 500 },
    freshRatio: 1000, products,
  }))
})

test('F. 토퍼 — dailyKcal 0 인데 토퍼 비율 있음', () => {
  const items = computeBoxItems({
    formula: { lineRatios: R({ weight: 1 }), toppers: { protein: 0.2, vegetable: 0 }, dailyKcal: 0 },
    freshRatio: 100, products,
  })
  line('kcal=0 + 토퍼0.2', { total: priceBox(items).total, items: items.map(i => ({ slug: i.slug, q: i.quantity, cycleTotal: i.cycleTotal, dailyG: i.dailyG })) })
  const items2 = computeBoxItems({
    formula: { lineRatios: R({ weight: 1 }), toppers: { protein: 0.2, vegetable: 0 }, dailyKcal: 500 },
    freshRatio: 30, products,
  })
  line('kcal=500 fresh30 + 토퍼0.2', { total: priceBox(items2).total, items: items2.map(i => ({ slug: i.slug, q: i.quantity, cycleTotal: i.cycleTotal, dailyG: +i.dailyG.toFixed(2), cycleG: +i.cycleG.toFixed(1), deliveredG: i.deliveredG })) })
  // 토퍼 kcal 이 nutrition_facts 로 0 이면?
  const prodZero = { ...products, 'farm-protein-mix': { ...products['farm-protein-mix']!, nutrition_facts: { calories_kcal_per_100g: 0 } } }
  const items3 = computeBoxItems({
    formula: { lineRatios: R({ weight: 1 }), toppers: { protein: 0.2, vegetable: 0 }, dailyKcal: 500 },
    freshRatio: 100, products: prodZero,
  })
  line('토퍼 kcal_per_100g=0', { total: priceBox(items3).total, items: items3.map(i => ({ slug: i.slug, q: i.quantity, dailyG: i.dailyG, cycleTotal: i.cycleTotal })) })
})

test('G. 재고 0 / 구독불가 — 청구액', () => {
  const oos = { ...products, 'beef-premium': { ...products['beef-premium']!, stock: 0 } }
  const full = priceForFormula({
    formula: { lineRatios: R({ weight: 0.5, premium: 0.5 }), toppers: NO_TOP, dailyKcal: 800 },
    freshRatio: 100, products,
  })
  const withOos = priceForFormula({
    formula: { lineRatios: R({ weight: 0.5, premium: 0.5 }), toppers: NO_TOP, dailyKcal: 800 },
    freshRatio: 100, products: oos,
  })
  const itemsOos = computeBoxItems({
    formula: { lineRatios: R({ weight: 0.5, premium: 0.5 }), toppers: NO_TOP, dailyKcal: 800 },
    freshRatio: 100, products: oos,
  })
  line('정상 vs 소 품절', { full: full.total, oos: withOos.total, 담긴칼로리비율: subscribableItems(itemsOos).length + '/' + itemsOos.length })
  // 모든 라인 품절
  const allOos = Object.fromEntries(Object.entries(products).map(([k, v]) => [k, { ...v, stock: 0 }]))
  line('전부 품절', priceForFormula({
    formula: { lineRatios: R({ weight: 1 }), toppers: NO_TOP, dailyKcal: 800 },
    freshRatio: 100, products: allOos,
  }))
  // 제품 조회에 아예 없음 (is_active=false)
  line('제품행 없음', priceForFormula({
    formula: { lineRatios: R({ weight: 1 }), toppers: NO_TOP, dailyKcal: 800 },
    freshRatio: 100, products: {},
  }))
})

test('H. 게이트 — 연어(skin) 100% 처방', () => {
  const items = computeBoxItems({
    formula: { lineRatios: R({ skin: 1 }), toppers: NO_TOP, dailyKcal: 800 },
    freshRatio: 100, products,
  })
  line('skin 1.0 → ', { total: priceBox(items).total, items: items.map(i => ({ slug: i.slug, pct: i.pct, mealG: i.mealG, cycleTotal: i.cycleTotal })) })
  // skin 이 available 처럼 보이게 salmon 제품을 넣으면?
  const withSalmon = { ...products, 'salmon-skin': { ...P(9000, 7650), slug: 'salmon-skin' } }
  const it2 = computeBoxItems({
    formula: { lineRatios: R({ skin: 1 }), toppers: NO_TOP, dailyKcal: 800 },
    freshRatio: 100, products: withSalmon,
  })
  line('salmon 제품 존재 시', { total: priceBox(it2).total, items: it2.map(i => ({ slug: i.slug, mealG: i.mealG, cycleTotal: i.cycleTotal })) })
})

test('I. 할인 — 중첩·극단', () => {
  const cases: Array<[number, number, number]> = [
    [100000, 0.1, 0], [100000, 0, 0.5], [100000, 0.1, 0.5],
    [100000, 0.1, 0.1], [100000, 0, 1], [100000, 0.1, 1],
    [1, 0.1, 0], [0, 0.1, 0], [-5000, 0.1, 0], [153100, 0.1, 0],
  ]
  for (const [subtotal, tierRate, promo] of cases) {
    const picked = pickBetterDiscount(
      { rate: tierRate, label: '나무 등급 할인' },
      promo > 0 ? { rate: promo, label: '이벤트 할인' } : null,
    )
    const d = applyDiscount(subtotal, picked.rate)
    line(`subtotal=${subtotal} tier=${tierRate} promo=${promo}`, {
      pickedRate: picked.rate, reason: picked.reason, discount: d, charge: subtotal - d,
    })
  }
  line('computeAutoDiscount(null)=', computeAutoDiscount({ tier: null }))
  line('computeAutoDiscount(mate)=', computeAutoDiscount({ tier: 'mate' }))
  line('applyDiscount(NaN,0.1)=', applyDiscount(NaN, 0.1))
  line('applyDiscount(100000,NaN)=', applyDiscount(100000, NaN))
  line('applyDiscount(100000,Infinity)=', applyDiscount(100000, Infinity))
  line('pickBetter(NaN tier)=', pickBetterDiscount({ rate: NaN, label: 't' }, { rate: 0.5, label: 'p' }))
})

test('J. pricing.ts 상수 vs 실제 DB 앵커 정합', () => {
  line('SKU_PRICING', SKU_PRICING)
  for (const [k, v] of Object.entries(SKU_PRICING)) {
    line(k + ' 15%검산', {
      listPer100g: v.listPer100g,
      계산: Math.round(v.listPer100g * 0.85),
      저장: v.subPer100g,
      pack500: v.listPack500g,
      pack500div5: v.listPack500g / 5,
    })
  }
})

test('K. 실제 시나리오 — 5kg / 30kg 강아지 2주 청구액', () => {
  // RER=70*w^0.75, MER≈RER*1.6 대략치로 kcal 잡고 확인
  for (const w of [1, 3, 5, 10, 20, 40, 70]) {
    const rer = 70 * Math.pow(w, 0.75)
    const kcal = Math.round(rer * 1.6)
    const out: Record<string, unknown> = { w, kcal }
    for (const fr of [30, 50, 100]) {
      out['f' + fr] = priceForFormula({
        formula: { lineRatios: R({ weight: 1 }), toppers: NO_TOP, dailyKcal: kcal },
        freshRatio: fr, products,
      }).total
    }
    out['f30/f100'] = +((out.f30 as number) / (out.f100 as number)).toFixed(3)
    line('닭 100%', out)
  }
})
