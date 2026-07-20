/**
 * autosignup-draft — /start 익명 퍼널 초안 영속(localStorage) 회귀 테스트.
 *
 * 보호 대상(퍼널 backbone — 깨지면 답 silent 유실):
 *   1. save → load 라운드트립
 *   2. 부분 저장 merge (dog/answers 누적)
 *   3. clear
 *   4. 버전 불일치(v!==1) → null
 *   5. 7일 만료 → null + 키 삭제
 *   6. isDogDraftComplete — 게이트(step0→설문) 판정
 */
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  AUTOSIGNUP_DRAFT_KEY,
  loadAutosignupDraft,
  saveAutosignupDraft,
  clearAutosignupDraft,
  isDogDraftComplete,
  type AutosignupDogDraft,
} from './autosignup-draft.ts'

// 최소 localStorage + window 모킹(node 환경엔 없음). autosignup-draft 는 호출
// 시점에만 window/localStorage 를 참조하므로 import 후 주입해도 안전.
const store = new Map<string, string>()
;(globalThis as unknown as { window: unknown }).window = globalThis
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
  setItem: (k: string, v: string) => {
    store.set(k, String(v))
  },
  removeItem: (k: string) => {
    store.delete(k)
  },
  clear: () => {
    store.clear()
  },
  key: () => null,
  length: 0,
} as Storage

const FULL: AutosignupDogDraft = {
  name: '코코',
  breed: '말티즈',
  gender: 'male',
  neutered: true,
  birthDate: '2021-05-10',
  ageValue: '3',
  ageUnit: 'years',
  weight: '4.5',
}

describe('autosignup-draft', () => {
  beforeEach(() => store.clear())

  it('save → load 라운드트립', () => {
    saveAutosignupDraft({ dog: { name: '코코', weight: '4.5' } })
    const d = loadAutosignupDraft()
    assert.equal(d?.dog.name, '코코')
    assert.equal(d?.dog.weight, '4.5')
  })

  it('부분 저장 merge (dog + answers 누적)', () => {
    saveAutosignupDraft({ dog: { name: '코코' } })
    saveAutosignupDraft({ answers: { body: 'ideal' } })
    saveAutosignupDraft({ dog: { weight: '4.5' } })
    const d = loadAutosignupDraft()
    assert.equal(d?.dog.name, '코코')
    assert.equal(d?.dog.weight, '4.5')
    assert.equal(d?.answers.body, 'ideal')
  })

  it('clear → null', () => {
    saveAutosignupDraft({ dog: { name: '코코' } })
    clearAutosignupDraft()
    assert.equal(loadAutosignupDraft(), null)
  })

  it('버전 불일치(v!==1) → null', () => {
    store.set(AUTOSIGNUP_DRAFT_KEY, JSON.stringify({ v: 99, dog: {}, answers: {} }))
    assert.equal(loadAutosignupDraft(), null)
  })

  it('7일 경과 → null + 키 삭제', () => {
    const old = Date.now() - 8 * 86_400_000
    store.set(AUTOSIGNUP_DRAFT_KEY, JSON.stringify({ v: 1, ts: old, dog: {}, answers: {} }))
    assert.equal(loadAutosignupDraft(), null)
    assert.equal(store.has(AUTOSIGNUP_DRAFT_KEY), false)
  })

  it('isDogDraftComplete — 필수필드 완비/누락(활동량 폐지·생일 필수)', () => {
    assert.equal(isDogDraftComplete(FULL), true)
    assert.equal(isDogDraftComplete({ ...FULL, weight: '' }), false)
    assert.equal(isDogDraftComplete({ ...FULL, neutered: null }), false)
    assert.equal(isDogDraftComplete({ ...FULL, weight: '0' }), false)
    assert.equal(isDogDraftComplete({ ...FULL, birthDate: '' }), false)
    assert.equal(isDogDraftComplete(undefined), false)
  })
})
