import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkChargeAmount,
  CHARGE_AMOUNT_TOLERANCE,
} from './charge-amount-guard.ts'

/**
 * 2026-07-30 최종감사로 규칙이 바뀌었다: **항상 저장된 금액으로 청구**하고,
 * 재계산은 알림에만 쓴다. 이 테스트가 지키는 것 세 가지 —
 *  ① 저장 금액보다 **적게** 긁지 않는다 (실측 −40.6% 저청구를 만든 min() 제거)
 *  ② 저장 금액보다 **많이** 긁지 않는다
 *  ③ 어긋나면 반드시 알린다 (조용히 넘어가지 않는다)
 * 왜 자동 차단을 뺐는지는 구현 파일 docstring 에 있다.
 */

test('★ 재현 케이스: 재계산이 낮게 나와도 저장 금액으로 청구한다 (저청구 금지)', () => {
  // 2026-08-04 청구 예정이던 실제 구독: 저장 153,100 / 재계산 90,900(잘못된 회차).
  // 옛 규칙은 min() 으로 90,900원을 긁었다 — 62,200원 손실.
  const v = checkChargeAmount(153100, 90900)
  assert.equal(v.chargeBase, 153100)
  assert.equal(v.mismatch, true)
  assert.equal(v.direction, 'stored-higher')
})

test('★ 재현 케이스: 재계산이 높게 나와도 청구를 막지 않는다 (정상 고객 차단 금지)', () => {
  // 품절 중 주문(111,400 저장) → 재입고(재계산 284,300). 조작이 아니다.
  // 옛 규칙은 refuse 로 청구를 영구 거부했다 — 박스는 계속 나가면서.
  const v = checkChargeAmount(111400, 284300)
  assert.equal(v.chargeBase, 111400)
  assert.equal(v.mismatch, true)
  assert.equal(v.direction, 'stored-lower')
})

test('★ 어긋나면 반드시 알린다 — 조용히 넘어가면 아무도 모른다', () => {
  assert.equal(checkChargeAmount(100, 60000).mismatch, true)
  assert.equal(checkChargeAmount(60000, 100).mismatch, true)
})

test('일치하면 알리지 않는다', () => {
  const v = checkChargeAmount(60000, 60000)
  assert.equal(v.chargeBase, 60000)
  assert.equal(v.mismatch, false)
  assert.equal(v.direction, null)
})

test('반올림 오차(허용치 이내)는 양방향 모두 정상', () => {
  assert.equal(checkChargeAmount(60000 - CHARGE_AMOUNT_TOLERANCE, 60000).mismatch, false)
  assert.equal(checkChargeAmount(60000 + CHARGE_AMOUNT_TOLERANCE, 60000).mismatch, false)
})

test('허용치를 1원이라도 넘으면 알린다 (양방향)', () => {
  assert.equal(checkChargeAmount(60000 - CHARGE_AMOUNT_TOLERANCE - 1, 60000).mismatch, true)
  assert.equal(checkChargeAmount(60000 + CHARGE_AMOUNT_TOLERANCE + 1, 60000).mismatch, true)
})

test('재계산 불가면 대조 없이 저장 금액으로 — 알림도 없다', () => {
  // 처방·화식비율·제품이 없으면 근거가 없다. 예전엔 이 경로가 우회구멍이었지만
  // 이제 total_amount 자체를 고객이 못 고친다(DB 권한 회수).
  for (const r of [null, 0, -1]) {
    const v = checkChargeAmount(60000, r)
    assert.equal(v.chargeBase, 60000)
    assert.equal(v.mismatch, false)
    assert.equal(v.recomputed, null)
  }
})

test('★ 어떤 입력에서도 청구액은 저장 금액과 같다 (불변식)', () => {
  // 이 테스트가 깨지면 저청구 또는 과청구가 다시 생긴 것이다.
  const cases: Array<[number, number | null]> = [
    [153100, 90900],
    [111400, 284300],
    [100, 60000],
    [60000, 60000],
    [60000, null],
    [1, 999999],
    [999999, 1],
  ]
  for (const [stored, recomputed] of cases) {
    assert.equal(
      checkChargeAmount(stored, recomputed).chargeBase,
      stored,
      `stored=${stored} recomputed=${recomputed}`,
    )
  }
})
