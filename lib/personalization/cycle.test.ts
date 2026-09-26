/**
 * 처방 사이클 정본 테스트 — 재제안 주기·체크인 시점·커버 기간이 서로 정합하는지.
 * 값을 바꿔도 이 관계가 깨지면 안 된다(오늘 잡은 "drift" 버그의 재발 방지).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  BOXES_PER_CYCLE,
  DELIVERY_INTERVAL_DAYS,
  CYCLE_COVER_DAYS,
  CHECKIN_AT_BOX,
  isCycleDue,
  checkinDueDayOffset,
  isCheckinLinkVisible,
  CHECKIN_WINDOW_BEFORE,
  CHECKIN_WINDOW_AFTER,
  newFormulaAppliedFrom,
} from './cycle.ts'

describe('isCycleDue — 배송 회차 만기 판정', () => {
  it('박스가 BOXES_PER_CYCLE 개 미만이면 아직 아님', () => {
    for (let n = 0; n < BOXES_PER_CYCLE; n++) {
      assert.equal(isCycleDue(n), false, `${n}박스`)
    }
  })
  it('BOXES_PER_CYCLE 개 이상이면 만기', () => {
    assert.equal(isCycleDue(BOXES_PER_CYCLE), true)
    assert.equal(isCycleDue(BOXES_PER_CYCLE + 5), true) // 밀린 것도 만기
  })
})

describe('checkinDueDayOffset — 체크인 시점은 배송 회차에서 파생', () => {
  it('week_2 = 2번째 박스 = 적용 후 14일', () => {
    assert.equal(checkinDueDayOffset('week_2'), 14)
    assert.equal(
      checkinDueDayOffset('week_2'),
      (CHECKIN_AT_BOX.week_2 - 1) * DELIVERY_INTERVAL_DAYS,
    )
  })
  it('week_4 = 3번째 박스 = 적용 후 28일', () => {
    assert.equal(checkinDueDayOffset('week_4'), 28)
  })
})

describe('정합 불변식 — 이게 깨지면 조용히 죽는다', () => {
  it('종합 체크인(마지막 박스)은 재제안 만기 전에 온다', () => {
    // 종합 체크인이 재제안보다 늦으면 그 데이터를 못 쓰고 다시 계산하는 꼴.
    const lastCheckinBox = Math.max(...Object.values(CHECKIN_AT_BOX))
    assert.ok(
      lastCheckinBox <= BOXES_PER_CYCLE,
      `마지막 체크인 박스(${lastCheckinBox})가 재제안 주기(${BOXES_PER_CYCLE})보다 늦다`,
    )
  })

  it('커버 기간은 마지막 박스의 급여가 끝날 때까지 이어진다(공백 없음)', () => {
    // 마지막 박스(BOXES_PER_CYCLE 번째)는 (N-1)×14 일에 나가 그 뒤 14일치를 먹는다.
    // 커버가 그보다 짧으면 그 사이 배송에서 활성 처방을 못 찾는 공백이 난다.
    const lastBoxShipDay = (BOXES_PER_CYCLE - 1) * DELIVERY_INTERVAL_DAYS
    const lastBoxEatenUntil = lastBoxShipDay + DELIVERY_INTERVAL_DAYS
    assert.ok(
      CYCLE_COVER_DAYS >= lastBoxEatenUntil,
      `커버(${CYCLE_COVER_DAYS})가 마지막 박스 급여 종료(${lastBoxEatenUntil})보다 짧다 — 공백 발생`,
    )
  })

  it('CYCLE_COVER_DAYS = 박스 수 × 배송 간격', () => {
    assert.equal(CYCLE_COVER_DAYS, BOXES_PER_CYCLE * DELIVERY_INTERVAL_DAYS)
  })
})

describe('isCheckinLinkVisible — 노출 창', () => {
  it('요청일 정확히(D-0) 보인다', () => {
    assert.equal(isCheckinLinkVisible(0), true)
  })
  it('요청 전 최대 CHECKIN_WINDOW_BEFORE 일까지 보인다', () => {
    assert.equal(isCheckinLinkVisible(CHECKIN_WINDOW_BEFORE), true)
    assert.equal(isCheckinLinkVisible(CHECKIN_WINDOW_BEFORE + 1), false)
  })
  it('요청 후 최대 CHECKIN_WINDOW_AFTER 일까지 보인다(지각 응답 허용)', () => {
    assert.equal(isCheckinLinkVisible(-CHECKIN_WINDOW_AFTER), true)
    assert.equal(isCheckinLinkVisible(-CHECKIN_WINDOW_AFTER - 1), false)
  })
})

describe('newFormulaAppliedFrom — 새 처방은 다음 박스부터 (그날 결제된 박스는 옛 처방)', () => {
  it('박스 3 발송일(화) 10:10 크론 — 청구 뒤라 다음 발송일은 +14 → 그날부터', () => {
    assert.equal(newFormulaAppliedFrom('2026-10-13', '2026-10-27'), '2026-10-27')
  })
  it('박스 4 발송일 아침(청구 전) 승인 — 다음 발송일이 오늘 → 오늘 박스부터', () => {
    assert.equal(newFormulaAppliedFrom('2026-10-27', '2026-10-27'), '2026-10-27')
  })
  it('다음 발송일 없음(구독 없음·일시정지) → 오늘', () => {
    assert.equal(newFormulaAppliedFrom('2026-10-13', null), '2026-10-13')
    assert.equal(newFormulaAppliedFrom('2026-10-13', undefined), '2026-10-13')
  })
  it('밀린 발송일(과거) → 오늘 · timestamp 문자열도 날짜로', () => {
    assert.equal(newFormulaAppliedFrom('2026-10-15', '2026-10-13'), '2026-10-15')
    assert.equal(newFormulaAppliedFrom('2026-10-13', '2026-10-27T00:00:00+09:00'), '2026-10-27')
  })
  it('먼 미래 발송일(고객이 직접 쓴 값)은 오늘+14 로 자른다 — 새 처방이 영원히 안 시작되는 것 방지', () => {
    assert.equal(newFormulaAppliedFrom('2026-10-13', '2099-12-29'), '2026-10-27')
    assert.equal(newFormulaAppliedFrom('2026-10-13', '2026-11-10'), '2026-10-27')
  })
  it('박스 N = applied_from + (N-1)×14 — 체크인이 새 처방의 2·3번째 박스에 물린다', () => {
    const from = newFormulaAppliedFrom('2026-10-13', '2026-10-27')
    const at = (d: number) => new Date(Date.parse(from + 'T00:00:00Z') + d * 86_400_000).toISOString().slice(0, 10)
    assert.equal(at(checkinDueDayOffset('week_2')), '2026-11-10')
    assert.equal(at(checkinDueDayOffset('week_4')), '2026-11-24')
  })
})
