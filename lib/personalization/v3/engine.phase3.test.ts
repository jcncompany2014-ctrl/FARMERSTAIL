/**
 * 추천 v3 Phase 3 — 레이어 B 라우팅 + 간식 보정 + recommend 결합.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  runLayerA,
  runLayerB,
  recommend,
  LAYER_A_CONFIG,
  ENGINE_VERSION,
} from './engine.ts'
import { LAYER_A_CONFIG as CONFIG_SSOT } from './config.ts'
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

describe('config 외부화', () => {
  it('engine 재노출 LAYER_A_CONFIG === config.ts SSOT', () => {
    assert.equal(LAYER_A_CONFIG, CONFIG_SSOT)
  })
  it('간식 차감 상한 = 10% (AAFCO/WSAVA 룰)', () => {
    assert.equal(LAYER_A_CONFIG.treat.maxFraction, 0.1)
  })
})

describe('간식 칼로리 보정 (treatReductionPct)', () => {
  const loseLowAct = profile({ weightGoal: 'loss', activityLevel: 'low' }) // 닭 단독 115 (검정 확정)

  it('매일(0.1) → 밥 10% ↓, dailyKcal(요구량)은 유지', () => {
    const r = runLayerA(loseLowAct, 400, { treatReductionPct: 0.1 })
    assert.equal(r.dailyKcal, 400, 'MER 요구량은 그대로')
    assert.equal(r.dailyGrams, Math.round((360 / 115) * 100)) // 313
  })

  it('가끔(0.05) → 밥 5% ↓', () => {
    const r = runLayerA(loseLowAct, 400, { treatReductionPct: 0.05 })
    assert.equal(r.dailyGrams, Math.round((380 / 115) * 100)) // 330
  })

  it('상한 초과(0.5) → 10% 로 클램프', () => {
    const r = runLayerA(loseLowAct, 400, { treatReductionPct: 0.5 })
    assert.equal(r.dailyGrams, Math.round((360 / 115) * 100)) // 313
  })

  it('미입력 → 무변경(348g)', () => {
    const r = runLayerA(loseLowAct, 400)
    assert.equal(r.dailyGrams, Math.round((400 / 115) * 100)) // 348
  })

  it('차감 발생 시 trace 에 간식 단계 기록', () => {
    const r = runLayerA(loseLowAct, 400, { treatReductionPct: 0.1 })
    assert.ok(r.trace.some((t) => t.step === '간식 차감'))
  })
})

describe('runLayerB — 기능성 우려 → 소스 라우팅', () => {
  it('피부 우려 → 피부 소스(준비중, 대기열)', () => {
    const r = runLayerB(['skin'])
    assert.equal(r.routes.length, 1)
    assert.equal(r.routes[0]!.concern, 'skin')
    assert.equal(r.routes[0]!.sourceId, 'source-skin')
    assert.equal(r.routes[0]!.status, 'coming_soon')
    assert.equal(r.routes[0]!.available, false)
    assert.deepEqual(r.waitlistConcerns, ['skin'])
  })

  it('우려 없음 → 빈 결과', () => {
    const r = runLayerB([])
    assert.equal(r.routes.length, 0)
    assert.equal(r.waitlistConcerns.length, 0)
  })

  it('다중 우려 → 우선순위 정렬(digestion→skin→joint→immune)', () => {
    const r = runLayerB(['immune', 'joint', 'skin', 'digestion'])
    assert.deepEqual(
      r.routes.map((x) => x.concern),
      ['digestion', 'skin', 'joint', 'immune'],
    )
  })

  it('중복 우려 제거', () => {
    const r = runLayerB(['skin', 'skin', 'skin'])
    assert.equal(r.routes.length, 1)
  })

  it('현재 소스 전부 준비중 → 전부 대기열', () => {
    const r = runLayerB(['skin', 'joint', 'digestion', 'immune'])
    assert.equal(r.waitlistConcerns.length, 4)
    assert.ok(r.routes.every((x) => x.available === false))
  })
})

describe('recommend — 레이어 A + B 결합', () => {
  it('밥(picks) + 소스(대기열) + 엔진 버전', () => {
    const r = recommend(
      profile({ weightGoal: 'loss', functionalConcerns: ['skin'] }),
      400,
    )
    assert.ok(r.layerA.picks.length >= 1)
    assert.deepEqual(r.layerB.waitlistConcerns, ['skin'])
    assert.equal(r.engineVersion, ENGINE_VERSION)
  })

  it('다중 알레르기 → layerA 상담 라우팅, layerB 는 독립 동작', () => {
    const r = recommend(
      profile({
        allergies: ['닭·칠면조', '오리', '돼지고기', '소고기'],
        functionalConcerns: ['joint'],
      }),
      400,
    )
    assert.equal(r.layerA.needsConsultation, true)
    assert.deepEqual(r.layerB.waitlistConcerns, ['joint'])
  })
})
