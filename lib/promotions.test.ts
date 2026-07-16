/**
 * 프로모션 — 기간·상한·중복 판정.
 *
 * 이건 **돈**이다. 기간이 지났는데 열려 있으면 마진이 새고, 아직인데 닫혀 있으면
 * 부스 앞에서 손님이 못 받는다. 경계를 박제한다.
 *
 * 핵심 회귀 방지:
 *  1. 종료 시각 **정각은 아직 열려 있다** — 11/30 23:59:59 에 들어온 사람은 받아야 한다.
 *  2. 상한은 **도달하면 즉시** 닫힌다(100명 상한에 100명째는 마지막, 101명째는 거부).
 *  3. 할인은 **절대 더하지 않는다** — 등급 vs 프로모션 중 큰 쪽 하나.
 *  4. 잘못된 코드는 DB 까지 안 간다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  promotionGate,
  promotionRate,
  pickBetterDiscount,
  normalizePromoCode,
  type PromotionLike,
} from './promotions.ts'

const promo = (over: Partial<PromotionLike> = {}): PromotionLike => ({
  code: 'busan1102',
  discount_rate: 0.5,
  starts_at: '2026-11-02T00:00:00Z',
  ends_at: '2026-11-03T23:59:59Z',
  max_signups: null,
  active: true,
  ...over,
})

const at = (iso: string) => new Date(iso)

describe('열림 판정 — 기간', () => {
  it('기간 안이면 열린다', () => {
    assert.deepEqual(promotionGate(promo(), at('2026-11-02T12:00:00Z'), 0), { open: true })
  })

  it('시작 전이면 닫힘', () => {
    const g = promotionGate(promo(), at('2026-11-01T23:59:59Z'), 0)
    assert.deepEqual(g, { open: false, reason: 'not_started' })
  })

  it('★종료 시각 정각은 아직 열려 있다 (마지막 1초를 놓치면 부스 앞에서 사고)', () => {
    assert.deepEqual(promotionGate(promo(), at('2026-11-03T23:59:59Z'), 0), { open: true })
  })

  it('종료 시각을 지나면 닫힘', () => {
    const g = promotionGate(promo(), at('2026-11-04T00:00:00Z'), 0)
    assert.deepEqual(g, { open: false, reason: 'ended' })
  })

  it('시작 시각 정각은 열려 있다', () => {
    assert.deepEqual(promotionGate(promo(), at('2026-11-02T00:00:00Z'), 0), { open: true })
  })
})

describe('열림 판정 — 상한', () => {
  it('상한이 null 이면 무제한', () => {
    const g = promotionGate(promo({ max_signups: null }), at('2026-11-02T12:00:00Z'), 9999)
    assert.deepEqual(g, { open: true })
  })

  it('상한 직전은 열려 있다 (100명 상한에 99명 → 100번째 받는다)', () => {
    const g = promotionGate(promo({ max_signups: 100 }), at('2026-11-02T12:00:00Z'), 99)
    assert.deepEqual(g, { open: true })
  })

  it('★상한에 도달하면 즉시 닫힌다 (100명 상한에 100명 → 101번째 거부)', () => {
    const g = promotionGate(promo({ max_signups: 100 }), at('2026-11-02T12:00:00Z'), 100)
    assert.deepEqual(g, { open: false, reason: 'full' })
  })

  it('상한 0 이면 아무도 못 받는다', () => {
    const g = promotionGate(promo({ max_signups: 0 }), at('2026-11-02T12:00:00Z'), 0)
    assert.deepEqual(g, { open: false, reason: 'full' })
  })
})

describe('열림 판정 — 사유 우선순위', () => {
  it('손으로 끈 게 최우선 (기간 안이어도 꺼져 있으면 닫힘)', () => {
    const g = promotionGate(promo({ active: false }), at('2026-11-02T12:00:00Z'), 0)
    assert.deepEqual(g, { open: false, reason: 'inactive' })
  })

  it('기간이 상한보다 먼저 (끝난 이벤트는 "인원 마감"이 아니라 "종료됨")', () => {
    const g = promotionGate(
      promo({ max_signups: 1 }),
      at('2026-12-01T00:00:00Z'),
      99,
    )
    assert.deepEqual(g, { open: false, reason: 'ended' })
  })
})

describe('할인율 — 이상한 값이 결제로 못 간다', () => {
  it('정상값 그대로', () => {
    assert.equal(promotionRate(promo({ discount_rate: 0.5 })), 0.5)
  })

  it('1 을 넘으면 1 로 자른다 (음수 청구 방지)', () => {
    assert.equal(promotionRate(promo({ discount_rate: 1.5 })), 1)
  })

  it('음수는 0', () => {
    assert.equal(promotionRate(promo({ discount_rate: -0.3 })), 0)
  })

  it('NaN 은 0', () => {
    assert.equal(promotionRate(promo({ discount_rate: NaN })), 0)
  })
})

describe('등급 vs 프로모션 — 절대 더하지 않는다', () => {
  const tier10 = { rate: 0.1, label: '나무 등급 할인' }
  const promo50 = { rate: 0.5, label: '부산 펫박람회' }

  it('★큰 쪽 하나만 (10% + 50% = 60% 가 아니다)', () => {
    const d = pickBetterDiscount(tier10, promo50)
    assert.equal(d.rate, 0.5)
    assert.equal(d.reason, 'promotion')
    assert.equal(d.label, '부산 펫박람회')
  })

  it('등급이 더 크면 등급', () => {
    const d = pickBetterDiscount({ rate: 0.3, label: '나무' }, { rate: 0.1, label: '이벤트' })
    assert.equal(d.rate, 0.3)
    assert.equal(d.reason, 'tier')
  })

  it('같으면 등급 — 고객이 쌓아 온 것이 먼저 보인다', () => {
    const d = pickBetterDiscount({ rate: 0.5, label: '나무' }, { rate: 0.5, label: '이벤트' })
    assert.equal(d.reason, 'tier')
  })

  it('프로모션이 없으면 등급', () => {
    assert.equal(pickBetterDiscount(tier10, null).reason, 'tier')
  })

  it('둘 다 없으면 할인 없음', () => {
    const d = pickBetterDiscount({ rate: 0, label: '' }, null)
    assert.deepEqual(d, { rate: 0, reason: 'none', label: '' })
  })

  it('등급 0 + 프로모션만 (첫 주문의 실제 모습 — 스탬프 0개라 등급이 없다)', () => {
    const d = pickBetterDiscount({ rate: 0, label: '' }, promo50)
    assert.equal(d.rate, 0.5)
    assert.equal(d.reason, 'promotion')
  })
})

describe('코드 정규화 — 이상한 값은 DB 까지 안 간다', () => {
  it('대소문자·공백 통일', () => {
    assert.equal(normalizePromoCode('  BuSan1102 '), 'busan1102')
  })

  it('하이픈·언더바 허용', () => {
    assert.equal(normalizePromoCode('insta-11_a'), 'insta-11_a')
  })

  it('빈 값·없음은 null', () => {
    assert.equal(normalizePromoCode(null), null)
    assert.equal(normalizePromoCode(undefined), null)
    assert.equal(normalizePromoCode('   '), null)
  })

  it('너무 짧거나 긴 건 null', () => {
    assert.equal(normalizePromoCode('a'), null)
    assert.equal(normalizePromoCode('a'.repeat(41)), null)
  })

  it('이상한 문자는 null (SQL·경로 장난 차단)', () => {
    assert.equal(normalizePromoCode("bu'san"), null)
    assert.equal(normalizePromoCode('bu san'), null)
    assert.equal(normalizePromoCode('../etc'), null)
    assert.equal(normalizePromoCode('<script>'), null)
  })

  it('숫자로 시작해도 되지만 기호로 시작하면 안 된다', () => {
    assert.equal(normalizePromoCode('2026busan'), '2026busan')
    assert.equal(normalizePromoCode('-busan'), null)
  })
})
