/**
 * nutrientPanel 단위 테스트.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeNutrientPanel,
  clinicalCheckForPanel,
} from './nutrientPanel.ts'

describe('computeNutrientPanel — 가중평균', () => {
  it('단일 라인 100% — 메타 그대로', () => {
    const p = computeNutrientPanel({
      basic: 1,
      weight: 0,
      skin: 0,
      premium: 0,
      joint: 0,
    })
    assert.equal(p.proteinPctDM, 26)
    assert.equal(p.fatPctDM, 12)
    assert.equal(p.kcalPer100g, 215)
  })

  it('basic 50 + weight 50 — 평균', () => {
    const p = computeNutrientPanel({
      basic: 0.5,
      weight: 0.5,
      skin: 0,
      premium: 0,
      joint: 0,
    })
    // basic protein=26, weight=28 → 27
    assert.equal(p.proteinPctDM, 27)
    // basic fat=12, weight=8 → 10
    assert.equal(p.fatPctDM, 10)
  })

  it('Ca/P/Na 메타 없으면 null', () => {
    const p = computeNutrientPanel({
      basic: 1,
      weight: 0,
      skin: 0,
      premium: 0,
      joint: 0,
    })
    assert.equal(p.calciumPctDM, null)
    assert.equal(p.phosphorusPctDM, null)
    assert.equal(p.sodiumPctDM, null)
    assert.equal(p.calciumPhosphorusRatio, null)
  })

  it('admin override 로 Ca/P/Na 주입', () => {
    const p = computeNutrientPanel(
      { basic: 1, weight: 0, skin: 0, premium: 0, joint: 0 },
      {
        basic: {
          kcalPer100g: 215,
          proteinPctDM: 26,
          fatPctDM: 12,
          calciumPctDM: 1.0,
          phosphorusPctDM: 0.8,
          sodiumPctDM: 0.3,
          subtitle: null,
          benefit: null,
        },
      },
    )
    assert.equal(p.calciumPctDM, 1.0)
    assert.equal(p.phosphorusPctDM, 0.8)
    assert.equal(p.sodiumPctDM, 0.3)
    assert.equal(p.calciumPhosphorusRatio, 1.25)
  })
})

describe('clinicalCheckForPanel', () => {
  const baseContext = {
    isPuppy: false,
    isLargeBreedPuppy: false,
    hasPancreatitis: false,
    hasCardiac: false,
    irisStage: null,
  }

  it('일반 성견 normal panel → passed', () => {
    const c = clinicalCheckForPanel(
      {
        proteinPctDM: 26,
        fatPctDM: 12,
        kcalPer100g: 215,
        calciumPctDM: null,
        phosphorusPctDM: null,
        sodiumPctDM: null,
        calciumPhosphorusRatio: null,
      },
      baseContext,
    )
    assert.equal(c.passed, true)
    assert.equal(c.warnings.length, 0)
  })

  it('puppy + protein 21% → 미달 warning', () => {
    const c = clinicalCheckForPanel(
      {
        proteinPctDM: 21,
        fatPctDM: 12,
        kcalPer100g: 215,
        calciumPctDM: null,
        phosphorusPctDM: null,
        sodiumPctDM: null,
        calciumPhosphorusRatio: null,
      },
      { ...baseContext, isPuppy: true },
    )
    assert.equal(c.passed, false)
    assert.ok(c.warnings.find((w) => w.code === 'protein-low'))
  })

  it('췌장염 + fat 16% → 초과 warning', () => {
    const c = clinicalCheckForPanel(
      {
        proteinPctDM: 26,
        fatPctDM: 16,
        kcalPer100g: 215,
        calciumPctDM: null,
        phosphorusPctDM: null,
        sodiumPctDM: null,
        calciumPhosphorusRatio: null,
      },
      { ...baseContext, hasPancreatitis: true },
    )
    assert.ok(c.warnings.find((w) => w.code === 'pancreatitis-fat-high'))
  })

  it('대형견 puppy + Ca:P 2.0 → 초과 warning', () => {
    const c = clinicalCheckForPanel(
      {
        proteinPctDM: 26,
        fatPctDM: 12,
        kcalPer100g: 215,
        calciumPctDM: 1.6,
        phosphorusPctDM: 0.8,
        sodiumPctDM: null,
        calciumPhosphorusRatio: 2.0,
      },
      { ...baseContext, isPuppy: true, isLargeBreedPuppy: true },
    )
    assert.ok(c.warnings.find((w) => w.code === 'large-puppy-ca-p'))
  })

  it('심장병 + sodium 0.4 → 초과 warning', () => {
    const c = clinicalCheckForPanel(
      {
        proteinPctDM: 26,
        fatPctDM: 12,
        kcalPer100g: 215,
        calciumPctDM: null,
        phosphorusPctDM: null,
        sodiumPctDM: 0.4,
        calciumPhosphorusRatio: null,
      },
      { ...baseContext, hasCardiac: true },
    )
    assert.ok(c.warnings.find((w) => w.code === 'cardiac-sodium-high'))
  })

  it('CKD Stage 3 + protein 25% → 초과 warning', () => {
    const c = clinicalCheckForPanel(
      {
        proteinPctDM: 25,
        fatPctDM: 12,
        kcalPer100g: 215,
        calciumPctDM: null,
        phosphorusPctDM: null,
        sodiumPctDM: null,
        calciumPhosphorusRatio: null,
      },
      { ...baseContext, irisStage: 3 },
    )
    assert.ok(c.warnings.find((w) => w.code === 'ckd-protein-high'))
  })
})
