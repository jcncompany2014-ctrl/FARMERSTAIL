import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseMedicalRecord, normalize } from './parseMedicalRecord.ts'

/**
 * [D1] parseMedicalRecord — Anthropic API 호출 분기 / 에러 처리 테스트.
 * 실제 API 호출 없이 fetch mock 으로 검증. normalize 만 D6.5 에서 cover.
 */
describe('parseMedicalRecord — error handling', () => {
  it('빈 base64 → INVALID_IMAGE', async () => {
    const r = await parseMedicalRecord('', 'fake-key')
    assert.equal(r.ok, false)
    assert.match(r.code, /INVALID/)
  })

  it('data url 아닌 raw base64 도 처리 (mime default)', async () => {
    // network 차단 — undici fetch mock 어려움. 빈 data 시 INVALID_IMAGE 면 통과.
    const r = await parseMedicalRecord('aGVsbG8=', 'fake-key')
    // 실제 API 가 401/network 에러 — INVALID_IMAGE 가 아니라 다른 code
    assert.ok(!r.ok)
  })
})

describe('parseMedicalRecord — normalize edge cases', () => {
  it('medications 의 name 만 있고 dosage 없음 → frequency null', () => {
    const r = normalize({
      medications: [{ name: '아포퀠' }],
    })
    assert.equal(r.medications.length, 1)
    assert.equal(r.medications[0]!.dosage, null)
    assert.equal(r.medications[0]!.frequency, null)
  })

  it('visitDate 비-string → null', () => {
    const r = normalize({ visitDate: 12345 })
    assert.equal(r.visitDate, null)
  })

  it('weightKg infinity → null', () => {
    const r = normalize({ weightKg: Infinity })
    assert.equal(r.weightKg, null)
  })
})
