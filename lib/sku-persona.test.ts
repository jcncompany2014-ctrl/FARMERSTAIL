/**
 * /compare 페르소나 칩 — **모든 칩이 판매 4종 안에서 답을 내야 한다.**
 *
 * 사장님 2026-07-15: "이거 지금 이제 노령 안 뜨니까 없애고 차라리 다이어트랑
 * 기호성 부분을 넣어."
 *
 * 왜 났던 버그인가: '노령' 칩은 연어(EPA/DHA)만 가리켰는데 연어를 화면에서 빼면서
 * 고를 SKU 가 0개가 됐다 → 누르면 차트가 통째로 빔. 칩을 추가·수정할 때마다
 * 같은 사고가 날 수 있어 여기서 못박는다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  recommendByPersona,
  SKU_NUTRITION,
  type SkuPersona,
} from './sku-nutrition-matrix.ts'
import type { SkuKey } from './allergy-sku-matrix.ts'

/** /compare 가 실제로 보여주는 SKU (연어 S03 제외 — 준비중). */
const DISPLAYED: SkuKey[] = ['C01', 'D02', 'P04', 'B05']

const ALL_PERSONAS: SkuPersona[] = [
  'beginner',
  'diet',
  'allergy',
  'active',
  'sensitive',
  'palatability',
]

describe('페르소나 칩 — 빈 결과가 없다', () => {
  it('모든 칩이 판매 4종 중 최소 1종을 고른다', () => {
    for (const p of ALL_PERSONAS) {
      const hits = recommendByPersona(p).filter((s) => DISPLAYED.includes(s))
      assert.ok(hits.length > 0, `'${p}' 칩이 4종 중 아무것도 못 고름 → 차트가 빔`)
    }
  })

  it("'노령'은 더 이상 존재하지 않는다 (연어 전용이라 폐기)", () => {
    const personas = new Set(
      Object.values(SKU_NUTRITION).flatMap((r) => r.persona as string[]),
    )
    assert.ok(!personas.has('senior'), 'senior 페르소나가 되살아남')
  })

  it('준비중인 연어(S03)에는 칩이 붙어 있지 않다', () => {
    assert.deepEqual(SKU_NUTRITION.S03.persona, [])
  })
})

describe('페르소나 칩 — 매핑이 실제 수치와 맞는다', () => {
  it("'다이어트' → 4종 중 지방이 가장 낮은 SKU 를 고른다", () => {
    const picks = recommendByPersona('diet').filter((s) => DISPLAYED.includes(s))
    const lowestFat = DISPLAYED.reduce((a, b) =>
      SKU_NUTRITION[a].fat_pct <= SKU_NUTRITION[b].fat_pct ? a : b,
    )
    assert.ok(
      picks.includes(lowestFat),
      `다이어트 추천(${picks.join(',')})에 지방 최저(${lowestFat})가 없다`,
    )
  })

  it("'활동多' → 고른 SKU 는 단백질이 국제 최소(18%)를 크게 넘는다", () => {
    for (const s of recommendByPersona('active').filter((x) =>
      DISPLAYED.includes(x),
    )) {
      assert.ok(SKU_NUTRITION[s].protein_pct > 18)
    }
  })

  it("'기호성' → 2종 이상 (한 가지만 밀지 않는다)", () => {
    const picks = recommendByPersona('palatability').filter((s) =>
      DISPLAYED.includes(s),
    )
    assert.ok(picks.length >= 2, `기호성 추천이 ${picks.length}종뿐`)
  })
})
