import { test } from 'node:test'
import assert from 'node:assert/strict'
import { billingFailMessage } from './billing-fail-message.ts'

test('★사장님이 실제로 본 것 — A0 접두사가 고객에게 새면 안 된다', () => {
  const out = billingFailMessage({ code: 'A0', message: 'A0: 카드번호 오류' })
  assert.ok(!out.includes('A0'), `코드가 그대로 노출됐다: ${out}`)
  assert.match(out, /카드 번호/, '무엇을 고쳐야 하는지 알려줘야 한다')
})

test('코드 접두사 형태가 달라도 떼어낸다', () => {
  for (const m of [
    'A0: 카드번호 오류',
    'INVALID_CARD_NUMBER - 카드번호 오류',
    'F113:카드번호 오류',
  ]) {
    const out = billingFailMessage({ code: null, message: m })
    assert.ok(
      !/[A-Z]{2,}|A0|F113/.test(out),
      `코드가 남았다: ${m} → ${out}`,
    )
  }
})

test('아는 사유는 할 일을 알려준다', () => {
  assert.match(
    billingFailMessage({ code: null, message: '유효기간 오류' }),
    /유효기간/,
  )
  assert.match(
    billingFailMessage({ code: null, message: '한도초과' }),
    /한도|잔액/,
  )
  assert.match(
    billingFailMessage({ code: 'REJECT_CARD_COMPANY', message: null }),
    /카드사/,
  )
  assert.match(
    billingFailMessage({ code: null, message: '분실 카드입니다' }),
    /다른 카드/,
  )
})

test('모르는 값은 그대로 흘리지 않는다 (화이트리스트 방식)', () => {
  // 영문 원문·코드만 남은 값·빈 값 — 전부 일반 문구로 덮는다.
  for (const m of [null, '', 'UNKNOWN_ERROR', 'Something went wrong', 'E999:']) {
    const out = billingFailMessage({ code: null, message: m })
    assert.match(out, /카드 등록이 완료되지 않았어요/, `새어나감: ${m} → ${out}`)
  }
})

test('토스가 멀쩡한 한국어를 주면 그건 살린다', () => {
  const out = billingFailMessage({
    code: null,
    message: '결제 시간이 초과되었어요',
  })
  assert.equal(out, '결제 시간이 초과되었어요')
})

test('고객 문구 원칙 — 전문용어·영문 코드가 결과에 없다', () => {
  const samples = [
    { code: 'A0', message: 'A0: 카드번호 오류' },
    { code: 'INVALID_CARD_EXPIRATION', message: null },
    { code: null, message: 'PAY_PROCESS_ABORTED: 결제가 중단되었습니다' },
  ]
  for (const s of samples) {
    const out = billingFailMessage(s)
    assert.ok(
      !/[A-Za-z]{3,}/.test(out),
      `영문 잔재가 고객 문구에 남았다: ${JSON.stringify(s)} → ${out}`,
    )
  }
})
