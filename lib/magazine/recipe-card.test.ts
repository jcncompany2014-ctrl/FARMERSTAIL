/**
 * 매거진 레시피 카드 — `::레시피 오리` 한 줄이 가게 상품 카드가 되는지(2026-10-11 매거진 기획).
 * 본문 변환(lib/markdown) → 카드 채우기(fillRecipeCards) 를 실제 순서대로 돌려 본다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderMarkdown } from '../markdown.ts'
import { fillRecipeCards, magazineRecipeCard } from './recipe-card.ts'
import { recipeBlockKey } from './recipe-block.ts'
import { TRIAL_ITEM, storeItem } from '../store/catalog.ts'

describe('매거진 레시피 카드', () => {
  it('이름 정리 — 한글·영어 별명 → 키, 모르는 이름은 null', () => {
    assert.equal(recipeBlockKey('오리'), 'duck')
    assert.equal(recipeBlockKey('오리고기'), 'duck')
    assert.equal(recipeBlockKey('흑돼지'), 'pork')
    assert.equal(recipeBlockKey('소고기'), 'beef')
    assert.equal(recipeBlockKey('체험팩'), 'trial')
    assert.equal(recipeBlockKey('Chicken'), 'chicken')
    assert.equal(recipeBlockKey('연어'), null)
  })

  it('본문 한 줄 → 이름표 자리(어드민 미리보기) → 글 화면 카드', () => {
    const html = renderMarkdown('첫 단락\n\n::레시피 오리\n\n둘째 단락')
    assert.match(html, /<div class="md-recipe" data-recipe="duck">레시피 카드 — 오리고기 화식<\/div>/)
    const filled = fillRecipeCards(html)
    assert.deepEqual(filled.keys, ['duck'])
    assert.ok(filled.html.includes('<a class="ftb-card" href="/store/duck">'), filled.html)
    assert.ok(!filled.html.includes('md-recipe'), '자리 표시가 남았다')
    assert.ok(filled.html.includes(`500g ${storeItem('duck-500g').price.toLocaleString('ko-KR')}원`), '가격이 가게 정본과 다르다')
  })

  it('여러 번·순서 — 나온 순서대로, 같은 레시피는 한 번만', () => {
    const html = renderMarkdown('::레시피 한우\n\n글\n\n::레시피 체험팩\n\n::레시피 한우')
    const filled = fillRecipeCards(html)
    assert.deepEqual(filled.keys, ['beef', 'trial'])
    assert.equal((filled.html.match(/class="ftb-card"/g) ?? []).length, 3, '자리마다 카드는 그려야 한다')
  })

  it('모르는 이름·문장 속은 카드로 바꾸지 않는다(실수가 글자로 보인다)', () => {
    assert.match(renderMarkdown('::레시피 연어'), /<p>::레시피 연어<\/p>/)
    assert.doesNotMatch(renderMarkdown('오늘은 ::레시피 오리 이야기'), /md-recipe/)
  })

  it('체험팩 카드 — 가게 체험팩 탭으로, 가격은 정본', () => {
    const c = magazineRecipeCard('trial')
    assert.equal(c.href, '/store?tab=trial')
    assert.equal(c.price, `${TRIAL_ITEM.price.toLocaleString('ko-KR')}원`)
  })
})
