import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { boxCardColors, boxRecipes, pouchLineFromName } from './pouch.ts'
import { POUCH, V3 } from './tokens.ts'

describe('박스 카드 파우치 색 (2026-10-09 앱 새 디자인)', () => {
  it('레시피 이름에서 파우치를 읽고 토퍼는 뺀다', () => {
    assert.equal(pouchLineFromName('닭고기 화식 (120g 한 끼)'), 'chicken')
    assert.equal(pouchLineFromName('오리고기 화식'), 'duck')
    assert.equal(pouchLineFromName('흑돼지 화식 (90g 한 끼)'), 'pork')
    assert.equal(pouchLineFromName('한우 (165g 한 끼)'), 'beef')
    assert.equal(pouchLineFromName('채소 토퍼 (100g 팩)'), null)
  })

  it('팩 수가 많은 레시피가 바탕, 같으면 닭 → 흑돼지 → 한우 → 오리', () => {
    assert.deepEqual(boxRecipes([{ name: '흑돼지 화식' }, { name: '닭고기 화식' }]).lines, ['chicken', 'pork'])
    assert.deepEqual(boxRecipes([{ name: '오리고기 화식' }, { name: '한우 화식' }]).lines, ['beef', 'duck'])
    assert.deepEqual(boxRecipes([{ name: '닭고기 화식', quantity: 2 }, { name: '오리고기 화식', quantity: 6 }]).lines, ['duck', 'chicken'])
  })

  it('같은 꼬리말(화식)은 한 번만 — "닭고기 · 흑돼지 화식"', () => {
    assert.equal(boxRecipes([{ name: '닭고기 화식 (120g 한 끼)' }, { name: '흑돼지 화식 (120g 한 끼)' }]).label, '닭고기 · 흑돼지 화식')
    assert.equal(boxRecipes([{ name: '채소 토퍼 (100g 팩)' }, { name: '한우 화식' }]).label, '한우 화식')
  })

  it('한 가지 = 그 색 바탕 + 먹색 도장 그림자 / 두 가지 = 둘째 색 3px 테두리·5px 그림자 / 없음 = 머스타드', () => {
    const one = boxCardColors(['duck'])
    assert.equal(one.face, POUCH.duck)
    assert.equal(one.edge, V3.ink)
    assert.equal(one.edgeWidth, 2)
    assert.equal(one.shadow, 4)
    const two = boxCardColors(['chicken', 'pork'])
    assert.equal(two.face, POUCH.chicken)
    assert.equal(two.edge, POUCH.pork)
    assert.equal(two.edgeWidth, 3)
    assert.equal(two.shadow, 5)
    assert.equal(boxCardColors([]).face, V3.mustard)
  })

  it('한우 바탕만 흰 글자', () => {
    assert.equal(boxCardColors(['beef']).text, '#FFFFFF')
    assert.equal(boxCardColors(['beef', 'duck']).text, '#FFFFFF')
    assert.equal(boxCardColors(['chicken']).text, V3.ink)
    assert.equal(boxCardColors(['duck', 'beef']).text, V3.ink)
  })
})
