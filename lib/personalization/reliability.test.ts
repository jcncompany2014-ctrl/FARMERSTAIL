import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  recencyScore,
  weightReliability,
  activityReliability,
  feedReliability,
  overallReliability,
  populationReliability,
  populationToleranceForSize,
  compositeReliabilityWithPopulation,
  accuracyLabel,
} from './reliability.ts'

/**
 * lib/personalization/reliability.ts — 다변량 신뢰도 산출 (발명 모듈 C).
 *
 * 회귀 가드:
 *  - audit #14: KST/UTC 9시간 어긋남 (date-only 입력)
 *  - audit #20: size 별 tolerance (toy 견 outlier)
 *  - audit #22: composite weights 명시 분리 (sum=1.0)
 *  - B4: overallReliability 가중치 (1개 약한 변수 가혹하지 않게)
 */

describe('recencyScore', () => {
  // 2026-05-15 정오 KST 기준 = 2026-05-15T03:00:00Z
  const NOW_MS = Date.parse('2026-05-15T03:00:00Z')

  it('null/undefined → 0.2', () => {
    assert.equal(recencyScore(null, NOW_MS), 0.2)
    assert.equal(recencyScore(undefined, NOW_MS), 0.2)
  })

  it('오늘 측정 → 1.0', () => {
    assert.equal(recencyScore('2026-05-15', NOW_MS), 1.0)
  })

  it('audit #14 — 1주 경계 date-only 입력은 KST 정오 normalize', () => {
    // 7일 전 (2026-05-08) date-only 입력. UTC 00:00 으로 파싱하면 9시간 빨라
    // 7.0~7.4일 사이 → 1.0 vs 0.85 경계가 흔들림. KST 정오 normalize 하면 정확히 7.0일.
    const score = recencyScore('2026-05-08', NOW_MS)
    assert.equal(score, 1.0) // 정확히 7일 → 1.0 유지
  })

  it('8일 전 → 0.85 (1주 초과)', () => {
    assert.equal(recencyScore('2026-05-07', NOW_MS), 0.85)
  })

  it('1개월 이내 → 0.85', () => {
    assert.equal(recencyScore('2026-04-20', NOW_MS), 0.85)
  })

  it('3개월 이내 → 0.6', () => {
    assert.equal(recencyScore('2026-03-01', NOW_MS), 0.6)
  })

  it('6개월 이내 → 0.4', () => {
    assert.equal(recencyScore('2025-12-01', NOW_MS), 0.4)
  })

  it('그 외 → 0.2', () => {
    assert.equal(recencyScore('2024-01-01', NOW_MS), 0.2)
  })

  it('Date object 입력도 OK', () => {
    const d = new Date(NOW_MS)
    assert.equal(recencyScore(d, NOW_MS), 1.0)
  })
})

describe('weightReliability', () => {
  const NOW_MS = Date.parse('2026-05-15T03:00:00Z')

  it('vet_scale + 오늘 → 1.0 (=0.7*1.0 + 0.3*1.0)', () => {
    assert.equal(weightReliability('vet_scale', '2026-05-15', NOW_MS), 1.0)
  })

  it('eyeball + 1년 전 → 0.34 (=0.7*0.4 + 0.3*0.2)', () => {
    assert.equal(weightReliability('eyeball', '2025-01-01', NOW_MS), 0.34)
  })

  it('unknown method 폴백', () => {
    const score = weightReliability(null, '2026-05-15', NOW_MS)
    // 0.7 * 0.3 (unknown) + 0.3 * 1.0 = 0.51
    assert.equal(score, 0.51)
  })

  it('unrecognized method string → unknown 폴백', () => {
    const score = weightReliability(
      'fancy_new_scale',
      '2026-05-15',
      NOW_MS,
    )
    assert.equal(score, 0.51)
  })
})

describe('activityReliability / feedReliability', () => {
  it('pedometer = 0.95', () => {
    assert.equal(activityReliability('pedometer'), 0.95)
  })

  it('subjective = 0.5', () => {
    assert.equal(activityReliability('subjective'), 0.5)
  })

  it('null → unknown 0.4', () => {
    assert.equal(activityReliability(null), 0.4)
  })

  it('auto_delivery = 1.0 (D2C 자체 사료 차별화)', () => {
    assert.equal(feedReliability('auto_delivery'), 1.0)
  })

  it('eyeball = 0.4', () => {
    assert.equal(feedReliability('eyeball'), 0.4)
  })
})

describe('overallReliability (B4 가중치)', () => {
  it('빈 배열 → 0', () => {
    assert.equal(overallReliability([]), 0)
  })

  it('모두 동일 0.95 → 0.95', () => {
    assert.equal(overallReliability([0.95, 0.95, 0.95]), 0.95)
  })

  it('B4 회귀 가드 — 1개만 약하면 가혹하지 않게', () => {
    // [0.95, 0.95, 0.3]: min=0.3, avg=0.733
    // 0.4 * 0.3 + 0.6 * 0.733 = 0.12 + 0.44 = 0.56
    // 이전 (0.6 min + 0.4 avg) 였으면 0.47 — 사용자 좌절. 새 공식은 0.56 (성장 중).
    const score = overallReliability([0.95, 0.95, 0.3])
    assert.ok(score >= 0.55 && score <= 0.6, `expected ~0.56, got ${score}`)
  })

  it('모두 약하면 그대로 낮음 — 정직성 유지', () => {
    assert.equal(overallReliability([0.3, 0.3, 0.3]), 0.3)
  })
})

describe('populationReliability', () => {
  it('정확히 평균 → 1.0', () => {
    assert.equal(populationReliability(10, 10), 1.0)
  })

  it('tolerance 안쪽 → 1.0', () => {
    // 10 ± 30% = 7~13
    assert.equal(populationReliability(12, 10, 0.3), 1.0)
  })

  it('tolerance 2배 초과 → 0', () => {
    // 10 → 17 = 70% deviation > 2*0.3 = 60%
    assert.equal(populationReliability(17, 10, 0.3), 0)
  })

  it('tolerance~2tolerance 사이 선형 감소', () => {
    // 10 → 14.5 = 45% deviation. tolerance=0.3. deviation - tolerance = 0.15
    // 1 - 0.15/0.3 = 0.5
    assert.equal(populationReliability(14.5, 10, 0.3), 0.5)
  })

  it('데이터 부족 (0 이하) → 0.5 중립', () => {
    assert.equal(populationReliability(0, 10), 0.5)
    assert.equal(populationReliability(10, 0), 0.5)
  })

  it('audit #20 — toy 견 outlier 감지 (tolerance=0.15)', () => {
    // 말티즈 3kg 평균에 4.5kg (50% deviation) 입력
    // tolerance 0.15 사용 시 2*0.15=0.30 < 0.50 → score 0
    assert.equal(populationReliability(4.5, 3, 0.15), 0)
    // tolerance 0.3 (이전 default) 시 0.30~0.60 사이 → 0~1
    // 정확히 0.5 deviation → 1 - (0.5-0.3)/0.3 = 0.33 (관대 — 비만 미감지 위험)
    const oldTolerance = populationReliability(4.5, 3, 0.3)
    assert.ok(oldTolerance > 0, '이전 0.3 tolerance 는 toy 견 outlier 관대')
  })
})

describe('populationToleranceForSize', () => {
  it('toy → 0.15 (가장 엄격)', () => {
    assert.equal(populationToleranceForSize('toy'), 0.15)
  })

  it('small → 0.20', () => {
    assert.equal(populationToleranceForSize('small'), 0.20)
  })

  it('medium → 0.25', () => {
    assert.equal(populationToleranceForSize('medium'), 0.25)
  })

  it('large / giant → 0.30 (가장 관대)', () => {
    assert.equal(populationToleranceForSize('large'), 0.30)
    assert.equal(populationToleranceForSize('giant'), 0.30)
  })
})

describe('compositeReliabilityWithPopulation (audit #22)', () => {
  it('weights sum = 1.0 invariant — module load 시 throw', () => {
    // module load 시 check. import 성공 자체가 invariant 통과 증거.
    // 실패 시 throw 라 그 자체로 fail.
    assert.ok(true)
  })

  it('methodRecency=1.0, population=1.0 → 1.0', () => {
    assert.equal(compositeReliabilityWithPopulation(1.0, 1.0), 1.0)
  })

  it('methodRecency=0.95, population=0.3 (cluster outlier) — min 가중 반영', () => {
    // 0.5 * 0.95 + 0.3 * 0.3 + 0.2 * 0.3 = 0.475 + 0.09 + 0.06 = 0.625
    assert.equal(
      compositeReliabilityWithPopulation(0.95, 0.3),
      0.63,
    )
  })

  it('population 단독으로 낮으면 min 가중 추가 penalty', () => {
    const high = compositeReliabilityWithPopulation(0.95, 0.95)
    const low = compositeReliabilityWithPopulation(0.95, 0.5)
    assert.ok(high > low)
  })
})

describe('accuracyLabel (voice-guidelines §1)', () => {
  it('0.85+ → 정밀 케어 가족', () => {
    assert.equal(accuracyLabel(0.85).text, '정밀 케어 가족')
    assert.equal(accuracyLabel(0.95).text, '정밀 케어 가족')
  })

  it('0.7+ → 안정적', () => {
    assert.equal(accuracyLabel(0.7).text, '안정적')
    assert.equal(accuracyLabel(0.84).text, '안정적')
  })

  it('0.5+ → 성장 중', () => {
    assert.equal(accuracyLabel(0.5).text, '성장 중')
    assert.equal(accuracyLabel(0.69).text, '성장 중')
  })

  it('0.5 미만 → 초기', () => {
    assert.equal(accuracyLabel(0.3).text, '초기')
    assert.equal(accuracyLabel(0).text, '초기')
  })

  it('"신뢰도" 단어 절대 미포함 (voice-guidelines §1)', () => {
    for (const s of [0, 0.3, 0.5, 0.7, 0.85, 0.95, 1.0]) {
      assert.ok(
        !accuracyLabel(s).text.includes('신뢰도'),
        `score ${s} 에서 "신뢰도" 노출`,
      )
    }
  })

  it('percent 정수 변환', () => {
    assert.equal(accuracyLabel(0.876).percent, 88)
    assert.equal(accuracyLabel(0.5).percent, 50)
  })
})
