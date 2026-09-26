import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { bannerWindow, isBannerVisible, periodLabel, sortEndedLast, ENDED_GRACE_DAYS } from './status.ts'

describe('/link 배너 기간 판정', () => {
  it('기간 없음 = 항상 진행 중', () => {
    assert.equal(bannerWindow('2026-09-26', null, null), 'active')
    assert.equal(bannerWindow('2026-09-26', undefined, undefined), 'active')
  })
  it('시작 전 = upcoming(숨김), 시작일 당일부터 진행 중', () => {
    assert.equal(bannerWindow('2026-09-23', '2026-09-24', '2026-09-30'), 'upcoming')
    assert.equal(bannerWindow('2026-09-24', '2026-09-24', '2026-09-30'), 'active')
  })
  it('종료일 당일까지 진행 중, 다음 날부터 14일간 회색(ended_recent)', () => {
    assert.equal(bannerWindow('2026-09-30', '2026-09-24', '2026-09-30'), 'active')
    assert.equal(bannerWindow('2026-10-01', '2026-09-24', '2026-09-30'), 'ended_recent')
    assert.equal(bannerWindow('2026-10-14', '2026-09-24', '2026-09-30'), 'ended_recent')
  })
  it('종료 15일째부터 자동 숨김(expired)', () => {
    assert.equal(ENDED_GRACE_DAYS, 14)
    assert.equal(bannerWindow('2026-10-15', '2026-09-24', '2026-09-30'), 'expired')
    assert.equal(bannerWindow('2027-01-01', null, '2026-09-30'), 'expired')
  })
  it('유예 일수는 바꿀 수 있다', () => {
    assert.equal(bannerWindow('2026-10-03', null, '2026-09-30', 2), 'expired')
    assert.equal(bannerWindow('2026-10-02', null, '2026-09-30', 2), 'ended_recent')
  })
  it('배지 옆 기간 문구 — 연도 없이 M.D, 한쪽만 있어도 표시, 없으면 빈 문자열', () => {
    assert.equal(periodLabel('2026-09-24', '2026-09-30'), '9.24 ~ 9.30')
    assert.equal(periodLabel(null, '2026-10-05'), '~ 10.5')
    assert.equal(periodLabel('2026-11-01', null), '11.1 ~')
    assert.equal(periodLabel(null, null), '')
  })
  it('마감된 배너는 자동으로 아래로 — 무리 안 순서는 유지', () => {
    const items = [
      { id: 'a', window: 'ended_recent' as const },
      { id: 'b', window: 'active' as const },
      { id: 'c', window: 'ended_recent' as const },
      { id: 'd', window: 'active' as const },
    ]
    assert.deepEqual(sortEndedLast(items).map((x) => x.id), ['b', 'd', 'a', 'c'])
  })
  it('표시 여부 — active·ended_recent 만 그린다', () => {
    assert.equal(isBannerVisible('active'), true)
    assert.equal(isBannerVisible('ended_recent'), true)
    assert.equal(isBannerVisible('upcoming'), false)
    assert.equal(isBannerVisible('expired'), false)
  })
})
