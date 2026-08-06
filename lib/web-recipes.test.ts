/**
 * selectSafeRecipes — /start 'Your Plan' 추천 레시피 알레르기 필터 회귀 테스트.
 *
 * 보호 대상(특히 안전):
 *   1. 알레르기 없음 → 우선순위순(duck·beef·chicken) 최대 3종
 *   2. 일부 단백질 알레르기 → 해당 단백질 제외
 *   3. ★알레르겐은 절대 추천 안 됨 — 반환 목록에 알레르기 단백질이 없어야 함
 *   4. ★4종(닭·소·오리·돼지) 전부 알레르기 → **빈 배열**(가짜 폴백으로 알레르겐
 *      추천 금지). 이게 깨지면 알레르기 강아지에게 알레르겐을 추천하게 됨.
 *   5. salmon·lamb 등 SKU 없는 단백질 알레르기는 후보 4종에 영향 없음
 *   6. max 파라미터 상한
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { selectSafeRecipes, WEB_RECIPE_ORDER, WEB_RECIPES } from './web-recipes.ts'
import { SKU_MODEL } from './personalization/skuModel.ts'

describe('selectSafeRecipes', () => {
  it('알레르기 없음 → 우선순위순 최대 3종', () => {
    const r = selectSafeRecipes([])
    assert.equal(r.length, 3)
    assert.deepEqual(
      r.map((x) => x.protein),
      ['duck', 'pork', 'chicken'], // 티저 순서 정렬(2026-08-01) — 옛 [duck,beef,chicken]
    )
  })

  it('오리 알레르기 → 오리 제외', () => {
    const r = selectSafeRecipes(['duck'])
    assert.ok(!r.some((x) => x.protein === 'duck'))
    assert.deepEqual(
      r.map((x) => x.protein),
      ['pork', 'chicken', 'beef'], // 티저 순서 정렬(2026-08-01)
    )
  })

  it('반환 목록에는 알레르기 단백질이 절대 없다', () => {
    const allergies = ['chicken', 'beef']
    const r = selectSafeRecipes(allergies)
    for (const x of r) {
      assert.ok(!allergies.includes(x.protein), `${x.protein} 는 알레르겐인데 추천됨`)
    }
  })

  it('★4종 단백질 전부 알레르기 → 빈 배열(가짜 폴백 금지)', () => {
    const r = selectSafeRecipes([...WEB_RECIPE_ORDER])
    assert.equal(r.length, 0)
  })

  it('SKU 없는 단백질(연어·양) 알레르기는 후보 4종에 영향 없음', () => {
    const r = selectSafeRecipes(['salmon', 'lamb'])
    assert.equal(r.length, 3)
    assert.deepEqual(
      r.map((x) => x.protein),
      ['duck', 'pork', 'chicken'], // 티저 순서 정렬(2026-08-01)
    )
  })

  it('max 상한 적용', () => {
    assert.equal(selectSafeRecipes([], 2).length, 2)
    assert.equal(selectSafeRecipes([], 1).length, 1)
  })
})

it('★ 카드 순서 = 티저 추천 순서 (같은 화면에서 두 정본 금지)', () => {
  /**
   * 2026-08-01 전수 검수에서 발견: 결과 화면이 "추천 단백질 오리·돼지"(티저)와
   * 카드 오리·소·닭(여기)을 **한 화면에** 보여줬다 — 우선순위 배열이 두 파일에
   * 따로 살아서다. 티저의 PROTEIN_ORDER 에서 SKU 있는 단백질만 남긴 것이
   * 정확히 WEB_RECIPE_ORDER 여야 한다.
   */
  const TEASER_ORDER = ['duck', 'pork', 'chicken', 'beef'] // lib/start-teaser.ts PROTEIN_ORDER
  assert.deepEqual(
    WEB_RECIPE_ORDER,
    TEASER_ORDER,
    'web-recipes 카드 순서가 start-teaser 추천 순서와 다르다 — 결과 화면 한 장에서 ' +
      '"돼지를 추천한다면서 돼지 카드가 없는" 상태가 된다',
  )
})

describe('kcal 정합 — 웹과 앱', () => {
  it('★웹이 보여주는 kcal 은 앱 정본과 같다 (두 화면이 다른 숫자를 말하던 회귀)', () => {
  /**
   * 2026-08-05: 웹이 v3.1 시절 값(닭115·오리120·돼지115·소120)을 상수로 들고
   * 있었고 앱 정본은 v4.0(닭130·오리125·돼지125·소145)이었다. FdRecipeSheet 가
   * 그 숫자를 웹 방문자에게 그대로 렌더했으니 **같은 레시피를 두 화면이 다르게
   * 말하고 있었다** — "v4.0 전부 반영완료"에서 빠진 지점.
   * 이제 web-recipes 는 SKU_MODEL 에서 읽는다. 이 테스트가 그 연결을 지킨다.
   */
  for (const key of WEB_RECIPE_ORDER) {
    const web = WEB_RECIPES[key]
    const canonical = SKU_MODEL[key].profile.kcalPer100g
    assert.equal(
      web.kcalPer100g,
      canonical,
      `${key}: 웹 ${web.kcalPer100g} vs 정본 ${canonical}`,
    )
  }
  })

  it('v4.0 실제 값인지 — 옛 115/120 이 남아 있지 않다', () => {
  assert.equal(WEB_RECIPES.chicken.kcalPer100g, 130)
  assert.equal(WEB_RECIPES.duck.kcalPer100g, 125)
  assert.equal(WEB_RECIPES.pork.kcalPer100g, 125)
  assert.equal(WEB_RECIPES.beef.kcalPer100g, 145)
  })
})
