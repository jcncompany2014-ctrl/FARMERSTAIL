import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  GROWTH_CURVES,
  ageWeeksFromBirth,
  curveForAdultKg,
  estimateGrowth,
  grownFraction,
  projectWeightKg,
} from './growth-curve.ts'

const near = (a: number, b: number, eps = 0.005) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`)

describe('성장곡선 — FEDIAF 2025 Table VII-8a 원문 계수', () => {
  it('구간 5개·계수가 원문 그대로', () => {
    assert.deepEqual(
      GROWTH_CURVES.map((c) => [c.maxAdultKg, c.a, c.b]),
      [
        [7, 36.92, 43.57],
        [15, 36.86, 48.22],
        [27.5, 39.88, 60.7],
        [47.5, 36.96, 56.18],
        [Infinity, 36.61, 62.39],
      ],
    )
  })

  it('8주·26주 다 큰 정도 — 원문 식 대입값(33·28·22·21·14% / 77·72·69·64·57%)', () => {
    near(grownFraction(8, GROWTH_CURVES[0]!), 0.332)
    near(grownFraction(8, GROWTH_CURVES[4]!), 0.137)
    near(grownFraction(26, GROWTH_CURVES[0]!), 0.767)
    near(grownFraction(26, GROWTH_CURVES[3]!), 0.642)
  })

  it('8주보다 어리면 8주로, 100% 를 넘는 주령은 1 로', () => {
    assert.equal(grownFraction(3, GROWTH_CURVES[0]!), grownFraction(8, GROWTH_CURVES[0]!))
    assert.equal(grownFraction(60, GROWTH_CURVES[0]!), 1)
  })
})

describe('estimateGrowth — 현재 체중·주령 → 예상 성견체중', () => {
  it('작은 구간부터 맞는 곡선을 고른다 (펀치: ≤7 곡선이면 9.9kg 라 구간 밖 → 7~15 곡선)', () => {
    const g = estimateGrowth(8.3, 31.29)
    near(g.fraction, 0.787, 0.002)
    assert.ok(g.adultKg > 7 && g.adultKg <= 15, `${g.adultKg}`)
  })

  it('토이 자견 (낑콩 21.1주 1.5kg → 성견 ≈2.2kg)', () => {
    const g = estimateGrowth(1.5, 21.14)
    assert.ok(g.adultKg > 2.1 && g.adultKg < 2.25, `${g.adultKg}`)
  })

  it('대형견 자견 — 10주 8kg 는 초대형 아님, 15~47.5 구간', () => {
    const g = estimateGrowth(8, 10)
    assert.ok(g.adultKg > 15 && g.adultKg <= 47.5, `${g.adultKg}`)
  })

  it('다 큰 개(소형 60주)는 성견체중 = 현재 체중', () => {
    assert.deepEqual(estimateGrowth(4, 60), { adultKg: 4, fraction: 1 })
  })

  it('체중이 늘면 추정 성견체중도 늘고, 같은 체중이면 어릴수록 크게 본다 (단조)', () => {
    assert.ok(estimateGrowth(5, 20).adultKg < estimateGrowth(6, 20).adultKg)
    assert.ok(estimateGrowth(5, 16).adultKg > estimateGrowth(5, 24).adultKg)
  })
})

describe('projectWeightKg — 체중 기록이 없을 때 이번 달 체중', () => {
  it('추정 성견체중으로 한 달 뒤 체중을 곡선대로', () => {
    const g = estimateGrowth(1.5, 21.14)
    const next = projectWeightKg(g.adultKg, 21.14 + 4.348)
    assert.ok(next > 1.5 && next < g.adultKg, `${next}`)
    // 같은 주령으로 되돌리면 원래 체중
    near(projectWeightKg(g.adultKg, 21.14), 1.5, 0.01)
  })

  it('curveForAdultKg 경계 — 7kg 는 ≤7 구간, 7.01 은 다음 구간', () => {
    assert.equal(curveForAdultKg(7).maxAdultKg, 7)
    assert.equal(curveForAdultKg(7.01).maxAdultKg, 15)
  })
})

describe('ageWeeksFromBirth', () => {
  it('생일 → 주령, 생일 없음·미래면 null', () => {
    const now = Date.parse('2026-10-01T00:00:00Z')
    near(ageWeeksFromBirth('2026-05-06', now)!, 21.14, 0.01)
    assert.equal(ageWeeksFromBirth(null, now), null)
    assert.equal(ageWeeksFromBirth('2027-01-01', now), null)
  })
})
