import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  RECIPE_INGREDIENTS,
  cardIngredientNames,
  fullIngredientNames,
} from './recipe-ingredients.ts'
import type { FoodLine } from './personalization/types.ts'

const SELLING: FoodLine[] = ['weight', 'basic', 'joint', 'premium']

describe('★ 규칙63: 고객 원재료 목록은 등록 서류와 일치하고 배합%를 누설하지 않는다', () => {
  /**
   * 2026-08-25 에 실제로 틀려 있던 것들(PlanClient 하드코딩):
   *  · 존재하지 않는 토핑(브로콜리·비트·애호박·양배추)을 적었다
   *  · 강황을 4종 전부에 붙였다 — 마스터·서류·DB 는 **닭 전용**이다
   *  · 정제수를 적었다 — 어디에도 없다(v4 에서 삭제된 공정)
   * 원재료 표시는 사료관리법 표시사항이라 화면이 서류와 달라지면 안 된다.
   */
  test('배합% 숫자가 고객 목록에 섞이지 않는다 (영업비밀)', () => {
    for (const line of SELLING) {
      for (const name of fullIngredientNames(line)) {
        assert.ok(
          !/\d/.test(name),
          `${line}: "${name}" 에 숫자가 있다 — 배합비는 어드민 전용이다`,
        )
        assert.ok(!name.includes('%'), `${line}: "${name}" 에 % 가 있다`)
      }
    }
  })

  test('★강황은 닭(weight) SKU 에만 (마스터 v8·붙임2·DB 일치)', () => {
    const withTurmeric = SELLING.filter((l) =>
      fullIngredientNames(l).includes('강황'),
    )
    assert.deepEqual(withTurmeric, ['weight'])
  })

  test('SKU 별 토핑이 서류와 같다 (닭=강황·오리=사과·돼지=무·소=블루베리)', () => {
    assert.equal(RECIPE_INGREDIENTS.weight?.topping, '강황')
    assert.equal(RECIPE_INGREDIENTS.basic?.topping, '사과')
    assert.equal(RECIPE_INGREDIENTS.joint?.topping, '무')
    assert.equal(RECIPE_INGREDIENTS.premium?.topping, '블루베리')
  })

  test('정제수는 어디에도 없다 (v4 공정에서 삭제 — 육즙 회수로 대체)', () => {
    for (const line of SELLING) {
      assert.ok(
        !fullIngredientNames(line).some((n) => n.includes('정제수')),
        `${line}: 정제수가 적혀 있다`,
      )
    }
  })

  test('없는 재료를 적지 않는다 (옛 하드코딩 잔재 차단)', () => {
    const notInAnyRecipe = ['브로콜리', '비트', '애호박', '양배추']
    for (const line of SELLING) {
      const names = fullIngredientNames(line)
      for (const ghost of notInAnyRecipe) {
        assert.ok(
          !names.includes(ghost),
          `${line}: "${ghost}" 는 배합표에 없는 재료다`,
        )
      }
    }
  })

  test('흑돼지는 뒷다리살 (부위 변경 2026-08-25)', () => {
    assert.equal(RECIPE_INGREDIENTS.joint?.main, '흑돼지 뒷다리살')
    assert.ok(!fullIngredientNames('joint').some((n) => n.includes('안심')))
  })

  test('프리믹스는 브랜드명으로 부른다', () => {
    for (const line of SELLING) {
      assert.ok(
        fullIngredientNames(line).some((n) => n.startsWith('파머스테일 뉴트리 코어')),
        `${line}: 뉴트리 코어 표기 없음`,
      )
    }
  })

  test('카드 발췌 = 메인+내장+토핑, 전체 목록의 부분집합', () => {
    for (const line of SELLING) {
      const card = cardIngredientNames(line)
      const full = fullIngredientNames(line)
      assert.equal(card.length, 4, `${line}: 카드는 메인1+내장2+토핑1`)
      for (const n of card) assert.ok(full.includes(n), `${line}: ${n} 이 전체에 없다`)
    }
  })

  test('판매 안 하는 라인(연어)은 빈 목록 — 없는 레시피를 지어내지 않는다', () => {
    assert.equal(RECIPE_INGREDIENTS.skin, null)
    assert.deepEqual(fullIngredientNames('skin'), [])
    assert.deepEqual(cardIngredientNames('skin'), [])
  })
})
