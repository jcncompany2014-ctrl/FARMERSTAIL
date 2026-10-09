/**
 * 설문 알레르기 보기 정본 — 화면 라벨 = 저장값 = 추천 차단 키(2026-10-09 보기 정리).
 * 깨지면 알레르기로 고른 고기가 추천에서 안 빠질 수 있다 — 스킵 금지.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ALLERGY_GROUPS,
  ALLERGY_OPTIONS,
  LEGACY_ALLERGY_ALIASES,
  RETIRED_ALLERGY_OPTIONS,
  normalizeAllergyAnswers,
} from './allergy-options.ts'
import { SKU_MODEL } from '../personalization/skuModel.ts'
import { START_ALLERGY_KR } from '../start-allergy-labels.ts'

test('보기 = 두 묶음(고기·생선 7 · 그 밖의 재료 4), 계란·곡물 없음, 연어는 "연어"', () => {
  assert.deepEqual(
    ALLERGY_GROUPS.map((g) => [g.label, g.options.length]),
    [
      ['고기·생선', 7],
      ['그 밖의 재료', 4],
    ],
  )
  for (const gone of [...RETIRED_ALLERGY_OPTIONS, '연어·생선']) assert.ok(!ALLERGY_OPTIONS.includes(gone), `${gone} 가 보기에 남아 있다`)
  assert.ok(ALLERGY_OPTIONS.includes('연어'))
  assert.equal(new Set(ALLERGY_OPTIONS).size, ALLERGY_OPTIONS.length, '같은 보기가 두 번 있다')
})

test('★ 추천 차단 키는 전부 보기(또는 옛 별칭)로 고를 수 있다 — 못 고르는 차단 키 = 차단이 꺼진 것', () => {
  const reachable = new Set([...ALLERGY_OPTIONS, ...Object.keys(LEGACY_ALLERGY_ALIASES)])
  const vocab = new Set(Object.values(SKU_MODEL).flatMap((s) => s.blockingAllergies))
  const unreachable = [...vocab].filter((v) => !reachable.has(v))
  assert.deepEqual(unreachable, [], `보기로 고를 수 없는 차단 키: ${unreachable.join(', ')}`)
})

test('★ 새 라벨과 옛 라벨이 같은 SKU 를 막는다 — 옛 답("연어·생선")도 계속 차단', () => {
  for (const [oldLabel, newLabel] of Object.entries(LEGACY_ALLERGY_ALIASES)) {
    for (const sku of Object.values(SKU_MODEL)) {
      assert.equal(
        sku.blockingAllergies.includes(oldLabel),
        sku.blockingAllergies.includes(newLabel),
        `${sku.nameKo}: '${oldLabel}' 와 '${newLabel}' 의 차단이 다르다`,
      )
    }
  }
})

test('★ /start 번역은 지금 보기 라벨로 저장된다', () => {
  const bad = Object.values(START_ALLERGY_KR).filter((v) => !ALLERGY_OPTIONS.includes(v))
  assert.deepEqual(bad, [], `/start 번역이 보기에 없는 라벨로 저장한다: ${bad.join(', ')}`)
})

test('normalizeAllergyAnswers — 옛 라벨만 바꾸고 나머지(뺀 보기·모르는 값)는 남긴다', () => {
  assert.deepEqual(normalizeAllergyAnswers(['연어·생선', '닭·칠면조']), ['연어', '닭·칠면조'])
  assert.deepEqual(normalizeAllergyAnswers(['연어', '연어·생선']), ['연어'])
  assert.deepEqual(normalizeAllergyAnswers(['계란', '곡물 (밀/옥수수)', '유제품']), ['계란', '곡물 (밀/옥수수)', '유제품'])
  assert.deepEqual(normalizeAllergyAnswers([]), [])
})
