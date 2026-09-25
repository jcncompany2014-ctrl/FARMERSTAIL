import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  shipBlockReason,
  isShippable,
  chargeRunPassed,
  SHIP_BLOCK_LABEL,
  type ShipBlockInput,
} from './ship-block.ts'

/**
 * 무료 박스 발송 회귀 가드 (2026-08-12 반증감사 2·3라운드).
 *
 * 실제로 있었던 세 경로를 재현한다 — 셋 다 "돈을 못 받았는데 박스가 나간다".
 */

const OK: ShipBlockInput = {
  cannotCharge: false,
  chargeFailedToday: false,
  pausedBeforeCharge: false,
  skippedNotCharged: false,
  overdueNotCharged: false,
  notChargedAfterRun: false,
}

describe('shipBlockReason — 돈을 못 받은 박스는 반드시 막힌다', () => {
  it('정상(청구 완료·문제 없음) → 발송 가능', () => {
    assert.equal(shipBlockReason(OK), null)
    assert.equal(isShippable(OK), true)
  })

  it('★재현1: 오늘 청구가 실패했는데 "청구 예정" 으로 뜨던 건', () => {
    // 청구 실패는 next_delivery_date 를 안 밀어 charged·overdue 가 모두 false 다.
    // 그래서 예전 배지 체인의 최종 else("발송일 아침 청구 예정")로 떨어졌다.
    const r = { ...OK, chargeFailedToday: true }
    assert.equal(shipBlockReason(r), 'charge_failed_today')
    assert.equal(isShippable(r), false)
  })

  it('★재현2: 고객이 결제 전에 일시정지 — "돈은 이미 받았다" 로 단언되던 건', () => {
    // 일시정지는 next_delivery_date 를 안 지운다(해지만 지운다) → 목록에 남는다.
    const r = { ...OK, pausedBeforeCharge: true }
    assert.equal(shipBlockReason(r), 'paused_before_charge')
    assert.equal(isShippable(r), false)
  })

  it('★재현3: 청구 불가(카드 영구거절) — 화면은 막았는데 라벨은 인쇄되던 건', () => {
    const r = { ...OK, cannotCharge: true }
    assert.equal(shipBlockReason(r), 'cannot_charge')
    assert.equal(isShippable(r), false)
  })

  it('★재현4: 고객이 이번 배송을 미룸(skip) — 날짜가 청구분과 같아 "청구 완료" 로 뜨던 건 (2026-08-20 6라운드)', () => {
    // skip 은 next_delivery_date 를 shipDate+14 로 미는데, 그 값이 이번 아침
    // 청구된 구독의 날짜(chargedBumpDate)와 완전히 같아 날짜로는 구분이 안 됐다.
    // 결제 증거(orderBySubId)가 없으면 발송 금지.
    const r = { ...OK, skippedNotCharged: true }
    assert.equal(shipBlockReason(r), 'skipped_not_charged')
    assert.equal(isShippable(r), false)
  })

  it('★사유가 겹치면 가장 확실한 것부터 — 정지가 청구불가를 가리지 않는다', () => {
    // 예전 배지 체인은 paused 를 맨 앞에 둬서, 카드가 영구 거절된 구독을
    // "고객이 정지" 로만 보여주고 '청구 불가' 경고를 가렸다.
    const r = {
      cannotCharge: true,
      chargeFailedToday: true,
      pausedBeforeCharge: true,
      skippedNotCharged: true,
      overdueNotCharged: true,
      notChargedAfterRun: true,
    }
    assert.equal(shipBlockReason(r), 'cannot_charge')
  })

  it('모든 금지 사유에 사람이 읽을 라벨이 있다 (CSV·화면 공용)', () => {
    for (const reason of [
      'cannot_charge',
      'charge_failed_today',
      'paused_before_charge',
      'skipped_not_charged',
      'overdue_not_charged',
      'not_charged_after_run',
    ] as const) {
      assert.ok(SHIP_BLOCK_LABEL[reason].includes('발송금지'), reason)
    }
  })

  it('★불변식: 금지 사유가 하나라도 있으면 절대 발송 가능이 아니다', () => {
    // 조합 전수(2^6=64) — 하나라도 true 면 isShippable=false 여야 한다.
    const keys = Object.keys(OK) as Array<keyof ShipBlockInput>
    for (let mask = 0; mask < 1 << keys.length; mask++) {
      const input = { ...OK }
      keys.forEach((k, i) => {
        input[k] = Boolean(mask & (1 << i))
      })
      assert.equal(isShippable(input), mask === 0, JSON.stringify(input))
    }
  })
})

// ── 2026-09-25 출시 전 점검 3차 — 남아 있던 무료 박스 경로 두 개 ──
describe('shipBlockReason — 청구 지연·청구 시각 지남', () => {
  it('★재현5: 예정일이 지났고 결제 주문이 없음(재시도 중) — 빨간 배지인데 라벨이 인쇄되던 건', () => {
    const r = { ...OK, overdueNotCharged: true }
    assert.equal(shipBlockReason(r), 'overdue_not_charged')
    assert.equal(isShippable(r), false)
  })

  it('★재현6: 발송일 09:10 이 지났는데 청구가 없음(크론 실패) — "청구 예정"으로 발송 가능이던 건', () => {
    const r = { ...OK, notChargedAfterRun: true }
    assert.equal(shipBlockReason(r), 'not_charged_after_run')
    assert.equal(isShippable(r), false)
  })

  it('모든 사유에 CSV 라벨이 있다', () => {
    for (const k of ['overdue_not_charged', 'not_charged_after_run'] as const) {
      assert.ok(SHIP_BLOCK_LABEL[k].includes('발송금지'))
    }
  })
})

describe('chargeRunPassed — 발송일 KST 09:10 경계', () => {
  // 2026-09-29 는 화요일. 09:10 KST = 00:10 UTC
  it('발송일 09:09 KST 는 아직 청구 전', () => {
    assert.equal(chargeRunPassed('2026-09-29', new Date('2026-09-29T00:09:00Z')), false)
  })
  it('발송일 09:10 KST 부터 지남', () => {
    assert.equal(chargeRunPassed('2026-09-29', new Date('2026-09-29T00:10:00Z')), true)
  })
  it('발송일 전날(월) 밤은 전 — UTC 로는 같은 날이어도 KST 로 판정', () => {
    // 2026-09-28 23:30 KST = 2026-09-28T14:30Z
    assert.equal(chargeRunPassed('2026-09-29', new Date('2026-09-28T14:30:00Z')), false)
  })
  it('발송일 이후 날짜로 보면 지난 것', () => {
    assert.equal(chargeRunPassed('2026-09-29', new Date('2026-09-30T01:00:00Z')), true)
  })
})
