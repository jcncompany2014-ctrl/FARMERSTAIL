import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { breedFlagsFromLabel, registryCodeFromLabel } from './breeds.ts'

describe('견종 플래그 브리지 (M4b)', () => {
  it('공백 정규화: DB 실값 "토이푸들" ↔ registry "토이 푸들" 매칭', () => {
    assert.equal(registryCodeFromLabel('토이푸들'), 'toy_poodle')
    assert.equal(registryCodeFromLabel('토이 푸들'), 'toy_poodle')
    assert.equal(registryCodeFromLabel('골든 리트리버'), 'golden_retriever')
  })

  it('토이 계열 → toyOverestimate (자견 정확식 −15% 대상)', () => {
    assert.equal(breedFlagsFromLabel('말티즈').toyOverestimate, true)
    assert.equal(breedFlagsFromLabel('토이푸들').toyOverestimate, true)
    assert.equal(breedFlagsFromLabel('말티푸').toyOverestimate, true)
  })

  it('비만경향(OB): 래브라도·웰시코기·골든 → obeseProne', () => {
    assert.equal(breedFlagsFromLabel('래브라도 리트리버').obeseProne, true)
    assert.equal(breedFlagsFromLabel('웰시코기').obeseProne, true)
    assert.equal(breedFlagsFromLabel('웰시코기').chondrodystrophic, true)
    assert.equal(breedFlagsFromLabel('골든 리트리버').obeseProne, true)
  })

  it('단두종(BRA): 시츄·프렌치 불독 → brachycephalic (활동 가산 억제)', () => {
    assert.equal(breedFlagsFromLabel('시츄').brachycephalic, true)
    assert.equal(breedFlagsFromLabel('프렌치 불독').brachycephalic, true)
  })

  it('스펙 외 근거 견종: 퍼그 → OB+BRA, 비글 → OB (VetCompass)', () => {
    const pug = breedFlagsFromLabel('퍼그')
    assert.equal(pug.obeseProne, true)
    assert.equal(pug.brachycephalic, true)
    assert.equal(breedFlagsFromLabel('비글').obeseProne, true)
  })

  it('진돗개 → highDrive 만 (감산 없음), 믹스/미입력/미등재 → 플래그 없음', () => {
    const jindo = breedFlagsFromLabel('진돗개')
    assert.equal(jindo.highDrive, true)
    assert.equal(jindo.obeseProne, false)
    assert.deepEqual(breedFlagsFromLabel('믹스견'), breedFlagsFromLabel(null))
    assert.equal(breedFlagsFromLabel(null).obeseProne, false)
    assert.equal(breedFlagsFromLabel('보더콜리').obeseProne, false) // 등재 but 플래그 대상 아님
  })
})
