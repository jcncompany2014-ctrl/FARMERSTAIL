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
    assert.equal(p.kcalPer100g, 130)
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

  // 정상 범위 omega/vitD default — 개별 case 가 override.
  const NORM = {
    omega3PctDM: 0.5,
    omega6PctDM: 3.0,
    omega6to3Ratio: 6.0,
    vitaminDIuPer100gDM: 100, // 1000 IU/kg DM (AAFCO 500-3000 범위)
  } as const

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
        ...NORM,
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
        ...NORM,
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
        ...NORM,
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
        ...NORM,
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
        ...NORM,
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
        ...NORM,
      },
      { ...baseContext, irisStage: 3 },
    )
    assert.ok(c.warnings.find((w) => w.code === 'ckd-protein-high'))
  })

  // v1.6 audit Section 5 — omega-3 / omega-6:3 / vitamin D
  it('AAFCO EPA+DHA 0.05% → 미달 warning', () => {
    const c = clinicalCheckForPanel(
      {
        proteinPctDM: 26,
        fatPctDM: 12,
        kcalPer100g: 215,
        calciumPctDM: null,
        phosphorusPctDM: null,
        sodiumPctDM: null,
        calciumPhosphorusRatio: null,
        ...NORM,
        omega3PctDM: 0.05,
      },
      baseContext,
    )
    assert.ok(c.warnings.find((w) => w.code === 'omega3-low'))
  })

  it('심장병 + omega-3 0.2% → 권장 미달 warning', () => {
    const c = clinicalCheckForPanel(
      {
        proteinPctDM: 26,
        fatPctDM: 12,
        kcalPer100g: 215,
        calciumPctDM: null,
        phosphorusPctDM: null,
        sodiumPctDM: null,
        calciumPhosphorusRatio: null,
        ...NORM,
        omega3PctDM: 0.2,
      },
      { ...baseContext, hasCardiac: true },
    )
    assert.ok(c.warnings.find((w) => w.code === 'cardiac-omega3-low'))
  })

  it('omega-6:3 비율 35:1 → 과다 warning', () => {
    const c = clinicalCheckForPanel(
      {
        proteinPctDM: 26,
        fatPctDM: 12,
        kcalPer100g: 215,
        calciumPctDM: null,
        phosphorusPctDM: null,
        sodiumPctDM: null,
        calciumPhosphorusRatio: null,
        ...NORM,
        omega6to3Ratio: 35,
      },
      baseContext,
    )
    assert.ok(c.warnings.find((w) => w.code === 'omega-ratio-high'))
  })

  it('vitamin D 30 IU/100g (300 IU/kg) → 최소 미달', () => {
    const c = clinicalCheckForPanel(
      {
        proteinPctDM: 26,
        fatPctDM: 12,
        kcalPer100g: 215,
        calciumPctDM: null,
        phosphorusPctDM: null,
        sodiumPctDM: null,
        calciumPhosphorusRatio: null,
        ...NORM,
        vitaminDIuPer100gDM: 30,
      },
      baseContext,
    )
    assert.ok(c.warnings.find((w) => w.code === 'vitd-low'))
  })

  it('vitamin D 350 IU/100g (3500 IU/kg) → 상한 초과 (puppy 아닌)', () => {
    const c = clinicalCheckForPanel(
      {
        proteinPctDM: 26,
        fatPctDM: 12,
        kcalPer100g: 215,
        calciumPctDM: null,
        phosphorusPctDM: null,
        sodiumPctDM: null,
        calciumPhosphorusRatio: null,
        ...NORM,
        vitaminDIuPer100gDM: 350,
      },
      baseContext,
    )
    assert.ok(c.warnings.find((w) => w.code === 'vitd-high'))
  })

  it('대형견 puppy + vitamin D 600 IU/100g (6000 IU/kg) → 상한 초과', () => {
    const c = clinicalCheckForPanel(
      {
        proteinPctDM: 26,
        fatPctDM: 12,
        kcalPer100g: 215,
        calciumPctDM: null,
        phosphorusPctDM: null,
        sodiumPctDM: null,
        calciumPhosphorusRatio: null,
        ...NORM,
        vitaminDIuPer100gDM: 600,
      },
      { ...baseContext, isPuppy: true, isLargeBreedPuppy: true },
    )
    assert.ok(c.warnings.find((w) => w.code === 'vitd-large-puppy-high'))
  })
})
