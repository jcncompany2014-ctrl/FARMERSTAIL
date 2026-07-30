import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  itemDisplayName,
  subscriptionItemRows,
  type ItemProduct,
} from './subscriptionItems.ts'
import { computeBoxItems, subscribableItems } from './boxPricing.ts'
import type { BoxItem } from './boxPricing.ts'
import { LINE_TO_SLUG } from './skuMap.ts'

/**
 * 이 모듈이 만드는 행은 **화면 9곳 + 주문 원장(order_items)** 으로 흘러간다.
 * 가입과 처방 승인이 같은 함수를 써야 승인 후 갈라지지 않는다(그게 이 파일이
 * 생긴 이유 — 승인 시 갱신이 없어서 화면이 옛 레시피에 멈춰 있었다).
 */

function product(over: Partial<ItemProduct> & { slug: string }): ItemProduct {
  return {
    id: `id-${over.slug}`,
    name: over.name ?? over.slug,
    image_url: null,
    price: 1000,
    sale_price: 850,
    stock: 100,
    is_subscribable: true,
    nutrition_facts: null,
    ...over,
  }
}

function fakeItem(over: Partial<BoxItem<ItemProduct>>): BoxItem<ItemProduct> {
  return {
    slug: 'beef-premium',
    pct: 100,
    product: product({ slug: 'beef-premium', name: '한우' }),
    quantity: 14,
    packG: 165,
    dailyG: 330,
    mealG: 165,
    cycleG: 4620,
    deliveredG: 4620,
    cycleTotal: 100000,
    listCycleTotal: 120000,
    pricePerPack: 7150,
    listPricePerPack: 8580,
    ...over,
  }
}

test('메인 라인은 "한 끼" 분량으로 이름을 만든다', () => {
  const name = itemDisplayName(fakeItem({ line: 'premium', mealG: 165 }))
  assert.equal(name, '한우 (165g 한 끼)')
})

test('★ 토퍼는 "한 끼"가 아니라 팩 g — 하루에 뿌리는 양이다', () => {
  // line 이 없으면 토퍼다. '한 끼'라고 쓰면 틀린 말이 된다.
  const name = itemDisplayName(
    fakeItem({
      line: undefined,
      topper: 'vegetable',
      product: product({ slug: 'veg', name: '채소 토퍼' }),
      packG: 100,
      mealG: 30,
    }),
  )
  assert.equal(name, '채소 토퍼 (100g 팩)')
})

test('행에는 구독 id 와 product_id 가 실린다 (order_items 는 NOT NULL)', () => {
  const rows = subscriptionItemRows('sub-1', [fakeItem({ line: 'premium' })])
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0], {
    subscription_id: 'sub-1',
    product_id: 'id-beef-premium',
    quantity: 14,
    unit_price: 7150,
    product_name: '한우 (165g 한 끼)',
    product_image_url: null,
  })
})

test('unit_price 는 pricePerPack(표시 단가) — cycleTotal 이 아니다', () => {
  // pricePerPack 으로 합계를 만들면 10원 올림이 팩수만큼 증폭된다. 청구는
  // subscriptions.total_amount 로 한다는 사실을 여기서 고정해 둔다.
  const rows = subscriptionItemRows('s', [
    fakeItem({ line: 'premium', pricePerPack: 7150, cycleTotal: 100000 }),
  ])
  assert.equal(rows[0]!.unit_price, 7150)
  assert.notEqual(rows[0]!.unit_price, 100000)
})

test('★ 품절·구독불가는 행에 들어가지 않는다 (박스에 안 담기므로)', () => {
  // 화면·주문 원장에 담기지도 않는 품목이 남으면 "왜 이건 안 왔어요?"가 된다.
  const items = [
    fakeItem({ line: 'premium' }),
    fakeItem({
      slug: 'oos',
      line: 'weight',
      product: product({ slug: 'oos', name: '품절품', stock: 0 }),
    }),
    fakeItem({
      slug: 'nosub',
      line: 'skin',
      product: product({
        slug: 'nosub',
        name: '구독불가',
        is_subscribable: false,
      }),
    }),
  ]
  const rows = subscriptionItemRows('s', subscribableItems(items))
  assert.deepEqual(
    rows.map((r) => r.product_name),
    ['한우 (165g 한 끼)'],
  )
})

test('실제 계산(computeBoxItems)에서 나온 항목으로도 행이 만들어진다', () => {
  // fake 로만 테스트하면 BoxItem 모양이 바뀌었을 때 못 잡는다.
  // slug 는 LINE_TO_SLUG 정본에서 온다 — 손으로 적으면 매핑이 바뀔 때 조용히
  // 0개가 되고, 그러면 아래 루프가 안 돌아 테스트가 헛돈다(실제로 그랬다).
  const slug = LINE_TO_SLUG.premium!
  const products: Record<string, ItemProduct> = {
    [slug]: product({ slug, name: '한우' }),
  }
  const items = computeBoxItems({
    formula: {
      // 5개 라인이 **전부** 있는 레코드를 넘긴다 — 타입이 요구하는 모양이다.
      // (부분 레코드를 넘기면 gateAvailability 가 NaN 을 만들었고, 이제 0 으로
      //  채워 막지만 정상 사용을 테스트해야 한다.)
      lineRatios: { basic: 0, weight: 0, skin: 0, premium: 1, joint: 0 },
      toppers: { protein: 0, vegetable: 0 },
      dailyKcal: 500,
    },
    freshRatio: 1,
    products,
  })
  const rows = subscriptionItemRows('sub-x', subscribableItems(items))
  // ★ 이 단정이 없으면 rows 가 0개일 때 아래 루프가 안 돌아 **헛돌며 통과**한다
  //   (slug 매핑이 바뀌면 조용히 아무것도 검사하지 않게 된다).
  assert.ok(rows.length > 0, '행이 하나도 안 나왔다 — slug 매핑을 확인할 것')
  for (const r of rows) {
    assert.equal(r.subscription_id, 'sub-x')
    assert.ok(r.product_id.length > 0, 'product_id 가 있어야 한다')
    assert.ok(r.quantity > 0, 'quantity 가 있어야 한다')
    assert.ok(/\(\d+g (한 끼|팩)\)$/.test(r.product_name), r.product_name)
  }
})
