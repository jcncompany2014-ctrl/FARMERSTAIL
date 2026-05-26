/**
 * nutrients-spec 단위 테스트. XL-1 (#19) 회귀 방지.
 *
 * 검증:
 *  1. NUTRIENTS 배열 정확히 38개
 *  2. 카테고리별 분포: crude 5 / energy 1 / amino 10 / fatty 2 /
 *     minerals 12 / vitamins 8
 *  3. evaluateAafcoCompliance: below / above / missing 분류
 *  4. nutrientsByCategory: 카테고리별 그룹화
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  NUTRIENTS,
  evaluateAafcoCompliance,
  nutrientsByCategory,
  CATEGORY_LABELS,
} from './nutrients-spec.ts'

describe('NUTRIENTS — invariant', () => {
  it('정확히 38개', () => {
    assert.equal(NUTRIENTS.length, 38)
  })

  it('카테고리별 분포 일치', () => {
    const grouped = nutrientsByCategory()
    assert.equal(grouped.crude.length, 5)
    assert.equal(grouped.energy.length, 1)
    assert.equal(grouped.amino.length, 10)
    assert.equal(grouped.fatty.length, 2)
    assert.equal(grouped.minerals.length, 12)
    assert.equal(grouped.vitamins.length, 8)
  })

  it('CATEGORY_LABELS — 모든 카테고리 한국어 라벨', () => {
    assert.ok(CATEGORY_LABELS.crude.length > 0)
    assert.ok(CATEGORY_LABELS.energy.length > 0)
    assert.ok(CATEGORY_LABELS.amino.length > 0)
    assert.ok(CATEGORY_LABELS.fatty.length > 0)
    assert.ok(CATEGORY_LABELS.minerals.length > 0)
    assert.ok(CATEGORY_LABELS.vitamins.length > 0)
  })

  it('key 중복 없음', () => {
    const keys = NUTRIENTS.map((n) => n.key)
    const uniqueKeys = new Set(keys)
    assert.equal(keys.length, uniqueKeys.size)
  })
})

describe('evaluateAafcoCompliance', () => {
  it('모든 값 누락 → 모든 min 항목 missing', () => {
    const result = evaluateAafcoCompliance({})
    assert.equal(result.below.length, 0)
    assert.equal(result.above.length, 0)
    // min 명시된 nutrient 다수
    assert.ok(result.missing.length > 20)
  })

  it('crude_protein 17% (미달 18%) → below 포함', () => {
    const result = evaluateAafcoCompliance({ crude_protein_pct: 17 })
    const proteinBelow = result.below.find(
      (n) => n.key === 'crude_protein_pct',
    )
    assert.ok(proteinBelow)
  })

  it('crude_protein 18% (충족) → below 미포함', () => {
    const result = evaluateAafcoCompliance({ crude_protein_pct: 18 })
    const proteinBelow = result.below.find(
      (n) => n.key === 'crude_protein_pct',
    )
    assert.equal(proteinBelow, undefined)
  })

  it('selenium 3 mg/kg (max 2 초과) → above 포함', () => {
    const result = evaluateAafcoCompliance({ selenium_mg_per_kg: 3 })
    const seBelow = result.above.find((n) => n.key === 'selenium_mg_per_kg')
    assert.ok(seBelow)
  })

  it('null 값 + min 있는 항목 → missing', () => {
    const result = evaluateAafcoCompliance({ crude_protein_pct: null })
    const proteinMissing = result.missing.find(
      (n) => n.key === 'crude_protein_pct',
    )
    assert.ok(proteinMissing)
  })

  it('iodine 6 (min 1 ~ max 11 사이) → 통과', () => {
    const result = evaluateAafcoCompliance({ iodine_mg_per_kg: 6 })
    const iBelow = result.below.find((n) => n.key === 'iodine_mg_per_kg')
    const iAbove = result.above.find((n) => n.key === 'iodine_mg_per_kg')
    assert.equal(iBelow, undefined)
    assert.equal(iAbove, undefined)
  })
})
