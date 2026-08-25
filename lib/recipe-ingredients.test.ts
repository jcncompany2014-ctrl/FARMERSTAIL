import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  RECIPE_INGREDIENTS,
  cardIngredientNames,
  fullIngredientNames,
} from './recipe-ingredients.ts'
import type { FoodLine } from './personalization/types.ts'

const SELLING: FoodLine[] = ['weight', 'basic', 'joint', 'premium']

describe('★ 규칙63: 고객 원재료 목록 = 사장님 확정 배합표, 배합% 누설 금지', () => {
  /**
   * # 이 규칙이 생긴 두 번의 사고 (둘 다 2026-08-25)
   *  ① 앱이 **정제수**를 적고 있었다 — v4 공정에서 삭제된 것(사장님 지적)
   *  ② 내가 그걸 고치면서 **옛 문서**(제조공정 표준 v8)를 정본으로 삼아
   *     강황을 3종에서 빼고 컨셉 토핑 6종을 "유령 재료"로 지웠다.
   *     확정 배합표에는 **강황이 전 SKU 공통(0.10%)** 이고 토핑은 hero+support
   *     **2종**이다. 고치려다 더 나쁘게 만든 전형이다.
   * → 그래서 이 테스트는 "무엇이 있어야 하는가"를 양방향으로 못 박는다.
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

  test('★강황은 4종 전부에 들어간다 (전 SKU 공통 — 내가 틀렸던 지점)', () => {
    for (const line of SELLING) {
      assert.ok(
        fullIngredientNames(line).includes('강황'),
        `${line}: 강황 누락 — 확정 배합표는 전 SKU 공통이다`,
      )
    }
  })

  test('★컨셉 토핑은 SKU 마다 2종 (hero + support) — 지우지 말 것', () => {
    assert.deepEqual(RECIPE_INGREDIENTS.weight?.toppings, ['브로콜리', '블루베리'])
    assert.deepEqual(RECIPE_INGREDIENTS.basic?.toppings, ['애호박', '사과'])
    assert.deepEqual(RECIPE_INGREDIENTS.joint?.toppings, ['무', '양배추'])
    assert.deepEqual(RECIPE_INGREDIENTS.premium?.toppings, ['비트', '블루베리'])
    // hero(첫 번째)는 4종 전부 달라야 한다 — SKU 차별점
    const heroes = SELLING.map((l) => RECIPE_INGREDIENTS[l]!.toppings[0])
    assert.equal(new Set(heroes).size, 4, 'hero 토핑이 겹친다')
  })

  test('난각분말(v4 신규 Ca:P 교정)이 4종 전부에 있다', () => {
    for (const line of SELLING) {
      assert.ok(fullIngredientNames(line).includes('난각분말'), `${line}: 난각분말 누락`)
    }
  })

  test('정제수는 없다 (v4 공정에서 삭제 — 수비드 육즙으로 대체)', () => {
    for (const line of SELLING) {
      assert.ok(
        !fullIngredientNames(line).some((n) => n.includes('정제수')),
        `${line}: 정제수가 적혀 있다`,
      )
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

  test('공통 채소·곡물 5종이 4종 전부에 있다', () => {
    for (const line of SELLING) {
      const names = fullIngredientNames(line)
      for (const v of ['당근', '단호박', '시금치', '현미', '고구마']) {
        assert.ok(names.includes(v), `${line}: ${v} 누락`)
      }
    }
  })

  test('카드 발췌 = 메인+내장2+토핑2, 전체 목록의 부분집합', () => {
    for (const line of SELLING) {
      const card = cardIngredientNames(line)
      const full = fullIngredientNames(line)
      assert.equal(card.length, 5, `${line}: 카드는 메인1+내장2+토핑2`)
      for (const n of card) assert.ok(full.includes(n), `${line}: ${n} 이 전체에 없다`)
    }
  })

  test('판매 안 하는 라인(연어)은 빈 목록 — 없는 레시피를 지어내지 않는다', () => {
    assert.equal(RECIPE_INGREDIENTS.skin, null)
    assert.deepEqual(fullIngredientNames('skin'), [])
    assert.deepEqual(cardIngredientNames('skin'), [])
  })
})
