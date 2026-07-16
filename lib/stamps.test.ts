/**
 * 스탬프 — 스탬프 카드·등급 사다리.
 *
 * 이 숫자는 고객이 **눈으로 세는** 값이다. 화면에 9칸이 찍혀 있는데 보상이 나가거나,
 * 10칸을 채웠는데 판이 안 넘어가면 바로 문의가 온다. 경계를 박제한다.
 *
 * 핵심 회귀 방지:
 *  1. 10개 = "1장 완성 + 2장째 0칸" (1장째 10칸이 아니다). 보상 받고도 꽉 찬 판이
 *     남아 있으면 또 받는 줄 안다.
 *  2. 스탬프는 **소진되지 않는다** — 등급이 개수에 걸려 있어 소진하면 강등된다.
 *  3. 등급 사다리는 DB `fn_compute_tier` 와 같아야 한다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  STAMP_CARD_SIZE,
  STAMP_VALIDITY_YEARS,
  activeStamps,
  cardProgress,
  milestonesCrossed,
  stampExpiryFrom,
  type StampLike,
} from './stamps.ts'
import {
  tierFromStamps,
  tierMeta,
  nextTier,
  stampsToFirstTier,
  TIERS,
} from './tiers.ts'

const stamp = (stampedAt: string, expiresAt: string): StampLike => ({
  stamped_at: stampedAt,
  expires_at: expiresAt,
})

describe('만료 — 적립 시점부터 2년', () => {
  it('2년 뒤로 잡힌다', () => {
    const at = new Date('2026-07-16T00:00:00Z')
    assert.equal(stampExpiryFrom(at).getUTCFullYear(), 2028)
    assert.equal(STAMP_VALIDITY_YEARS, 2)
  })

  it('원본 Date 를 건드리지 않는다', () => {
    const at = new Date('2026-07-16T00:00:00Z')
    stampExpiryFrom(at)
    assert.equal(at.toISOString(), '2026-07-16T00:00:00.000Z')
  })

  it('만료된 건 빠지고 살아 있는 것만 센다', () => {
    const now = new Date('2026-07-16T00:00:00Z')
    const list = [
      stamp('2024-07-01T00:00:00Z', '2026-07-01T00:00:00Z'), // 만료
      stamp('2024-08-01T00:00:00Z', '2026-08-01T00:00:00Z'), // 생존
      stamp('2026-07-01T00:00:00Z', '2028-07-01T00:00:00Z'), // 생존
    ]
    assert.equal(activeStamps(list, now).length, 2)
  })

  it('만료 순간(=경계)은 아직 죽은 것으로 본다', () => {
    const now = new Date('2026-07-16T00:00:00Z')
    assert.equal(activeStamps([stamp('x', '2026-07-16T00:00:00Z')], now).length, 0)
    assert.equal(activeStamps([stamp('x', '2026-07-16T00:00:01Z')], now).length, 1)
  })

  it('2주마다 적립하면 활성 구독자는 만료를 겪을 수 없다', () => {
    // 2년(104주) 동안 2주마다 = 52개. 첫 개가 만료될 때 이미 51개가 살아 있다.
    const perYear = 26
    assert.ok(perYear * STAMP_VALIDITY_YEARS >= 50, '나무(50개)를 만료 전에 도달')
  })
})

describe('스탬프 카드 — 10칸이 차면 다음 장으로', () => {
  it('0개 = 1장째 0칸, 10칸 남음', () => {
    const p = cardProgress(0)
    assert.deepEqual(
      { c: p.cardNumber, f: p.filled, r: p.remaining, done: p.completedCards },
      { c: 1, f: 0, r: 10, done: 0 },
    )
  })

  it('9개 = 1장째 9칸, 1칸 남음, 완성 0', () => {
    const p = cardProgress(9)
    assert.deepEqual(
      { c: p.cardNumber, f: p.filled, r: p.remaining, done: p.completedCards },
      { c: 1, f: 9, r: 1, done: 0 },
    )
  })

  it('★10개 = 1장 완성 + **2장째 0칸** (1장째 10칸이 아니다)', () => {
    const p = cardProgress(10)
    assert.deepEqual(
      { c: p.cardNumber, f: p.filled, r: p.remaining, done: p.completedCards },
      { c: 2, f: 0, r: 10, done: 1 },
    )
  })

  it('23개 = 3장째 3칸, 완성 2', () => {
    const p = cardProgress(23)
    assert.deepEqual(
      { c: p.cardNumber, f: p.filled, r: p.remaining, done: p.completedCards },
      { c: 3, f: 3, r: 7, done: 2 },
    )
  })

  it('filled 는 절대 10 이 될 수 없다 (되면 다음 장)', () => {
    for (let n = 0; n <= 100; n++) {
      const p = cardProgress(n)
      assert.ok(p.filled >= 0 && p.filled < STAMP_CARD_SIZE, `${n} → filled ${p.filled}`)
      assert.ok(p.remaining >= 1 && p.remaining <= STAMP_CARD_SIZE, `${n} → remaining ${p.remaining}`)
    }
  })

  it('음수·소수를 넣어도 깨지지 않는다', () => {
    assert.equal(cardProgress(-5).total, 0)
    assert.equal(cardProgress(3.7).filled, 3)
  })
})

describe('보상 발급 — 카드를 막 채운 순간에만', () => {
  it('9 → 10 이면 1장째 완성', () => {
    assert.deepEqual(milestonesCrossed(9, 10), [1])
  })

  it('8 → 9 는 아직 아니다', () => {
    assert.deepEqual(milestonesCrossed(8, 9), [])
  })

  it('10 → 11 은 이미 받은 1장을 또 주지 않는다', () => {
    assert.deepEqual(milestonesCrossed(10, 11), [])
  })

  it('19 → 20 이면 2장째', () => {
    assert.deepEqual(milestonesCrossed(19, 20), [2])
  })

  it('보정 적립으로 여러 장을 한 번에 넘으면 전부 준다', () => {
    assert.deepEqual(milestonesCrossed(5, 25), [1, 2])
  })

  it('개수가 줄어도(만료) 보상을 회수하지 않는다', () => {
    assert.deepEqual(milestonesCrossed(20, 15), [])
  })
})

describe('등급 사다리 — 스탬프 개수 기준 (사장님 확정 2026-07-16)', () => {
  it('문턱: 씨앗10 · 새싹20 · 꽃30 · 열매40 · 나무50', () => {
    assert.deepEqual(
      TIERS.map((t) => [t.key, t.threshold]),
      [
        ['seed', 10],
        ['sprout', 20],
        ['bloom', 30],
        ['fruit', 40],
        ['mate', 50],
      ],
    )
  })

  it('★스탬프 10개 미만은 **등급 없음(null)** — 아무것도 안 한 사람에게 등급을 주지 않는다', () => {
    assert.equal(tierFromStamps(0), null)
    assert.equal(tierFromStamps(9), null)
    assert.equal(tierFromStamps(10), 'seed')
  })

  it('경계값이 정확히 그 등급에 든다', () => {
    assert.equal(tierFromStamps(10), 'seed')
    assert.equal(tierFromStamps(19), 'seed')
    assert.equal(tierFromStamps(20), 'sprout')
    assert.equal(tierFromStamps(29), 'sprout')
    assert.equal(tierFromStamps(30), 'bloom')
    assert.equal(tierFromStamps(39), 'bloom')
    assert.equal(tierFromStamps(40), 'fruit')
    assert.equal(tierFromStamps(49), 'fruit')
    assert.equal(tierFromStamps(50), 'mate')
    assert.equal(tierFromStamps(999), 'mate')
  })

  it('한 등급 = 스탬프 카드 한 장', () => {
    assert.equal(tierFromStamps(STAMP_CARD_SIZE * 1), 'seed')
    assert.equal(tierFromStamps(STAMP_CARD_SIZE * 5), 'mate')
  })

  it('tierMeta 는 모르는 값/없음이면 null — 씨앗으로 폴백하지 않는다', () => {
    assert.equal(tierMeta(null), null)
    assert.equal(tierMeta(undefined), null)
    assert.equal(tierMeta('없는등급'), null)
    assert.equal(tierMeta('seed')?.label, '씨앗')
  })

  it('첫 등급까지 남은 개수', () => {
    assert.equal(stampsToFirstTier(0), 10)
    assert.equal(stampsToFirstTier(7), 3)
    assert.equal(stampsToFirstTier(10), 0)
    assert.equal(stampsToFirstTier(99), 0)
  })

  it('등급이 없으면 다음 목표는 첫 등급(씨앗)', () => {
    assert.equal(nextTier(null)?.key, 'seed')
  })

  it('개수가 늘면 등급이 뒤로 가지 않는다 (단조)', () => {
    const order: (string | null)[] = [null, ...TIERS.map((t) => t.key)]
    let prev = -1
    for (let n = 0; n <= 80; n++) {
      const idx = order.indexOf(tierFromStamps(n))
      assert.ok(idx >= prev, `${n}개에서 등급이 후퇴`)
      prev = idx
    }
  })

  it('음수·소수를 넣어도 깨지지 않는다', () => {
    assert.equal(tierFromStamps(-3), null)
    assert.equal(tierFromStamps(9.9), null)
    assert.equal(tierFromStamps(10.4), 'seed')
  })
})
