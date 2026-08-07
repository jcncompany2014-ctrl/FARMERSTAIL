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

describe('promo — 프로모션 코드 생존 (2026-08-08 감사)', () => {
  beforeEach(() => {
    clearAutosignupDraft()
  })

  /**
   * ★이 파일에 promo 테스트가 **하나도 없어서** 버그가 통과했다.
   *
   * loadAutosignupDraft 가 반환 객체에 promo 를 안 담고 있었다. 그래서:
   *  ① claimPromotionOnSignup 의 `loadAutosignupDraft()?.promo` 가 항상
   *     undefined → claim_promotion RPC 가 한 번도 안 불렸다.
   *  ② saveAutosignupDraft 가 `prev?.promo` 로 보존하려 하는데 그 prev 가
   *     loadAutosignupDraft() 의 반환값이라, **다음 저장에서 localStorage
   *     에서도 지워졌다.**
   * 즉 /start?p=code 로 들어와 이름 한 글자만 쳐도 0.4초 뒤 코드가 사라졌고,
   * QR·인스타 프로모션이 전부 0원 할인으로 나갔다. 타입이 optional 이라
   * tsc 도 통과했다.
   */
  it('★save → load 라운드트립', () => {
    saveAutosignupDraft({ promo: 'busan1102' })
    assert.equal(loadAutosignupDraft()?.promo, 'busan1102')
  })

  it('★다음 저장에서도 살아남는다 (지워지던 자리)', () => {
    saveAutosignupDraft({ promo: 'busan1102' })
    saveAutosignupDraft({ dog: { name: '콩이' } })
    saveAutosignupDraft({ answers: { bodyShape: 'ideal' } })
    assert.equal(
      loadAutosignupDraft()?.promo,
      'busan1102',
      '설문을 진행하는 동안 프로모션 코드가 사라졌다',
    )
  })

  it('먼저 박힌 코드가 이긴다 (링크를 여러 개 타고 와도)', () => {
    saveAutosignupDraft({ promo: 'first' })
    saveAutosignupDraft({ promo: 'second' })
    assert.equal(loadAutosignupDraft()?.promo, 'first')
  })

  it('코드가 없으면 promo 키 자체가 없다', () => {
    saveAutosignupDraft({ dog: { name: '콩이' } })
    assert.equal(loadAutosignupDraft()?.promo, undefined)
  })

  it('빈 문자열·비문자열은 코드로 치지 않는다', () => {
    localStorage.setItem(
      AUTOSIGNUP_DRAFT_KEY,
      JSON.stringify({ v: 1, ts: Date.now(), dog: {}, answers: {}, promo: '' }),
    )
    assert.equal(loadAutosignupDraft()?.promo, undefined)
    localStorage.setItem(
      AUTOSIGNUP_DRAFT_KEY,
      JSON.stringify({ v: 1, ts: Date.now(), dog: {}, answers: {}, promo: 123 }),
    )
    assert.equal(loadAutosignupDraft()?.promo, undefined)
  })
})
