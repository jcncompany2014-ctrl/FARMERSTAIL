/**
 * diffFormulas 단위 테스트.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { diffFormulas } from './diff.ts'
import type { Formula } from './types.ts'

function f(overrides: Partial<Formula> = {}): Formula {
  return {
    lineRatios: { basic: 0.5, weight: 0.1, skin: 0.2, premium: 0.1, joint: 0.1 },
    toppers: { protein: 0.05, vegetable: 0.1 },
    reasoning: [],
    transitionStrategy: 'gradual',
    dailyKcal: 280,
    dailyGrams: 200,
    cycleNumber: 1,
    algorithmVersion: 'v1.0.0',
    userAdjusted: false,
    ...overrides,
  }
}

describe('diffFormulas — 미세 변화', () => {
  it('동일 → not meaningful', () => {
    const d = diffFormulas(f(), f())
    assert.equal(d.meaningful, false)
    assert.equal(d.changes.length, 0)
    assert.equal(d.forced, false)
  })

  it('5% 미만 변화 → not meaningful', () => {
    const d = diffFormulas(
      f(),
      f({
        lineRatios: { basic: 0.55, weight: 0.05, skin: 0.2, premium: 0.1, joint: 0.1 },
      }),
    )
    assert.equal(d.meaningful, false)
  })

  // v3 희소 시드(라인 다수 0) — cycle-2 작은 nudge(0→5%)는 micro-adjust(자동적용).
  // 수정 전엔 "라인 추가"로 무조건 meaningful → 승인 푸시 폭주였음.
  it('0 → 5% 작은 라인 추가 → not meaningful (자동 적용)', () => {
    const d = diffFormulas(
      f({ lineRatios: { basic: 0.7, weight: 0, skin: 0, premium: 0.3, joint: 0 } }),
      f({ lineRatios: { basic: 0.65, weight: 0.05, skin: 0, premium: 0.3, joint: 0 } }),
    )
    assert.equal(d.meaningful, false)
  })

  it('0 → 15% 큰 라인 추가 → 여전히 meaningful (진짜 새 메인)', () => {
    const d = diffFormulas(
      f({ lineRatios: { basic: 0.85, weight: 0, skin: 0, premium: 0.15, joint: 0 } }),
      f({ lineRatios: { basic: 0.7, weight: 0.15, skin: 0, premium: 0.15, joint: 0 } }),
    )
    assert.equal(d.meaningful, true)
    assert.ok(d.changes.some((c) => c.includes('Weight') && c.includes('추가')))
  })
})

describe('diffFormulas — 의미 있는 변화', () => {
  it('단일 라인 +10% → meaningful', () => {
    const d = diffFormulas(
      f(),
      f({
        lineRatios: { basic: 0.4, weight: 0.2, skin: 0.2, premium: 0.1, joint: 0.1 },
      }),
    )
    assert.equal(d.meaningful, true)
    assert.ok(d.changes.some((c) => c.includes('Basic')))
    assert.ok(d.changes.some((c) => c.includes('Weight')))
  })

  it('새 라인 추가 → meaningful + 라인 추가 message', () => {
    const d = diffFormulas(
      f({
        lineRatios: { basic: 1, weight: 0, skin: 0, premium: 0, joint: 0 },
      }),
      f({
        lineRatios: { basic: 0.7, weight: 0, skin: 0.3, premium: 0, joint: 0 },
      }),
    )
    assert.equal(d.meaningful, true)
    assert.ok(d.changes.some((c) => c.includes('Skin') && c.includes('추가')))
  })

  it('라인 제거 → meaningful + 제외 message', () => {
    const d = diffFormulas(
      f(),
      f({
        lineRatios: { basic: 0.6, weight: 0.2, skin: 0, premium: 0.1, joint: 0.1 },
      }),
    )
    assert.equal(d.meaningful, true)
    assert.ok(d.changes.some((c) => c.includes('Skin') && c.includes('제외')))
  })

  it('토퍼 5%+ 변화 → meaningful', () => {
    const d = diffFormulas(
      f(),
      f({
        toppers: { protein: 0.05, vegetable: 0.2 },
      }),
    )
    assert.equal(d.meaningful, true)
    assert.ok(d.changes.some((c) => c.includes('야채 토퍼')))
  })

  it('일일 kcal 10%+ 변화 → meaningful', () => {
    const d = diffFormulas(
      f({ dailyKcal: 280 }),
      f({ dailyKcal: 320 }), // +14%
    )
    assert.equal(d.meaningful, true)
    assert.ok(d.changes.some((c) => c.includes('칼로리')))
  })
})

describe('diffFormulas — 강제 적용', () => {
  it('새 알레르기 → forced=true', () => {
    const prev = f()
    const next = f({
      reasoning: [
        {
          trigger: '닭 알레르기',
          action: 'Basic 0%',
          chipLabel: '닭 차단',
          priority: 0,
          ruleId: 'allergy-basic',
        },
      ],
      lineRatios: { basic: 0, weight: 0.5, skin: 0.2, premium: 0.2, joint: 0.1 },
    })
    const d = diffFormulas(prev, next)
    assert.equal(d.forced, true)
    assert.equal(d.meaningful, true)
    assert.ok(d.forceReasons.some((r) => r.includes('알레르기')))
  })

  it('새 만성질환 → forced=true', () => {
    const prev = f()
    const next = f({
      reasoning: [
        {
          trigger: 'CKD',
          action: 'Premium 0%',
          chipLabel: '신장 → 저단백',
          priority: 3,
          ruleId: 'chronic-kidney',
        },
      ],
      lineRatios: { basic: 0.6, weight: 0.1, skin: 0.2, premium: 0, joint: 0.1 },
    })
    const d = diffFormulas(prev, next)
    assert.equal(d.forced, true)
    assert.ok(d.forceReasons.some((r) => r.includes('만성질환')))
  })

  it('이미 있던 알레르기 → forced=false', () => {
    const reasoning = [
      {
        trigger: '닭 알레르기',
        action: 'Basic 0%',
        chipLabel: '닭 차단',
        priority: 0,
        ruleId: 'allergy-basic',
      },
    ]
    const prev = f({ reasoning, lineRatios: { basic: 0, weight: 0.5, skin: 0.2, premium: 0.2, joint: 0.1 } })
    const next = f({ reasoning, lineRatios: { basic: 0, weight: 0.4, skin: 0.3, premium: 0.2, joint: 0.1 } })
    const d = diffFormulas(prev, next)
    assert.equal(d.forced, false)
  })
})

describe('diffFormulas — 청구 금액 변동 (2026-07-17 · 처방→가격 연동)', () => {
  it('price 미전달 = 기존 동작 그대로 (금액 판정 안 함)', () => {
    const d = diffFormulas(f(), f())
    assert.equal(d.priceChanged, false)
    assert.equal(d.priceDelta, 0)
    assert.equal(d.meaningful, false)
  })

  it('★모양은 임계값 미만인데 금액이 오르면 → meaningful (동의 필요)', () => {
    // kcal 280 → 305 = +8.9% (KCAL_DELTA 10% 미만 → 모양만 보면 "미세 조정")
    // 그런데 1팩 분량이 올라 2주 청구액이 바뀐다 → 동의 없이 더 청구되면 §13의2 위반.
    const prev = f()
    const next = f({ dailyKcal: 305 })
    const shapeOnly = diffFormulas(prev, next)
    assert.equal(shapeOnly.meaningful, false) // 이게 예전에 열려 있던 구멍

    const withPrice = diffFormulas(prev, next, {
      price: { prevTotal: 68000, nextTotal: 74600 },
    })
    assert.equal(withPrice.meaningful, true)
    assert.equal(withPrice.priceChanged, true)
    assert.equal(withPrice.priceDelta, 6600)
    assert.ok(withPrice.changes.some((c) => c.includes('68,000원 → 74,600원')))
  })

  it('금액이 내려가도 meaningful (덜 보내면서 같은 돈 받는 것도 알려야)', () => {
    const d = diffFormulas(f(), f(), {
      price: { prevTotal: 74600, nextTotal: 68000 },
    })
    assert.equal(d.meaningful, true)
    assert.equal(d.priceChanged, true)
    assert.equal(d.priceDelta, -6600)
  })

  it('금액 동일 → 금액 때문에 meaningful 되지 않음', () => {
    const d = diffFormulas(f(), f(), {
      price: { prevTotal: 68000, nextTotal: 68000 },
    })
    assert.equal(d.priceChanged, false)
    assert.equal(d.priceDelta, 0)
    assert.equal(d.meaningful, false)
  })

  it('금액엔 관용 구간이 없다 — 100원 차이도 동의 대상', () => {
    const d = diffFormulas(f(), f(), {
      price: { prevTotal: 68000, nextTotal: 68100 },
    })
    assert.equal(d.priceChanged, true)
    assert.equal(d.meaningful, true)
  })

  it('prevTotal 이 0/미상이면 판정 skip (금액을 추측하지 않는다)', () => {
    const d = diffFormulas(f(), f(), { price: { prevTotal: 0, nextTotal: 68000 } })
    assert.equal(d.priceChanged, false)
    assert.equal(d.meaningful, false)
  })

  it('forced 와 독립 — 알레르기 강제 변경이어도 금액 변동은 별도로 표시', () => {
    const prev = f()
    const next = f({
      reasoning: [
        { ruleId: 'allergy-chicken', chipLabel: '닭 차단', trigger: '알레르기', action: 'Basic 제외' },
      ] as Formula['reasoning'],
    })
    const d = diffFormulas(prev, next, {
      price: { prevTotal: 68000, nextTotal: 71000 },
    })
    assert.equal(d.forced, true) // 처방은 즉시 적용돼야(안전)
    assert.equal(d.priceChanged, true) // 그렇다고 더 청구해도 되는 건 아니다
    assert.equal(d.priceDelta, 3000)
  })
})

describe('diffFormulas — 메시지 형식', () => {
  it('changes 가 사람-읽기-쉬운 한국어', () => {
    const d = diffFormulas(
      f(),
      f({
        lineRatios: { basic: 0.3, weight: 0.3, skin: 0.2, premium: 0.1, joint: 0.1 },
      }),
    )
    // 모든 메시지에 화살표 또는 % 포함
    for (const c of d.changes) {
      assert.ok(/%|→|↑|↓|추가|제외/.test(c), `메시지 형식: ${c}`)
    }
  })
})
