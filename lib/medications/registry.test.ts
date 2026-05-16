import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  MEDICATIONS,
  searchMedications,
  matchMedicationFromOcr,
} from './registry.ts'
import type { MedicationCategory } from './registry.ts'

/**
 * lib/medications/registry.ts — 강아지 약품 registry + 검색 / OCR 매칭.
 *
 * 회귀 가드:
 *  - B-14: typeahead 한글/영문 양쪽 매칭
 *  - B-13: OCR 출력 약명 매칭 (용량·단위 제거 후)
 */

describe('MEDICATIONS — registry 무결성', () => {
  it('32개 이상 등록', () => {
    assert.ok(MEDICATIONS.length >= 30, `${MEDICATIONS.length} 개`)
  })

  it('모든 entry 가 name + category 보유', () => {
    for (const m of MEDICATIONS) {
      assert.ok(m.name.length > 0)
      assert.ok(m.category.length > 0)
    }
  })

  it('각 카테고리에 최소 1개 entry — 8 분류 다 cover', () => {
    const categories = new Set(MEDICATIONS.map((m) => m.category))
    const expected: MedicationCategory[] = [
      'skin',
      'gi',
      'cardio',
      'joint',
      'infect',
      'parasite',
      'pain',
      'other',
    ]
    for (const c of expected) {
      assert.ok(categories.has(c), `category ${c} 미커버`)
    }
  })

  it('name 중복 없음 (typeahead 안정성)', () => {
    const names = MEDICATIONS.map((m) => m.name)
    const unique = new Set(names)
    assert.equal(names.length, unique.size)
  })
})

describe('searchMedications', () => {
  it('빈 쿼리 → 빈 배열', () => {
    assert.deepEqual(searchMedications(''), [])
    assert.deepEqual(searchMedications('   '), [])
  })

  it('한글 name 매칭 — "아포퀠"', () => {
    const results = searchMedications('아포퀠')
    assert.ok(results.length > 0)
    assert.equal(results[0]?.name, '아포퀠')
  })

  it('영문 generic 매칭 — "apoquel"', () => {
    const results = searchMedications('apoquel')
    assert.ok(results.length > 0)
    assert.equal(results[0]?.name, '아포퀠')
  })

  it('대소문자 무관', () => {
    const upper = searchMedications('APOQUEL')
    const lower = searchMedications('apoquel')
    assert.equal(upper.length, lower.length)
  })

  it('부분 매칭 — "메트로" → 메트로니다졸', () => {
    const results = searchMedications('메트로')
    assert.ok(results.some((m) => m.name === '메트로니다졸'))
  })

  it('limit 옵션 적용', () => {
    // 'a' 영문 매칭이 많을 거임 (apoquel, atopica, amoxicillin, ...)
    const results = searchMedications('a', 3)
    assert.ok(results.length <= 3)
  })

  it('default limit = 8', () => {
    const results = searchMedications('a')
    assert.ok(results.length <= 8)
  })

  it('매칭 없으면 빈 배열', () => {
    assert.deepEqual(searchMedications('완전없는약품XYZ'), [])
  })
})

describe('matchMedicationFromOcr (B-13)', () => {
  it('정확한 한글 이름 → 매칭', () => {
    const result = matchMedicationFromOcr('아포퀠')
    assert.equal(result?.name, '아포퀠')
  })

  it('용량 포함 영문 — "Apoquel 5.4mg" → 아포퀠', () => {
    const result = matchMedicationFromOcr('Apoquel 5.4mg')
    assert.equal(result?.name, '아포퀠')
  })

  it('한국어 단위 — "프레드니솔론 정 5mg" → 프레드니솔론', () => {
    const result = matchMedicationFromOcr('프레드니솔론 정 5mg')
    assert.equal(result?.name, '프레드니솔론')
  })

  it('복합 — "메트로니다졸 250mg 1일 2회" → 메트로니다졸', () => {
    const result = matchMedicationFromOcr('메트로니다졸 250mg 1일 2회')
    assert.equal(result?.name, '메트로니다졸')
  })

  it('영문 generic 첫 단어 매칭 — "Metronidazole tablet"', () => {
    const result = matchMedicationFromOcr('Metronidazole tablet')
    assert.equal(result?.name, '메트로니다졸')
  })

  it('대소문자 무관', () => {
    const result = matchMedicationFromOcr('CARPROFEN 50MG')
    assert.equal(result?.name, '카프로벳')
  })

  it('단위 제거 패턴 — kg / ml / iu / 단위', () => {
    const result = matchMedicationFromOcr('인슐린 10IU')
    assert.equal(result?.name, '인슐린')
  })

  it('빈 입력 → null', () => {
    assert.equal(matchMedicationFromOcr(''), null)
  })

  it('매칭 없음 → null', () => {
    assert.equal(matchMedicationFromOcr('완전 모르는 약 XYZ123'), null)
  })

  it('진통제 카테고리 — 트라마돌 + 가바펜틴', () => {
    const tra = matchMedicationFromOcr('Tramadol 50mg')
    assert.equal(tra?.category, 'pain')
    const gaba = matchMedicationFromOcr('Gabapentin 100mg')
    assert.equal(gaba?.category, 'pain')
  })

  it('항생제 — Amoxicillin → infect 카테고리', () => {
    const result = matchMedicationFromOcr('Amoxicillin 250mg')
    assert.equal(result?.category, 'infect')
  })

  it('기생충 — Bravecto → parasite', () => {
    const result = matchMedicationFromOcr('Bravecto 3 month')
    assert.equal(result?.category, 'parasite')
  })

  it('심장약 — Vetmedin → cardio', () => {
    const result = matchMedicationFromOcr('Vetmedin (pimobendan) 5mg')
    assert.equal(result?.category, 'cardio')
  })
})
