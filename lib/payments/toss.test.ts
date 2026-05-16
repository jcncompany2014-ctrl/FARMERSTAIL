import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  paymentMethodLabel,
  bankCodeLabel,
  formatDueDate,
} from './toss.ts'

/**
 * lib/payments/toss.ts — pure 헬퍼 회귀 가드.
 *
 * external API 호출 함수 (confirmPayment/cancelPayment/chargeBillingKey 등)
 * 는 mock 필요 → 별도 e2e 또는 integration test 에 위임.
 *
 * 여기서는 pure 변환 함수만:
 *  - paymentMethodLabel: Toss 응답 method 한국어 통일 (영문/한글 양쪽 형식)
 *  - bankCodeLabel: 한국은행 표준 코드 → 은행명
 *  - formatDueDate: 가상계좌 만료 시각 표시 (KST 23:59 까지)
 */

describe('paymentMethodLabel', () => {
  it('한국어 응답 "카드" → "신용·체크카드"', () => {
    assert.equal(paymentMethodLabel('카드'), '신용·체크카드')
  })

  it('영문 응답 "CARD" → "신용·체크카드" (양쪽 호환)', () => {
    assert.equal(paymentMethodLabel('CARD'), '신용·체크카드')
  })

  it('가상계좌 — 한글/영문 양쪽 매핑', () => {
    assert.equal(paymentMethodLabel('가상계좌'), '가상계좌')
    assert.equal(paymentMethodLabel('VIRTUAL_ACCOUNT'), '가상계좌')
  })

  it('계좌이체 — 한글/영문', () => {
    assert.equal(paymentMethodLabel('계좌이체'), '계좌이체')
    assert.equal(paymentMethodLabel('TRANSFER'), '계좌이체')
  })

  it('휴대폰 결제', () => {
    assert.equal(paymentMethodLabel('휴대폰'), '휴대폰 결제')
    assert.equal(paymentMethodLabel('MOBILE_PHONE'), '휴대폰 결제')
  })

  it('간편결제 / 토스페이', () => {
    assert.equal(paymentMethodLabel('간편결제'), '간편결제')
    assert.equal(paymentMethodLabel('EASY_PAY'), '간편결제')
    assert.equal(paymentMethodLabel('토스페이'), '토스페이')
    assert.equal(paymentMethodLabel('TOSSPAY'), '토스페이')
  })

  it('null / undefined → "알 수 없음"', () => {
    assert.equal(paymentMethodLabel(null), '알 수 없음')
    assert.equal(paymentMethodLabel(undefined), '알 수 없음')
  })

  it('매핑 없는 값 → 원문 유지 (Toss 새 응답 대응)', () => {
    assert.equal(paymentMethodLabel('GIFT_CARD_2026'), 'GIFT_CARD_2026')
  })
})

describe('bankCodeLabel', () => {
  it('주요 시중은행', () => {
    assert.equal(bankCodeLabel('06'), 'KB국민은행')
    assert.equal(bankCodeLabel('88'), '신한은행')
    assert.equal(bankCodeLabel('20'), '우리은행')
    assert.equal(bankCodeLabel('81'), '하나은행')
    assert.equal(bankCodeLabel('11'), 'NH농협은행')
    assert.equal(bankCodeLabel('03'), 'IBK기업은행')
  })

  it('인터넷전문은행 — 카카오 / 토스 / 케이뱅크', () => {
    assert.equal(bankCodeLabel('90'), '카카오뱅크')
    assert.equal(bankCodeLabel('92'), '토스뱅크')
    assert.equal(bankCodeLabel('89'), '케이뱅크')
  })

  it('지방은행', () => {
    assert.equal(bankCodeLabel('39'), '경남은행')
    assert.equal(bankCodeLabel('32'), '부산은행')
    assert.equal(bankCodeLabel('31'), 'DGB대구은행')
    assert.equal(bankCodeLabel('34'), '광주은행')
  })

  it('null / undefined / 빈 문자열 → 빈 문자열 (UI 에서 안 그림)', () => {
    assert.equal(bankCodeLabel(null), '')
    assert.equal(bankCodeLabel(undefined), '')
    assert.equal(bankCodeLabel(''), '')
  })

  it('매핑 없는 코드 → 원문 (안전 fallback)', () => {
    assert.equal(bankCodeLabel('99'), '99')
    assert.equal(bankCodeLabel('XX'), 'XX')
  })
})

describe('formatDueDate', () => {
  it('정상 ISO → "M월 D일 23:59까지"', () => {
    // KST 자정 = UTC 15:00 (전일). Toss dueDate 가 KST timezone 으로 옴.
    const out = formatDueDate('2026-04-25T00:00:00+09:00')
    // Date 객체가 local timezone 으로 변환되니 month/day 만 매치 검증.
    assert.match(out, /4월|5월/) // KST 변환 시 4월 25일 또는 5월 (timezone 영향)
    assert.match(out, /23:59까지/)
  })

  it('월/일 정수 변환 — 1월 1일 등', () => {
    const out = formatDueDate('2026-01-01T15:00:00+09:00')
    assert.match(out, /\d{1,2}월\s\d{1,2}일\s23:59까지/)
  })

  it('null / undefined → 빈 문자열', () => {
    assert.equal(formatDueDate(null), '')
    assert.equal(formatDueDate(undefined), '')
  })

  it('invalid ISO → 빈 문자열 (방어)', () => {
    assert.equal(formatDueDate('not-a-date'), '')
    assert.equal(formatDueDate(''), '')
  })

  it('formatting invariant — "23:59까지" 명시', () => {
    // Toss dueDate 는 자정까지인데 사용자에게 "0시까지" 라 하면 헷갈림 →
    // 항상 "23:59까지" 로 표기해야 함.
    const out = formatDueDate('2026-06-15T15:00:00+09:00')
    assert.ok(out.includes('23:59까지'))
    assert.ok(!out.includes('0:00')) // 0시 표기 X
  })
})
