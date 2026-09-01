import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyBillingError,
  describeBillingError,
  chargeKeySuffix,
  shouldAdvanceChargeKey,
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

describe('chargeKeySuffix — 멱등키 앵커', () => {
  /**
   * 앵커의 계보: 날짜(2026-08-05 이전) → failed_charge_count(08-05) →
   * **charge_key_seq 전용 컬럼**(09-01).
   * 날짜였을 때는 3일차에 키가 되돌아가 4일차에 두 번째 캡처가 났고,
   * failed_charge_count 였을 때는 unknown 에서도 올라 키가 갈아탔고
   * 카드 재등록이 0 으로 리셋해 base 키로 되돌아갔다.
   * 지금 앵커는 "돈이 안 나간 게 보장된 실패"에서만 오르고 리셋되지 않는다.
   */
  it('앵커가 오르면 키가 전진하고, 같은 앵커면 같은 키다', () => {
    assert.equal(chargeKeySuffix(0), '') // 아직 실패 없음 → base 키
    assert.equal(chargeKeySuffix(1), ':r1')
    assert.equal(chargeKeySuffix(2), ':r2')
    // 같은 상태에서 여러 번 돌아도 같은 키 — 하루 두 번 실행돼도 안전.
    assert.equal(chargeKeySuffix(3), chargeKeySuffix(3))
    // 음수·소수·쓰레기 값이 들어와도 키를 만들어 낸다(앵커가 깨져도 base 로 폴백).
    assert.equal(chargeKeySuffix(-1), '')
    assert.equal(chargeKeySuffix(Number.NaN), '')
    assert.equal(chargeKeySuffix(2.7), ':r2')
  })

  describe('★앵커는 "돈이 안 나간 게 보장된 실패"에서만 오른다 (2026-09-01 감사)', () => {
    it('결과 불명(unknown·타임아웃·네트워크)에는 안 오른다 — 이중청구 방지', () => {
      /**
       * 이게 이번 감사에서 확정된 blocker 후보였다. 옛 앵커(failed_charge_count)는
       * **unknown 에서도 올랐다.** unknown 은 "토스가 우리 분류표에 없는 코드나
       * 코드 없는 5xx 를 줬다"는 뜻이고 그중엔 **카드가 실제로 캡처된 경우**가
       * 섞인다. 앵커가 오르면 다음 재시도가 새 키 = 토스에게 새 청구다.
       */
      for (const code of [
        'PAY_PROCESS_TIMEOUT',
        'TIMEOUT',
        'NETWORK_ERROR',
        'PROVIDER_ERROR',
        'FAILED_INTERNAL_SYSTEM_PROCESSING', // 분류표에 없는 코드 → unknown
        null,
        undefined,
      ]) {
        const cls = classifyBillingError(code)
        assert.equal(
          shouldAdvanceChargeKey(cls, code),
          false,
          `${code}(${cls}) 에서 앵커가 올랐다 — 돈이 나갔을 수 있는 실패다`,
        )
      }
    })

    it('확정거절·카드오류에는 오른다 — 저장된 거절이 15일 재생되는 걸 막는다', () => {
      // 잔액부족류: 돈이 안 나간 게 보장 → 새 키로 재시도해야 고객이 잔액을
      // 채웠을 때 결제가 살아난다(안 그러면 토스가 저장된 거절을 15일 재생).
      for (const code of ['INSUFFICIENT_FUNDS', 'EXCEED_LIMIT', 'REJECT_CARD_COMPANY']) {
        assert.equal(shouldAdvanceChargeKey(classifyBillingError(code), code), true, code)
      }
      // 카드 만료·분실·차단: 카드가 거절된 것이라 승인 자체가 없다.
      for (const code of ['EXPIRED_CARD', 'CARD_REPORT_LOST', 'INVALID_CARD_NUMBER']) {
        assert.equal(shouldAdvanceChargeKey(classifyBillingError(code), code), true, code)
      }
    })

    it('★카드 재등록 회귀 가드 — 앵커는 되돌아가지 않는다', () => {
      /**
       * 옛 앵커는 카드 재등록(billing-issue)이 0 으로 리셋했다. 그러면 접미사가
       * 사라져 **이미 써버린 base 키로 되돌아가고**, 토스가 저장한 옛 거절을
       * 재생해 재등록한 고객의 결제가 계속 실패했다 — 화면과 메일은 "다시
       * 등록하면 자동으로 재개돼요"라고 약속하는데.
       *
       * 앵커를 charge_key_seq 로 분리했고 그 컬럼은 어디서도 리셋하지 않는다.
       * 여기서는 "리셋되면 이미 쓴 키와 충돌한다"는 사실 자체를 고정한다.
       */
      const 만료로_실패한_뒤 = chargeKeySuffix(2) // :r2 — 이미 소진한 키들: '', :r1, :r2
      const 재등록이_리셋했다면 = chargeKeySuffix(0) // '' ← base 키로 회귀
      assert.equal(재등록이_리셋했다면, '', '전제 확인')
      assert.notEqual(
        만료로_실패한_뒤,
        재등록이_리셋했다면,
        '리셋되면 이미 쓴 키를 다시 쓰게 된다 — charge_key_seq 를 리셋하는 코드가 생긴 것',
      )
      // 재등록 뒤 정상 동작: 앵커가 유지돼 한 번도 안 쓴 다음 키로 나간다.
      assert.equal(chargeKeySuffix(3), ':r3')
    })
  })

})
