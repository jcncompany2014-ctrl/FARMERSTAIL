/**
 * skuModel — v2.0 SSOT 검증.
 *
 * 핵심: 레시피에서 유도한 영양 프로파일이 레시피 명시값과 일치하는지
 * (특히 Ca:P 비율 — 유도 방법의 신빙성 검증).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  SKU_MODEL,
  ALL_PROTEINS,
  CARE_GOAL_PRIMARY,
  LEGACY_LINE_TO_PROTEIN,
  SLUG_TO_PROTEIN,
  getSku,
  proteinKeyOf,
} from './skuModel.ts'

describe('skuModel — 레시피 정합', () => {
  it('에너지밀도 = 레시피 sheet7 (닭130·오리150·돼지140·소160)', () => {
    assert.equal(SKU_MODEL.chicken.profile.kcalPer100g, 130)
    assert.equal(SKU_MODEL.duck.profile.kcalPer100g, 150)
    assert.equal(SKU_MODEL.pork.profile.kcalPer100g, 140)
    assert.equal(SKU_MODEL.beef.profile.kcalPer100g, 160)
  })

  // Ca:P 비율이 레시피 명시값(닭1.11·오리1.22·돼지1.10·소1.23)과 일치하면
  // target×충족률 유도 방법이 검증됨.
  it('Ca:P 비율이 레시피 명시값과 일치 (유도 검증)', () => {
    const expected: Record<string, number> = {
      chicken: 1.11,
      duck: 1.22,
      pork: 1.1,
      beef: 1.23,
    }
    for (const [p, exp] of Object.entries(expected)) {
      const sku = SKU_MODEL[p as keyof typeof SKU_MODEL]
      const ratio = sku.profile.calciumPctDM / sku.profile.phosphorusPctDM
      assert.ok(
        Math.abs(ratio - exp) < 0.03,
        `${p} Ca:P ${ratio.toFixed(3)} ≠ 레시피 ${exp}`,
      )
    }
  })

  it('모든 SKU Ca:P ∈ NIAS 안전범위 1.0~2.0', () => {
    for (const p of ALL_PROTEINS) {
      const sku = SKU_MODEL[p]
      const ratio = sku.profile.calciumPctDM / sku.profile.phosphorusPctDM
      assert.ok(ratio >= 1.0 && ratio <= 2.0, `${p} Ca:P ${ratio}`)
    }
  })

  it('단백질 %DM 고단백 (>35%, 레시피 화식)', () => {
    for (const p of ['chicken', 'duck', 'pork', 'beef'] as const) {
      assert.ok(SKU_MODEL[p].profile.proteinPctDM > 35)
    }
  })
})

describe('skuModel — 케어목표 매핑 (페르소나 정합)', () => {
  it('체중관리 → 닭 (모찌, 130kcal 최저)', () => {
    assert.equal(CARE_GOAL_PRIMARY.weight_management, 'chicken')
  })
  it('알레르기 회피 → 오리 (코코, 노블)', () => {
    assert.equal(CARE_GOAL_PRIMARY.allergy_avoid, 'duck')
    assert.equal(SKU_MODEL.duck.novel, true)
  })
  it('피부 → 연어 (보류)', () => {
    assert.equal(CARE_GOAL_PRIMARY.skin_coat, 'salmon')
    assert.equal(SKU_MODEL.salmon.deferred, true)
  })
  it('기호·노견 → 돼지 (토토, B1)', () => {
    assert.equal(CARE_GOAL_PRIMARY.joint_senior, 'pork')
  })
})

describe('skuModel — 매핑/통합', () => {
  it('LEGACY_LINE_TO_PROTEIN: basic→duck, weight→chicken (③-A 리바인드)', () => {
    assert.equal(LEGACY_LINE_TO_PROTEIN.basic, 'duck')
    assert.equal(LEGACY_LINE_TO_PROTEIN.weight, 'chicken')
    assert.equal(LEGACY_LINE_TO_PROTEIN.skin, 'salmon')
    assert.equal(LEGACY_LINE_TO_PROTEIN.premium, 'beef')
    assert.equal(LEGACY_LINE_TO_PROTEIN.joint, 'pork')
  })
  it('SLUG_TO_PROTEIN: chicken-basic → chicken', () => {
    assert.equal(SLUG_TO_PROTEIN['chicken-basic'], 'chicken')
    assert.equal(SLUG_TO_PROTEIN['duck-weight'], 'duck')
  })
  it('novel 플래그 — 오리·돼지·연어 novel, 닭·소 common', () => {
    assert.equal(SKU_MODEL.chicken.novel, false)
    assert.equal(SKU_MODEL.duck.novel, true)
    assert.equal(SKU_MODEL.pork.novel, true)
    assert.equal(SKU_MODEL.beef.novel, false)
    assert.equal(SKU_MODEL.salmon.novel, true)
  })
  it('Mueller 2016 유병률 — 소 34% 최고, 오리 0.5% 최저', () => {
    assert.equal(SKU_MODEL.beef.muellerAllergyRate, 34.0)
    assert.equal(SKU_MODEL.duck.muellerAllergyRate, 0.5)
  })
  it('proteinKeyOf — 미보유 단백질(lamb) → null', () => {
    assert.equal(proteinKeyOf('chicken'), 'chicken')
    assert.equal(proteinKeyOf('lamb'), null)
  })
  it('getSku — 전 단백질 정의 존재', () => {
    assert.equal(ALL_PROTEINS.length, 5)
    for (const p of ALL_PROTEINS) assert.equal(getSku(p).protein, p)
  })
})
