import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalize } from './parseMedicalRecord.ts'

describe('normalize', () => {
  it('빈 객체 → safe defaults', () => {
    const r = normalize({})
    assert.equal(r.visitDate, null)
    assert.equal(r.weightKg, null)
    assert.deepEqual(r.diagnosis, [])
    assert.deepEqual(r.medications, [])
    assert.equal(r.vetNotes, null)
    assert.equal(r.confidence, 0)
  })

  it('null/undefined → 안전', () => {
    const a = normalize(null)
    const b = normalize(undefined)
    assert.deepEqual(a, b)
  })

  it('정상 입력 통과', () => {
    const r = normalize({
      visitDate: '2026-05-10',
      weightKg: 5.2,
      diagnosis: ['아토피 피부염'],
      medications: [
        { name: '사이클로스포린', dosage: '1캡슐', frequency: '1일 1회' },
      ],
      vetNotes: '2주 후 재진',
      confidence: 0.85,
    })
    assert.equal(r.visitDate, '2026-05-10')
    assert.equal(r.weightKg, 5.2)
    assert.deepEqual(r.diagnosis, ['아토피 피부염'])
    assert.equal(r.medications.length, 1)
    assert.equal(r.medications[0]!.name, '사이클로스포린')
    assert.equal(r.confidence, 0.85)
  })

  it('confidence 범위 외 → clamp', () => {
    const a = normalize({ confidence: 1.5 })
    const b = normalize({ confidence: -0.2 })
    assert.equal(a.confidence, 1)
    assert.equal(b.confidence, 0)
  })

  it('weightKg 비숫자 → null', () => {
    const r = normalize({ weightKg: '5kg' })
    assert.equal(r.weightKg, null)
  })

  it('diagnosis 에 비-문자열 섞여있으면 필터', () => {
    const r = normalize({
      diagnosis: ['아토피', null, 123, '관절염'],
    })
    assert.deepEqual(r.diagnosis, ['아토피', '관절염'])
  })

  it('medications name 없는 항목 제거', () => {
    const r = normalize({
      medications: [
        { name: 'A', dosage: '1' },
        { dosage: '없음' },
        { name: '', dosage: '?' },
        { name: 'B' },
      ],
    })
    assert.equal(r.medications.length, 2)
    assert.equal(r.medications[0]!.name, 'A')
    assert.equal(r.medications[1]!.name, 'B')
    assert.equal(r.medications[1]!.dosage, null)
  })
})
