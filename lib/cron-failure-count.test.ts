import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { failureCountOf } from './cron-failure-count.ts'

/**
 * "200 인데 실패 카운트가 있는" 크론 회귀 가드 (2026-08-12 3라운드 감사).
 *
 * 2026-08-05 에 5xx **반환** 경로는 덮었는데, 실패를 세어 body 에 담고 200 을
 * 돌려주는 얼굴이 남아 있었다:
 *   · subscription-reminders `{ sent: 0, errors: 12 }` → 200 → cron_health success
 *   · quarterly-report       `{ sent: 0, failed: 9 }`  → 200 → ops-digest 침묵
 * 즉 "오늘 메일이 한 통도 안 나갔다"가 어디에도 안 남았다.
 */

describe('failureCountOf — 부분 실패를 성공으로 집계하지 않는다', () => {
  it('실패 카운터가 없으면 0 (정상 크론은 계속 초록)', () => {
    assert.equal(failureCountOf({ ok: true, checked: 10, sent: 10 }), 0)
    assert.equal(failureCountOf({}), 0)
    assert.equal(failureCountOf(null), 0)
    assert.equal(failureCountOf(undefined), 0)
  })

  it('★재현: 리마인더 12통 전부 실패인데 200 이던 것', () => {
    assert.equal(failureCountOf({ checked: 12, sent: 0, errors: 12 }), 12)
  })

  it('★재현: 분기 리포트 failed 9건', () => {
    assert.equal(failureCountOf({ sent: 0, failed: 9 }), 9)
  })

  it('새 카운터도 센다 — itemsFailed(재고 복원 누락) · mailFailed(결제완료 메일)', () => {
    assert.equal(failureCountOf({ expired: 3, itemsFailed: 2 }), 2)
    assert.equal(failureCountOf({ succeeded: 5, mailFailed: 1 }), 1)
    // 여러 카운터가 함께 있으면 합산.
    assert.equal(failureCountOf({ errors: 1, failed: 2, mailFailed: 3 }), 6)
  })

  it('★카드 거절은 실패가 아니다 — 정상 운영 이벤트다 (2026-08-12 자기회귀 가드)', () => {
    // 어제 이 규칙을 넣으면서 subscription-charge 의 `failed`(= 카드 거절 수)를
    // 그대로 실패로 셌다. 잔액부족 고객 한 명이 매일 재청구→매일 거절→매일 빨간불이
    // 되고, 그 알림을 무시하기 시작하면 진짜 실패까지 묻힌다. 거절은 declined 로 분리.
    assert.equal(
      failureCountOf({ ok: true, checked: 12, succeeded: 7, declined: 5 }),
      0,
    )
    // 단, 우리 쪽 실패가 섞여 있으면 여전히 빨간불이어야 한다.
    assert.equal(
      failureCountOf({ checked: 12, succeeded: 7, declined: 5, failed: 1 }),
      1,
    )
  })

  it('★skipped 는 실패가 아니다 — 이걸 세면 매일 빨간불이라 규칙이 꺼진다', () => {
    // 대상이 아니라 건너뛴 것은 정상 동작이다(청구 대상 없음 등).
    assert.equal(failureCountOf({ checked: 50, skipped: 50, sent: 0 }), 0)
    // paidSkipped 도 '만료를 안 시켰다'는 안전 동작이라 실패로 세지 않는다
    // (그 자체는 fatal 이벤트로 별도 통지된다).
    assert.equal(failureCountOf({ expired: 0, paidSkipped: 2 }), 0)
  })

  it('숫자가 아니거나 음수·NaN 은 무시한다 (요약이 이상해도 크론을 죽이지 않는다)', () => {
    assert.equal(failureCountOf({ errors: '3' }), 0)
    assert.equal(failureCountOf({ errors: -1 }), 0)
    assert.equal(failureCountOf({ errors: Number.NaN }), 0)
    assert.equal(failureCountOf({ errors: Infinity }), 0)
  })
})
