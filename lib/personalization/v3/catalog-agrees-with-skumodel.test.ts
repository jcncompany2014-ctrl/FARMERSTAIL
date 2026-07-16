/**
 * SKU 정본이 **둘** 이다 — 갈라지지 못하게 박는다.
 *
 * `lib/personalization/skuModel.ts` 는 "추천 알고리즘 v2.0 단일 진실 소스(SSOT)",
 * `lib/personalization/v3/catalog.ts` 는 "Layer A 베이스 SKU 카탈로그 — 확정 4종
 * SSOT". 둘 다 자기가 정본이라 적어 두고, 둘 다 kcal·단백질·이름을 따로 들고 있다.
 * 2026-07-16 현재 값은 일치하지만 **일치를 지키는 장치가 없었다.**
 *
 * kcal 이 갈라지면 급여량이 갈라진다 — 살아 있는 동물이 먹을 양이다. 한쪽만 고치는
 * 사고를 막으려고 이 테스트를 둔다. 실제로 skuModel 헤더 주석이 옛 설계값
 * (닭130·오리150·돼지140·소160)에 멈춰 있던 전례가 있다.
 *
 * 통합할 거면 통합하고(그게 낫다), 그때까지는 이 테스트가 파수꾼이다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BASE_SKUS } from './catalog.ts'
import { SKU_MODEL, type ProteinKey } from '../skuModel.ts'

describe('v3/catalog ↔ skuModel — 두 정본이 같은 말을 하는가', () => {
  it('v3 카탈로그의 단백질은 전부 skuModel 에 있다', () => {
    for (const sku of BASE_SKUS) {
      assert.ok(
        SKU_MODEL[sku.protein as ProteinKey],
        `v3 에 '${sku.protein}' 가 있는데 skuModel 엔 없다`,
      )
    }
  })

  it('⚠️ kcal/100g 이 정확히 일치한다 (갈라지면 급여량이 갈라진다)', () => {
    for (const sku of BASE_SKUS) {
      const model = SKU_MODEL[sku.protein as ProteinKey]!
      assert.equal(
        sku.kcalPer100g,
        model.profile.kcalPer100g,
        `${sku.protein}: v3=${sku.kcalPer100g} vs skuModel=${model.profile.kcalPer100g}`,
      )
    }
  })

  it('한글 이름이 일치한다 (사장님 확정: 치킨 · 오리 · 흑돼지 · 한우)', () => {
    for (const sku of BASE_SKUS) {
      const model = SKU_MODEL[sku.protein as ProteinKey]!
      assert.equal(
        sku.nameKr,
        model.nameKo,
        `${sku.protein}: v3='${sku.nameKr}' vs skuModel='${model.nameKo}'`,
      )
    }
  })

  it('v3 는 출시된 4종만 담는다 (deferred 는 팔지 않는다)', () => {
    for (const sku of BASE_SKUS) {
      const model = SKU_MODEL[sku.protein as ProteinKey]!
      assert.ok(
        !model.deferred,
        `${sku.protein} 는 skuModel 에서 deferred(미출시)인데 v3 카탈로그에 있다`,
      )
    }
    assert.equal(BASE_SKUS.length, 4, '확정 4종')
  })

  it('skuModel 의 출시 SKU 는 전부 v3 카탈로그에 있다 (누락 방지)', () => {
    const inV3 = new Set<string>(BASE_SKUS.map((s) => s.protein))
    for (const [protein, def] of Object.entries(SKU_MODEL)) {
      if (def.deferred) continue
      assert.ok(inV3.has(protein), `${protein} 가 v3 카탈로그에 없다`)
    }
  })
})
