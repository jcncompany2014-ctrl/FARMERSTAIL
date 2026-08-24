import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  mealPortionG,
  lineCycleTotal,
  displayPricePerPack,
  topperPacksForCycle,
  computeBoxItems,
  subscribableItems,
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

describe('mealPortionG — 처방 그대로 (1g 올림만, 사장님 2026-08-24 처방=팩 동일)', () => {
  /**
   * 5g 올림 규칙(2026-07-19) 폐지 이력: "하루 42g 처방인데 45g 팩 값을 내는 건
   * 고객 입장에서 억울하다"(사장님 2026-08-24). 처방·팩·표시·청구가 한 숫자여야
   * 한다. 소수점 g 은 계량·표시가 불가능하니 1g 올림만 남긴다(내림 금지 유지).
   */
  test('42g → 42g (정수 처방은 그대로 = 팩과 동일)', () => {
    assert.equal(mealPortionG(42), 42)
  })
  test('42.4g → 43g (소수점만 1g 올림)', () => {
    assert.equal(mealPortionG(42.4), 43)
  })
  test('164g → 164g (옛 5g 규칙이면 165였을 값)', () => {
    assert.equal(mealPortionG(164), 164)
  })
  test('부동소수 잔재는 올림으로 오인하지 않는다', () => {
    assert.equal(mealPortionG(45.000000000001), 45)
  })
  test('0 이하 → 0', () => {
    assert.equal(mealPortionG(0), 0)
    assert.equal(mealPortionG(-3), 0)
  })
  test('불변식: 결과는 항상 입력 이상(내림 금지) + 정수 + 과잉 올림 없음', () => {
    for (let g = 0.3; g <= 500; g += 6.7) {
      const out = mealPortionG(g)
      assert.ok(out >= g - 1e-9, `${g} → ${out} 내림 발생`)
      assert.equal(out % 1, 0, `${g} → ${out} 정수 아님`)
      assert.ok(out - g < 1, `${g} → ${out} 과잉 올림`)
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
  /**
   * ★ 슬러그는 LINE_TO_SLUG 실물이어야 한다 (2026-07-31 수정).
   *
   * 여기 fixture 는 'FT-C01'·'FT-B05' 였는데 그건 지금 어디에도 없는 옛 SKU 코드다
   * (실물: chicken-basic · beef-premium). `computeBoxItems` 는 `products[slug]` 를
   * 못 찾으면 `continue` 하므로 **항목 0개**가 나왔고, 아래 검사들은 전부 빈 배열
   * 위에서 통과했다 — `0 === 0`, `for (…of [])`.
   * 즉 금액 정본(총액 = Σ cycleTotal · 팩당 표시가 합산 금지)을 지키던 시험이
   * **아무것도 지키지 않고** 있었다. 그래서 각 검사에 "항목이 실제로 나왔는가"를
   * 먼저 박는다 — 슬러그가 또 바뀌면 조용히 통과하는 대신 깨진다.
   */
  const products = {
    'chicken-basic': { slug: 'chicken-basic', price: 4800, sale_price: 4080, stock: 99, is_subscribable: true },
    'beef-premium': { slug: 'beef-premium', price: 8300, sale_price: 7055, stock: 99, is_subscribable: true },
  }
  const formula = {
    lineRatios: { basic: 0, weight: 0.5, skin: 0, premium: 0.5, joint: 0 },
    toppers: { vegetable: 0, protein: 0 },
    dailyKcal: 400,
  }

  test('총액 = Σ cycleTotal (팩당 표시가 합산 아님)', () => {
    const items = computeBoxItems({ formula, freshRatio: 100, products })
    assert.equal(items.length, 2, '항목이 0개면 아래 검사는 빈 배열 위에서 통과한다')
    const { total } = priceBox(items)
    assert.equal(total, items.reduce((s, it) => s + it.cycleTotal, 0))
    // 표시가 합(≥)과 구분되는지 — 같아질 수도 있지만 절대 총액보다 작지 않다.
    const displaySum = items.reduce((s, it) => s + it.pricePerPack * it.quantity, 0)
    assert.ok(displaySum >= total)
  })
  test('각 항목: 표시가×팩수 ≥ cycleTotal, cycleTotal은 100원 배수, 팩그램=처방 1g 올림', () => {
    for (const fresh of [30, 60, 100]) {
      const items = computeBoxItems({ formula, freshRatio: fresh, products })
      assert.equal(items.length, 2, `fresh=${fresh}: 항목 0개면 아래 루프가 안 돈다`)
      for (const it of items) {
        assert.ok(it.pricePerPack * it.quantity >= it.cycleTotal)
        assert.equal(it.cycleTotal % 100, 0)
        // 처방=팩 동일(사장님 2026-08-24): 정수 + 처방 이상 + 1g 미만 초과
        assert.equal(it.packG % 1, 0)
        assert.ok(it.packG >= it.dailyG - 1e-9, '팩이 처방 일일량 미만')
        assert.ok(it.packG - it.dailyG < 1, '팩이 처방보다 1g 이상 큼 — 억울 구간')
      }
    }
  })
})

describe('★ 조용히 빠지는 항목 — 피킹 리스트가 대조하는 그 로직', () => {
  /**
   * 재고 0·판매중지는 박스에서 **말없이** 빠진다:
   *   · `computeBoxItems` 는 상품 행이 없으면 `continue` (판매중지 = 조회에서 탈락)
   *   · `subscribableItems` 는 stock<=0 · is_subscribable=false 를 `filter`
   * 그래서 3종 레시피가 2종으로 포장돼 나갔고, 금액은 저장된 total_amount 로
   * 그대로 청구됐다 — 고객은 제값을 내고 덜 받는다(2026-07-31 발견).
   *
   * 피킹 리스트는 같은 순수 함수를 **전체 상품 목록**으로 한 번 더 돌려
   * "원래 담겼어야 할 것"과 차집합을 낸다. 그 대조가 성립하는지 여기서 박는다 —
   * 화면 코드가 아니라 이 성질이 깨지면 경고가 조용히 빈 배열이 된다.
   */
  const formula = {
    lineRatios: { basic: 0, weight: 0.5, skin: 0, premium: 0.5, joint: 0 },
    toppers: { vegetable: 0, protein: 0 },
    dailyKcal: 400,
  }
  const full = {
    'chicken-basic': { slug: 'chicken-basic', price: 4800, sale_price: 4080, stock: 99, is_subscribable: true },
    'beef-premium': { slug: 'beef-premium', price: 8300, sale_price: 7055, stock: 99, is_subscribable: true },
  }

  test('레시피가 2종을 부른다 (전제 — 이게 깨지면 아래 검산이 무의미)', () => {
    const items = subscribableItems(computeBoxItems({ formula, freshRatio: 100, products: full }))
    assert.equal(items.length, 2)
  })

  test('재고 0 은 담기지 않지만 "원래 담겼어야 할 것"에는 남는다', () => {
    const oos = { ...full, 'beef-premium': { ...full['beef-premium'], stock: 0 } }
    const packed = subscribableItems(computeBoxItems({ formula, freshRatio: 100, products: oos }))
    const intended = computeBoxItems({ formula, freshRatio: 100, products: oos })
    const packedSlugs = new Set(packed.map((it) => it.product.slug))
    const missing = intended.filter((it) => !packedSlugs.has(it.product.slug))

    assert.equal(packed.length, 1, '재고 0 은 포장 대상에서 빠져야 한다')
    assert.deepEqual(missing.map((m) => m.product.slug), ['beef-premium'])
    // 팩 수까지 나와야 사장님이 "무엇이 얼마나" 빠졌는지 안다.
    assert.ok(missing[0]!.quantity > 0)
  })

  test('판매중지(포장용 목록에서 빠진 상품)도 전체 목록으로는 잡힌다', () => {
    // 판매중지 = is_active=false → 포장용 조회(is_active=true)에서 아예 안 온다.
    const activeOnly = { 'chicken-basic': full['chicken-basic'] }
    const packed = subscribableItems(computeBoxItems({ formula, freshRatio: 100, products: activeOnly }))
    const intended = computeBoxItems({ formula, freshRatio: 100, products: full })
    const packedSlugs = new Set(packed.map((it) => it.product.slug))
    const missing = intended.filter((it) => !packedSlugs.has(it.product.slug))

    assert.equal(packed.length, 1)
    assert.deepEqual(missing.map((m) => m.product.slug), ['beef-premium'])
  })

  test('정상일 땐 누락이 0 — 경고가 상시로 뜨면 아무도 안 본다', () => {
    const packed = subscribableItems(computeBoxItems({ formula, freshRatio: 100, products: full }))
    const intended = computeBoxItems({ formula, freshRatio: 100, products: full })
    const packedSlugs = new Set(packed.map((it) => it.product.slug))
    assert.deepEqual(intended.filter((it) => !packedSlugs.has(it.product.slug)), [])
  })
})
