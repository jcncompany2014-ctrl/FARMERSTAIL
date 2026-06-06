/**
 * 추천 v3 레이어 A 엔진 테스트.
 *
 * 핵심 검증:
 *  - 설문 신호 → 단백질 강점 매칭(감량=닭, 증량/활동=소, 기호/회복=돼지, 알레르기=오리)
 *  - 최대 2-SKU 믹스는 "강한 need 충돌"일 때만(남발 X)
 *  - 알레르기 hard filter + 0후보 상담 라우팅 + 교차반응 chip(차단 X)
 *  - 믹스 가중 칼로리 → 급여 그램 정합
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  runLayerA,
  deriveNeedWeights,
  scoreSku,
  LAYER_A_CONFIG,
} from './engine.ts'
import { BASE_SKU_BY_ID } from './catalog.ts'
import type { NeedProfile } from './types.ts'

function profile(overrides: Partial<NeedProfile> = {}): NeedProfile {
  return {
    weightGoal: 'maintain',
    activityLevel: 'medium',
    allergies: [],
    appetite: 'normal',
    senior: false,
    functionalConcerns: [],
    ...overrides,
  }
}

const ratioSum = (r: { picks: { ratio: number }[] }) =>
  r.picks.reduce((s, p) => s + p.ratio, 0)

describe('runLayerA — 단백질 강점 매칭', () => {
  it('감량 + 저활동 → 닭 단독(최저 칼로리)', () => {
    const r = runLayerA(profile({ weightGoal: 'loss', activityLevel: 'low' }), 400)
    assert.equal(r.picks.length, 1)
    assert.equal(r.picks[0]!.protein, 'chicken')
    assert.equal(r.picks[0]!.ratio, 1)
    assert.equal(r.picks[0]!.isPrimary, true)
    assert.equal(r.needsConsultation, false)
  })

  it('증량 + 고활동 → 소 단독(최고 칼로리)', () => {
    const r = runLayerA(
      profile({ weightGoal: 'gain', activityLevel: 'high' }),
      600,
    )
    assert.equal(r.picks.length, 1)
    assert.equal(r.picks[0]!.protein, 'beef')
  })

  it('까다로운 입맛 → 돼지 주(기호성)', () => {
    const r = runLayerA(profile({ appetite: 'picky' }), 400)
    assert.equal(r.picks[0]!.protein, 'pork')
    assert.equal(r.picks.length, 1, 'picky 단독 — maintain 은 믹스 트리거 아님')
  })

  it('시니어 → 돼지 주(B1·노견 친화)', () => {
    const r = runLayerA(profile({ senior: true, activityLevel: 'low' }), 350)
    assert.equal(r.picks[0]!.protein, 'pork')
  })

  it('균형 기본(특이 신호 없음) → 닭(엔트리 SKU)', () => {
    const r = runLayerA(profile(), 400)
    assert.equal(r.picks[0]!.protein, 'chicken')
    assert.equal(r.picks.length, 1)
  })
})

describe('runLayerA — 최대 2-SKU 믹스 (강한 충돌만)', () => {
  it('감량 + 까다로운 입맛 → 닭 70% + 돼지 30%(기호성 보완)', () => {
    const r = runLayerA(
      profile({ weightGoal: 'loss', appetite: 'picky' }),
      399,
    )
    assert.equal(r.picks.length, 2)
    assert.equal(r.picks[0]!.protein, 'chicken')
    assert.equal(r.picks[0]!.ratio, LAYER_A_CONFIG.mix.primaryRatio)
    assert.equal(r.picks[1]!.protein, 'pork')
    assert.equal(r.picks[1]!.ratio, LAYER_A_CONFIG.mix.secondaryRatio)
    assert.equal(r.picks[1]!.isPrimary, false)
  })

  it('믹스 비율 합 = 1.0 (단일·믹스 모두)', () => {
    for (const p of [
      profile({ weightGoal: 'loss', appetite: 'picky' }),
      profile({ weightGoal: 'gain', activityLevel: 'high' }),
      profile({ appetite: 'picky' }),
      profile(),
    ]) {
      assert.ok(Math.abs(ratioSum(runLayerA(p, 400)) - 1) < 1e-9)
    }
  })
})

describe('runLayerA — 알레르기 안전', () => {
  it('닭 알레르기 → 닭 제외 + 오리 교차반응 chip(차단 X)', () => {
    const r = runLayerA(profile({ allergies: ['닭·칠면조'] }), 400)
    assert.ok(
      !r.picks.some((p) => p.protein === 'chicken'),
      '닭은 후보에서 제외',
    )
    assert.ok(
      r.crossReactWarnings.some(
        (w) => w.protein === 'duck' && w.allergyLabel === '닭·칠면조',
      ),
      '오리는 닭과 IgE 교차반응 경고(살아있되 chip)',
    )
    assert.equal(r.needsConsultation, false)
  })

  it('4종 모두 알레르기 → 상담 라우팅(picks 빔, 그램 0)', () => {
    const r = runLayerA(
      profile({ allergies: ['닭·칠면조', '오리', '돼지고기', '소고기'] }),
      400,
    )
    assert.equal(r.needsConsultation, true)
    assert.equal(r.picks.length, 0)
    assert.equal(r.dailyGrams, 0)
    assert.ok(r.consultationReason && r.consultationReason.length > 0)
  })

  it('소 알레르기 → 양고기 교차반응 + 소 제외', () => {
    const r = runLayerA(profile({ allergies: ['소고기'] }), 400)
    assert.ok(!r.picks.some((p) => p.protein === 'beef'))
  })
})

describe('runLayerA — 칼로리·그램 정합', () => {
  it('단일 닭(130kcal/100g): 400kcal/일 → 308g', () => {
    const r = runLayerA(profile({ weightGoal: 'loss', activityLevel: 'low' }), 400)
    assert.equal(r.blendedKcalPer100g, 130)
    assert.equal(r.dailyGrams, Math.round((400 / 130) * 100)) // 308
  })

  it('믹스 닭0.7/돼지0.3: blended=133, 399kcal → 300g', () => {
    const r = runLayerA(profile({ weightGoal: 'loss', appetite: 'picky' }), 399)
    assert.equal(r.blendedKcalPer100g, 0.7 * 130 + 0.3 * 140) // 133
    assert.equal(r.dailyGrams, 300)
  })

  it('picks 의 kcal·claims 가 catalog SSOT 와 일치', () => {
    const r = runLayerA(profile({ weightGoal: 'loss', activityLevel: 'low' }), 400)
    const sku = BASE_SKU_BY_ID['chicken-basic']!
    assert.equal(r.picks[0]!.kcalPer100g, sku.kcalPer100g)
    assert.deepEqual(r.picks[0]!.claims, sku.claims)
    assert.ok(r.picks[0]!.claims.length > 0, '효능 문구 비어있지 않음')
  })
})

describe('runLayerA — explainability / 디버그', () => {
  it('trace 가 단계별로 채워짐', () => {
    const r = runLayerA(profile({ appetite: 'picky' }), 400)
    assert.ok(r.trace.length >= 4, '필터→need→점수→그램 최소 4단계')
    const steps = r.trace.map((t) => t.step)
    assert.ok(steps.includes('적합도 점수'))
    assert.ok(steps.includes('급여 그램'))
  })

  it('scores 가 생존 후보 전부를 점수와 함께 노출', () => {
    const r = runLayerA(profile(), 400)
    assert.equal(r.scores.length, 4) // 알레르기 없음 → 4종 생존
    assert.ok(r.scores.every((s) => typeof s.score === 'number'))
  })
})

describe('deriveNeedWeights / scoreSku — 단위', () => {
  it('weightGoal=loss → weight_loss 최대 가중', () => {
    const w = deriveNeedWeights(profile({ weightGoal: 'loss' }))
    assert.equal(w.weight_loss, LAYER_A_CONFIG.needWeights.weightLoss)
    assert.equal(w.maintain, undefined)
  })

  it('알레르기 보유 → sensitive 가중 부여', () => {
    const w = deriveNeedWeights(profile({ allergies: ['소고기'] }))
    assert.equal(w.sensitive, LAYER_A_CONFIG.needWeights.sensitiveFromAllergy)
  })

  it('scoreSku = Σ(가중치 × fitTag)', () => {
    const chicken = BASE_SKU_BY_ID['chicken-basic']!
    const w = { weight_loss: 1.0, activity_low: 0.6 }
    // chicken fitTags: weight_loss 0.9, activity_low 0.6
    assert.equal(scoreSku(chicken, w), 1.0 * 0.9 + 0.6 * 0.6)
  })
})
