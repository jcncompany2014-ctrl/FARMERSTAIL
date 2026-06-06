/**
 * 추천 v3 catalog — 데이터 모델 + 정직성 가드 테스트.
 *
 * 핵심: 효능 문구가 데이터(마스터레시피 충족률)·사료법에서 벗어나지 못하게
 * 박제. T1("풍부")은 충족률 ≥250% 근거 필수, 질병 치료·예방 표방 금지.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BASE_SKUS, FUNCTIONAL_SOURCES, BASE_SKU_BY_ID } from './catalog.ts'

describe('추천v3 catalog — 데이터 모델 정합', () => {
  it('베이스 SKU 4종 (연어 제외)', () => {
    assert.equal(BASE_SKUS.length, 4)
    const proteins = BASE_SKUS.map((s) => s.protein).sort()
    assert.deepEqual(proteins, ['beef', 'chicken', 'duck', 'pork'])
    assert.ok(
      !BASE_SKUS.some((s) => (s.protein as string) === 'salmon'),
      '연어는 베이스에서 제외(추후 출시 SKU)',
    )
  })

  it('id 가 현 활성 제품 slug 와 일치', () => {
    const ids = BASE_SKUS.map((s) => s.id).sort()
    assert.deepEqual(ids, [
      'beef-premium',
      'chicken-basic',
      'duck-weight',
      'pork-joint',
    ])
    assert.equal(BASE_SKU_BY_ID['pork-joint']?.protein, 'pork')
  })

  it('모든 claim 의 grade 가 유효 등급', () => {
    const valid = new Set(['T1', 'T2', 'T3', 'positioning'])
    for (const s of BASE_SKUS) {
      assert.ok(s.claims.length > 0, `${s.protein} claim 존재`)
      for (const c of s.claims) {
        assert.ok(valid.has(c.grade), `${s.protein} "${c.text}" 등급 유효`)
        assert.ok(c.basis.length > 0, `${s.protein} "${c.text}" 근거 명시`)
      }
    }
  })

  it('🚫 질병 치료·예방 표방 문구 없음 (사료법)', () => {
    const forbidden = /치료|예방|완치|낫게|질병|개선해|효과가 있습니다|증상/
    for (const s of BASE_SKUS) {
      for (const c of s.claims) {
        assert.ok(
          !forbidden.test(c.text),
          `${s.protein} "${c.text}" — 금지 표현 없음`,
        )
      }
    }
  })

  it('T1("풍부") claim 은 충족률 ≥250% 근거를 가짐', () => {
    for (const s of BASE_SKUS) {
      for (const c of s.claims) {
        if (c.grade !== 'T1') continue
        const pcts = [...c.basis.matchAll(/(\d+)%/g)].map((m) => Number(m[1]))
        assert.ok(pcts.length > 0, `${s.protein} T1 "${c.text}" 충족률 명시 필요`)
        assert.ok(
          Math.max(...pcts) >= 250,
          `${s.protein} T1 "${c.text}" 충족률 ≥250% (현재 ${pcts.join(',')})`,
        )
      }
    }
  })

  it('소(beef) 철·아연을 "풍부"(T1)로 단정하지 않음 — 정직성 교정', () => {
    const beef = BASE_SKUS.find((s) => s.protein === 'beef')!
    const t1 = beef.claims.filter((c) => c.grade === 'T1').map((c) => c.text).join(' ')
    assert.ok(
      !/철.*풍부|철분.*풍부|아연.*풍부/.test(t1),
      '소 철·아연 충족률 164%·165% < 250% → "풍부" T1 금지(헴철은 형태 T2)',
    )
  })

  it('돼지 B1·소 B12 풍부 claim 이 실제로 존재 (검증된 강점)', () => {
    const pork = BASE_SKUS.find((s) => s.protein === 'pork')!
    const beef = BASE_SKUS.find((s) => s.protein === 'beef')!
    assert.ok(
      pork.claims.some((c) => c.grade === 'T1' && c.text.includes('B1')),
      '돼지 B1 풍부 T1',
    )
    assert.ok(
      beef.claims.some((c) => c.grade === 'T1' && c.text.includes('B12')),
      '소 B12 풍부 T1',
    )
  })

  it('소스 4종 — 전부 coming_soon, concern 4종 커버', () => {
    assert.equal(FUNCTIONAL_SOURCES.length, 4)
    assert.ok(
      FUNCTIONAL_SOURCES.every((s) => s.status === 'coming_soon'),
      '현재 소스 미출시',
    )
    const concerns = FUNCTIONAL_SOURCES.map((s) => s.targetConcern).sort()
    assert.deepEqual(concerns, ['digestion', 'immune', 'joint', 'skin'])
  })
})
