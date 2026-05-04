import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { detectChronicFromMedications } from './drugs.ts'

describe('detectChronicFromMedications', () => {
  it('빈 텍스트 → 빈 배열', () => {
    assert.deepEqual(detectChronicFromMedications(''), [])
    assert.deepEqual(detectChronicFromMedications('   '), [])
  })

  it('프레드니솔론 → long_term_steroid', () => {
    const r = detectChronicFromMedications('프레드니솔론 5mg q24h')
    assert.equal(r.length, 1)
    assert.equal(r[0].condition, 'long_term_steroid')
  })

  it('영문 prednisolone 도 매칭', () => {
    const r = detectChronicFromMedications('Prednisolone 0.5mg/kg')
    assert.equal(r[0].condition, 'long_term_steroid')
  })

  it('인슐린 + 메트포민 → diabetes 한 번만', () => {
    const r = detectChronicFromMedications('인슐린 + 메트포민 처방')
    assert.equal(r.length, 1)
    assert.equal(r[0].condition, 'diabetes')
  })

  it('피모벤단 + 푸로세미드 → cardiac 한 번', () => {
    const r = detectChronicFromMedications('피모벤단 1.25mg + 푸로세미드')
    assert.equal(r.length, 1)
    assert.equal(r[0].condition, 'cardiac')
  })

  it('여러 약 동시 → 여러 condition', () => {
    const r = detectChronicFromMedications('프레드니솔론 + 메트포민 + 피모벤단')
    const conditions = r.map((x) => x.condition).sort()
    assert.deepEqual(
      conditions,
      ['cardiac', 'diabetes', 'long_term_steroid'].sort(),
    )
  })

  it('대소문자 무관', () => {
    const r = detectChronicFromMedications('PHENOBARBITAL 30mg')
    assert.equal(r[0].condition, 'epilepsy')
  })

  it('비매칭 약물 → 빈 배열', () => {
    const r = detectChronicFromMedications('비타민 D, 오메가-3')
    assert.equal(r.length, 0)
  })

  it('UDCA → liver', () => {
    const r = detectChronicFromMedications('우르소데옥시콜 250mg')
    assert.equal(r[0].condition, 'liver')
  })

  it('selegiline → cognitive_decline', () => {
    const r = detectChronicFromMedications('아니프릴 10mg')
    assert.equal(r[0].condition, 'cognitive_decline')
  })
})
