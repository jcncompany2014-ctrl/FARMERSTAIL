import { test } from 'node:test'
import assert from 'node:assert/strict'
import { START_ALLERGY_KR, translateDraftAllergies } from './start-allergy-labels.ts'
import { SKU_MODEL } from './personalization/skuModel.ts'

/**
 * 최종감사 #0 (2026-07-29, critical): /start 알레르기가 영문 키 그대로
 * surveys.answers 에 저장돼 **알레르기 차단 게이트 전체가 무력화**되던 버그.
 * 게이트는 SKU_MODEL.blockingAllergies 의 한글 라벨과 정확 문자열 비교를
 * 하므로, 번역 결과가 그 어휘와 글자 단위로 일치해야 차단이 동작한다.
 * 이 테스트가 깨지면 알레르기 성분이 배송될 수 있다 — 절대 스킵 금지.
 */

/** /start StartSurvey.tsx allergy 스텝의 단백질 키 (none 제외). 스텝에 키를
 *  추가하면 이 목록과 START_ALLERGY_KR 에 같이 추가해야 한다. */
const START_SURVEY_KEYS = ['chicken', 'beef', 'duck', 'salmon', 'lamb', 'pork']

test('★ /start 의 모든 단백질 키에 번역이 있다', () => {
  const missing = START_SURVEY_KEYS.filter((k) => !(k in START_ALLERGY_KR))
  assert.deepEqual(
    missing,
    [],
    `번역 없는 키: ${missing.join(', ')} — 이 키로 저장된 알레르기는 게이트를 통과한다(알레르겐 배송 위험)`,
  )
})

test('★ 판매 SKU 의 차단 어휘가 번역 결과에 전부 커버된다', () => {
  // 게이트가 실제로 비교하는 어휘 = SKU_MODEL 전체의 blockingAllergies 합집합.
  const gateVocab = new Set(
    Object.values(SKU_MODEL).flatMap((s) => s.blockingAllergies),
  )
  const translated = new Set(Object.values(START_ALLERGY_KR))
  // '흰살생선'은 /start 에 선택지 자체가 없다(앱 정밀 설문 전용 항목) — 번역
  // 불가가 정상. 그 외 어휘(판매 4종 + 소고기 SKU 교차차단 양고기 + 연어)는
  // 전부 /start 키에서 도달 가능해야 한다.
  const START_UNAVAILABLE = new Set(['흰살생선'])
  const unreachable = [...gateVocab].filter(
    (v) => !translated.has(v) && !START_UNAVAILABLE.has(v),
  )
  assert.deepEqual(
    unreachable,
    [],
    `/start 에서 선언할 수 없는 차단 어휘: ${unreachable.join(', ')}`,
  )
})

test('번역은 앱 설문 정본 라벨과 일치한다 (Allergy.tsx ALLERGY_OPTIONS 부분집합)', () => {
  // 앱 설문의 단백질 관련 정본 라벨 — Allergy.tsx 와 동기화.
  const appOptions = new Set([
    '닭·칠면조', '소고기', '양고기', '연어·생선', '오리', '흰살생선', '돼지고기',
    '유제품', '계란', '곡물 (밀/옥수수)', '대두', '감자', '견과류',
  ])
  const notCanonical = Object.values(START_ALLERGY_KR).filter((v) => !appOptions.has(v))
  assert.deepEqual(notCanonical, [], `정본에 없는 라벨: ${notCanonical.join(', ')}`)
})

test('translateDraftAllergies — 알 수 없는 키는 버리지 않고 통과시킨다', () => {
  assert.deepEqual(translateDraftAllergies(['chicken', 'salmon']), ['닭·칠면조', '연어·생선'])
  assert.deepEqual(translateDraftAllergies([]), [])
  // 모르는 값은 그대로 — 없어지는 것(차단 완전 소실)보다 남는 게 안전.
  assert.deepEqual(translateDraftAllergies(['tofu']), ['tofu'])
})

test('★ 재현 케이스: 닭 알레르기 /start 고객이 이관되면 닭 SKU 가 차단된다', () => {
  const stored = translateDraftAllergies(['chicken'])
  const chickenSku = Object.values(SKU_MODEL).find((s) =>
    s.blockingAllergies.includes('닭·칠면조'),
  )
  assert.ok(chickenSku, '닭 차단 어휘를 가진 SKU 가 존재해야 함')
  // 게이트의 실제 비교식과 동일: blockingAllergies.some(b => allergies.includes(b))
  const blocked = chickenSku.blockingAllergies.some((b) => stored.includes(b))
  assert.equal(blocked, true, '번역 후에도 차단이 안 되면 알레르겐 배송')
})
