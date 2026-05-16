import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  BREEDS,
  findBreed,
  findBreedByLabel,
  sizeFromBreedOrWeight,
} from './registry.ts'

/**
 * lib/breeds/registry.ts — 견종 registry + size 분류 (B-40).
 *
 * 회귀 가드:
 *  - 한국 견종 (진돗개/풍산개/삽살개) korean=true
 *  - size threshold (4/10/25/45kg)
 *  - weight 우선 / breed fallback / 둘 다 없으면 'medium'
 *  - code 중복 없음 (DB key 안정성)
 */

describe('BREEDS — registry 무결성', () => {
  it('40+ 견종 등록', () => {
    assert.ok(BREEDS.length >= 40, `${BREEDS.length} 개`)
  })

  it('code 중복 없음 (DB key)', () => {
    const codes = BREEDS.map((b) => b.code)
    assert.equal(new Set(codes).size, codes.length)
  })

  it('label 중복 없음 (사용자 친화 표시)', () => {
    const labels = BREEDS.map((b) => b.label)
    assert.equal(new Set(labels).size, labels.length)
  })

  it('모든 entry — size / avgWeight / avgLifespan / activityBaseline 필수', () => {
    for (const b of BREEDS) {
      assert.ok(b.size.length > 0)
      assert.ok(b.avgWeight > 0)
      assert.ok(b.avgLifespan > 0)
      assert.ok(
        b.activityBaseline >= 1 && b.activityBaseline <= 5,
        `${b.code} activityBaseline ${b.activityBaseline} out of [1,5]`,
      )
    }
  })

  it('size 카테고리 5종 모두 등록 (toy/small/medium/large/giant)', () => {
    const sizes = new Set(BREEDS.map((b) => b.size))
    for (const s of ['toy', 'small', 'medium', 'large', 'giant'] as const) {
      assert.ok(sizes.has(s), `size ${s} 미커버`)
    }
  })

  it('한국 견종 — 진돗개 / 풍산개 / 삽살개 (korean=true)', () => {
    const korean = BREEDS.filter((b) => b.korean === true)
    const codes = korean.map((b) => b.code)
    assert.ok(codes.includes('jindo'))
    assert.ok(codes.includes('pungsan'))
    assert.ok(codes.includes('sapsali'))
  })

  it('mix 견종 fallback entry (한국 흔한 케이스)', () => {
    const mix = findBreed('mix')
    assert.ok(mix)
    assert.equal(mix?.label, '믹스')
  })
})

describe('findBreed / findBreedByLabel', () => {
  it('정확한 code → entry', () => {
    const b = findBreed('shiba')
    assert.equal(b?.label, '시바이누')
    assert.equal(b?.size, 'medium')
  })

  it('존재하지 않는 code → undefined', () => {
    assert.equal(findBreed('unknown_breed'), undefined)
  })

  it('정확한 한글 label → entry', () => {
    const b = findBreedByLabel('말티즈')
    assert.equal(b?.code, 'maltese')
    assert.equal(b?.size, 'toy')
  })

  it('존재하지 않는 label → undefined', () => {
    assert.equal(findBreedByLabel('완전모르는견종'), undefined)
  })
})

describe('sizeFromBreedOrWeight (B-40)', () => {
  it('weight 우선 — 견종 baseline 무시', () => {
    // pomeranian (toy baseline) 인데 weight 20kg 라면 medium
    assert.equal(sizeFromBreedOrWeight('pomeranian', 20), 'medium')
  })

  it('weight threshold — toy (<4kg)', () => {
    assert.equal(sizeFromBreedOrWeight(null, 3), 'toy')
    assert.equal(sizeFromBreedOrWeight(null, 3.9), 'toy')
  })

  it('weight threshold — small (4~10kg)', () => {
    assert.equal(sizeFromBreedOrWeight(null, 4), 'small')
    assert.equal(sizeFromBreedOrWeight(null, 9.9), 'small')
  })

  it('weight threshold — medium (10~25kg)', () => {
    assert.equal(sizeFromBreedOrWeight(null, 10), 'medium')
    assert.equal(sizeFromBreedOrWeight(null, 24.9), 'medium')
  })

  it('weight threshold — large (25~45kg)', () => {
    assert.equal(sizeFromBreedOrWeight(null, 25), 'large')
    assert.equal(sizeFromBreedOrWeight(null, 44.9), 'large')
  })

  it('weight threshold — giant (45kg+)', () => {
    assert.equal(sizeFromBreedOrWeight(null, 45), 'giant')
    assert.equal(sizeFromBreedOrWeight(null, 70), 'giant')
  })

  it('weight 없음 + 알려진 견종 → breed size', () => {
    assert.equal(sizeFromBreedOrWeight('great_dane', null), 'giant')
    assert.equal(sizeFromBreedOrWeight('maltese', null), 'toy')
  })

  it('weight 0 또는 음수 → breed fallback', () => {
    assert.equal(sizeFromBreedOrWeight('maltese', 0), 'toy')
    assert.equal(sizeFromBreedOrWeight('maltese', -1), 'toy')
  })

  it('둘 다 없음 → medium fallback (안전 중간)', () => {
    assert.equal(sizeFromBreedOrWeight(null, null), 'medium')
    assert.equal(sizeFromBreedOrWeight(undefined, undefined), 'medium')
  })

  it('알 수 없는 breed code + weight 없음 → medium', () => {
    assert.equal(sizeFromBreedOrWeight('unknown_code', null), 'medium')
  })

  it('회귀 가드: 진돗개 18kg → medium (size 정의대로)', () => {
    const jindo = findBreed('jindo')
    assert.ok(jindo)
    assert.equal(jindo?.size, 'medium')
    // weight 우선이지만 진돗개 평균 18kg 으로 같은 결과
    assert.equal(sizeFromBreedOrWeight('jindo', 18), 'medium')
  })
})
