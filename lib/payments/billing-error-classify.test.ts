import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyBillingError,
  describeBillingError,
  chargeRetrySuffix,
  RETRY_COOLDOWN_MS,
} from './billing-error-classify.ts'

/**
 * lib/payments/billing-error-classify.ts — Toss 정기결제 에러 분류 회귀 가드.
 *
 * 분류가 잘못되면 cron 동작이 깨짐:
 *  - permanent → transient 잘못 잡으면 만료된 카드로 24h 마다 무의미 retry
 *  - transient → permanent 잘못 잡으면 잔액 부족 한 번에 영구 일시정지
 *
 * Toss 응답 형식 흔들림 (대소문자 / snake_case) 에도 robust.
 */

describe('classifyBillingError — permanent', () => {
  it('EXPIRED_CARD → permanent', () => {
    assert.equal(classifyBillingError('EXPIRED_CARD'), 'permanent')
  })

  it('INVALID_CARD / INVALID_CARD_NUMBER → permanent', () => {
    assert.equal(classifyBillingError('INVALID_CARD'), 'permanent')
    assert.equal(classifyBillingError('INVALID_CARD_NUMBER'), 'permanent')
  })

  it('INVALID_BILLING_KEY / NOT_FOUND_BILLING_KEY → permanent', () => {
    assert.equal(classifyBillingError('INVALID_BILLING_KEY'), 'permanent')
    assert.equal(classifyBillingError('NOT_FOUND_BILLING_KEY'), 'permanent')
  })

  it('CARD_REPORT_LOST / CARD_BLOCKED → permanent', () => {
    assert.equal(classifyBillingError('CARD_REPORT_LOST'), 'permanent')
    assert.equal(classifyBillingError('CARD_BLOCKED'), 'permanent')
  })

  it('대소문자 무관 (Toss 응답 형식 흔들림 대응)', () => {
    assert.equal(classifyBillingError('expired_card'), 'permanent')
    assert.equal(classifyBillingError('Expired_Card'), 'permanent')
  })

  it('앞뒤 공백 trim', () => {
    assert.equal(classifyBillingError('  EXPIRED_CARD  '), 'permanent')
  })
})

describe('classifyBillingError — transient', () => {
  it('INSUFFICIENT_FUNDS / INSUFFICIENT_BALANCE → transient', () => {
    assert.equal(classifyBillingError('INSUFFICIENT_FUNDS'), 'transient')
    assert.equal(classifyBillingError('INSUFFICIENT_BALANCE'), 'transient')
  })

  it('EXCEED_LIMIT 계열 → transient', () => {
    assert.equal(classifyBillingError('EXCEED_LIMIT'), 'transient')
    assert.equal(classifyBillingError('EXCEED_LIMIT_AMOUNT'), 'transient')
    assert.equal(classifyBillingError('EXCEED_DAILY_PAYMENT_LIMIT'), 'transient')
  })

  it('NETWORK_ERROR / TIMEOUT → transient', () => {
    assert.equal(classifyBillingError('NETWORK_ERROR'), 'transient')
    assert.equal(classifyBillingError('TIMEOUT'), 'transient')
    assert.equal(classifyBillingError('PAY_PROCESS_TIMEOUT'), 'transient')
  })

  it('REJECT_CARD_COMPANY / PROVIDER_ERROR (카드사 일시 장애) → transient', () => {
    assert.equal(classifyBillingError('REJECT_CARD_COMPANY'), 'transient')
    assert.equal(classifyBillingError('REJECT_CARD_PAYMENT'), 'transient')
    assert.equal(classifyBillingError('PROVIDER_ERROR'), 'transient')
  })
})

describe('classifyBillingError — unknown', () => {
  it('null / undefined → unknown', () => {
    assert.equal(classifyBillingError(null), 'unknown')
    assert.equal(classifyBillingError(undefined), 'unknown')
  })

  it('빈 문자열 → unknown', () => {
    assert.equal(classifyBillingError(''), 'unknown')
  })

  it('알 수 없는 코드 → unknown (3-strike 정책 fallback)', () => {
    assert.equal(classifyBillingError('NEW_TOSS_CODE_2026'), 'unknown')
    assert.equal(classifyBillingError('SOME_RANDOM_STRING'), 'unknown')
  })

  it('회귀 가드: permanent code 가 transient 로 잘못 분류 X', () => {
    // 만료된 카드를 transient 로 잡으면 무의미 retry → 사용자 신뢰 ↓
    assert.notEqual(classifyBillingError('EXPIRED_CARD'), 'transient')
  })

  it('회귀 가드: transient code 가 permanent 로 잘못 분류 X', () => {
    // 잔액 부족을 permanent 로 잡으면 한 번 실패에 영구 일시정지
    assert.notEqual(classifyBillingError('INSUFFICIENT_FUNDS'), 'permanent')
    assert.notEqual(classifyBillingError('EXCEED_LIMIT'), 'permanent')
  })
})

describe('describeBillingError — 한국어 사유', () => {
  it('EXPIRED_CARD → "카드 유효기간 만료"', () => {
    const r = describeBillingError('EXPIRED_CARD')
    assert.equal(r.short, '카드 유효기간 만료')
    assert.equal(r.classOf, 'permanent')
  })

  it('INVALID_CARD_NUMBER → "카드 번호 오류"', () => {
    const r = describeBillingError('INVALID_CARD_NUMBER')
    assert.equal(r.short, '카드 번호 오류')
    assert.equal(r.classOf, 'permanent')
  })

  it('INVALID_BILLING_KEY → "카드 인증 만료"', () => {
    const r = describeBillingError('INVALID_BILLING_KEY')
    assert.equal(r.short, '카드 인증 만료')
    assert.equal(r.classOf, 'permanent')
  })

  it('INSUFFICIENT_FUNDS → "잔액 부족"', () => {
    const r = describeBillingError('INSUFFICIENT_FUNDS')
    assert.equal(r.short, '잔액 부족')
    assert.equal(r.classOf, 'transient')
  })

  it('EXCEED_LIMIT → "한도 초과"', () => {
    const r = describeBillingError('EXCEED_LIMIT')
    assert.equal(r.short, '한도 초과')
    assert.equal(r.classOf, 'transient')
  })

  it('NETWORK_ERROR → "네트워크 오류 — 잠시 후 재시도"', () => {
    const r = describeBillingError('NETWORK_ERROR')
    assert.match(r.short, /네트워크/)
    assert.equal(r.classOf, 'transient')
  })

  it('REJECT_CARD_COMPANY → "카드사 일시 거절 — 잠시 후 재시도"', () => {
    const r = describeBillingError('REJECT_CARD_COMPANY')
    assert.match(r.short, /카드사 일시 거절/)
    assert.equal(r.classOf, 'transient')
  })

  it('permanent 기타 → "카드 정보 확인 필요" fallback', () => {
    const r = describeBillingError('CARD_BLOCKED')
    assert.equal(r.short, '카드 정보 확인 필요')
    assert.equal(r.classOf, 'permanent')
  })

  it('unknown → "결제 처리 실패" + classOf=unknown', () => {
    const r = describeBillingError('SOMETHING_NEW')
    assert.equal(r.short, '결제 처리 실패')
    assert.equal(r.classOf, 'unknown')
  })

  it('null → unknown + 일반 메시지', () => {
    const r = describeBillingError(null)
    assert.equal(r.classOf, 'unknown')
  })

  it('classifyBillingError 와 일관 (describeBillingError.classOf 일치)', () => {
    const codes = [
      'EXPIRED_CARD',
      'INSUFFICIENT_FUNDS',
      'NETWORK_ERROR',
      'UNKNOWN_NEW_CODE',
      null,
    ]
    for (const c of codes) {
      const cls1 = classifyBillingError(c)
      const cls2 = describeBillingError(c).classOf
      assert.equal(cls1, cls2, `${c}: ${cls1} vs ${cls2}`)
    }
  })
})

describe('RETRY_COOLDOWN_MS', () => {
  it('24 시간 (transient retry 간격)', () => {
    assert.equal(RETRY_COOLDOWN_MS, 24 * 60 * 60 * 1000)
  })
})

describe('chargeRetrySuffix — 멱등키 앵커', () => {
  /**
   * 2026-08-05 감사가 서술한 4일 시나리오를 그대로 재현한다.
   * 앵커가 날짜였을 때 3일차에 키가 **되돌아가고** 4일차에 두 번째 캡처가 났다.
   * 앵커가 failed_charge_count 면 되돌아갈 수 없다(단조 증가).
   */
  it('★확정거절 → 타임아웃 → 재시도에서 키가 되돌아가지 않는다 (단조성)', () => {
    // 1일차: 아직 실패 없음 → 접미사 없음(기본 키)
    assert.equal(chargeRetrySuffix(null, 0), '')
    // 1일차 잔액부족(확정거절) → count 1
    // 2일차: 확정거절이었으니 새 키
    const day2 = chargeRetrySuffix('INSUFFICIENT_FUNDS', 1)
    assert.equal(day2, ':r1')
    // 2일차 타임아웃(카드는 긁혔을 수 있음) → transient 라 count 유지(1)
    // ★3일차: 직전 코드가 비확정이어도 count ≥ 1 이면 **접미사를 유지**한다
    //   (2026-08-11 수정 — 옛 동작은 여기서 '' 로 base 키에 되돌아갔고, 그러면
    //   2일차 타임아웃 키(:r1)의 결과를 영영 재확인하지 않는다. 같은 :r1 을
    //   다시 쓰면 토스가 그 키의 저장 응답을 재생 — 캡처됐었다면 성공으로
    //   드러나고, 도달 못 했었다면 새 시도가 된다. 정확한 멱등 의미).
    assert.equal(chargeRetrySuffix('PAY_PROCESS_TIMEOUT', 1), ':r1')
    // 3일차도 확정거절이면 count 2 → :r2 (새 키).
    const day4 = chargeRetrySuffix('INSUFFICIENT_FUNDS', 2)
    assert.equal(day4, ':r2')
    assert.notEqual(day4, day2)
  })

  it('같은 상태에서 여러 번 돌아도 키가 같다 — 하루 두 번 실행돼도 안전', () => {
    const a = chargeRetrySuffix('INSUFFICIENT_FUNDS', 3)
    const b = chargeRetrySuffix('INSUFFICIENT_FUNDS', 3)
    assert.equal(a, b)
    assert.equal(a, ':r3')
  })

  it('결과 불명(타임아웃·네트워크)은 키를 갈아타지 않는다 — 이중청구 방지 우선', () => {
    // 실패 이력이 없으면(base 키로 시도했다 타임아웃) base 키 그대로.
    for (const code of ['PAY_PROCESS_TIMEOUT', 'TIMEOUT', 'PROVIDER_ERROR', null, undefined]) {
      assert.equal(chargeRetrySuffix(code, 0), '', `${code}`)
    }
    // 실패 이력이 있으면(마지막 시도 키가 :r5) 그 키를 그대로 재사용 — 갈아타지도,
    // base 로 되돌아가지도 않는다.
    for (const code of ['PAY_PROCESS_TIMEOUT', 'TIMEOUT', 'PROVIDER_ERROR', null, undefined]) {
      assert.equal(chargeRetrySuffix(code, 5), ':r5', `${code}`)
    }
  })

  it('★:r0 고정 회귀 가드 — 연속 확정거절은 반드시 서로 다른 키를 쓴다', () => {
    // 2026-08-11 go-live 감사: 확정거절이 transient 로 묶여 count 가 안 올라
    // 접미사가 :r0 에 고정 → 토스가 저장된 거절을 15일 재생 → 고객이 잔액을
    // 채워도 결제 동결. 크론이 확정거절마다 count 를 올리므로 키가 전진한다.
    const first = chargeRetrySuffix('INSUFFICIENT_FUNDS', 0) // :r0
    const second = chargeRetrySuffix('INSUFFICIENT_FUNDS', 1) // :r1
    assert.notEqual(first, second)
  })

  it('이상한 카운트에도 키를 만든다 — 청구가 멈추면 안 된다', () => {
    assert.equal(chargeRetrySuffix('INSUFFICIENT_FUNDS', -1), ':r0')
    assert.equal(chargeRetrySuffix('INSUFFICIENT_FUNDS', NaN), ':r0')
  })
})
