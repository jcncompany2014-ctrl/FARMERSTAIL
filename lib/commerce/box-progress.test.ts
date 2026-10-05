import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { boxStage, preparingDetail, stageDetail, BOX_STAGES } from './box-progress.ts'

// 2026-10-10 = 토, 10-13 = 화(발송), 10-14 = 수
const paid = { payment_status: 'paid', shipped_at: null, delivered_at: null }

describe('홈 박스 진행 카드 — 발송 준비 → 발송 → 배송 중 → 배송 완료 (2026-10-01 사장님)', () => {
  it('단계 4개, 사장님이 정한 이름 그대로', () => {
    assert.deepEqual(BOX_STAGES.map((s) => s.label), ['발송 준비', '발송', '배송 중', '배송 완료'])
  })
  it('결제 전·취소·환불은 카드를 띄우지 않는다', () => {
    assert.equal(boxStage({ ...paid, order_status: 'pending', payment_status: 'pending' }, '2026-10-10'), null)
    assert.equal(boxStage({ ...paid, order_status: 'cancelled' }, '2026-10-10'), null)
    assert.equal(boxStage({ ...paid, order_status: 'preparing', payment_status: 'refunded' }, '2026-10-10'), null)
  })
  it('결제됨·출고 준비 = 발송 준비', () => {
    assert.equal(boxStage({ ...paid, order_status: 'preparing' }, '2026-10-10'), 'preparing')
  })
  it('보낸 그날 = 발송, 다음 날부터 = 배송 중 (KST 기준)', () => {
    // 10-13 화 10:00 KST = 01:00Z
    const shipping = { ...paid, order_status: 'shipping', shipped_at: '2026-10-13T01:00:00Z' }
    assert.equal(boxStage(shipping, '2026-10-13'), 'shipped')
    assert.equal(boxStage(shipping, '2026-10-14'), 'in_transit')
    // 밤 11시 KST(14:00Z)에 보낸 것도 그날
    assert.equal(boxStage({ ...shipping, shipped_at: '2026-10-13T14:00:00Z' }, '2026-10-13'), 'shipped')
  })
  it('배송 완료는 이틀만 보이고, 완료 시각을 모르면 띄우지 않는다', () => {
    const done = { ...paid, order_status: 'delivered', delivered_at: '2026-10-14T05:00:00Z' }
    assert.equal(boxStage(done, '2026-10-14'), 'delivered')
    assert.equal(boxStage(done, '2026-10-16'), 'delivered')
    assert.equal(boxStage(done, '2026-10-17'), null)
    assert.equal(boxStage({ ...paid, order_status: 'delivered' }, '2026-10-14'), null)
  })
  it('발송 준비 한 줄 — 주말 조리 · 월 포장 · 화 발송 리듬과 같은 말', () => {
    assert.match(preparingDetail('2026-10-13', '2026-10-09'), /원료를 준비/) // 금
    assert.match(preparingDetail('2026-10-13', '2026-10-10'), /만들고 있어요/) // 토
    assert.match(preparingDetail('2026-10-13', '2026-10-11'), /만들고 있어요/) // 일
    assert.match(preparingDetail('2026-10-13', '2026-10-12'), /포장/) // 월
    assert.match(preparingDetail('2026-10-13', '2026-10-13'), /오늘 보내드려요/) // 화
    // 발송일이 지났는데 아직 준비 중 — '오늘 보내드려요'를 반복하지 않는다(10차 점검 D).
    assert.equal(preparingDetail('2026-10-13', '2026-10-14'), '발송 일정을 확인하고 있어요') // 수
    assert.equal(preparingDetail(null, '2026-10-10'), '박스를 준비하고 있어요')
  })
  it('도착 요일을 약속하지 않는다', () => {
    for (const st of BOX_STAGES) assert.doesNotMatch(stageDetail(st.key, '2026-10-13', '2026-10-10'), /수요일|목요일/)
  })
})
