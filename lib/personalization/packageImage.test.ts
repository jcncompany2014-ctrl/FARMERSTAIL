import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  packageImageForProtein,
  packageImageForLine,
  bowlImageForLine,
  FRESH_BOWL_IMAGE,
} from './packageImage.ts'

const ROOT = join(import.meta.dirname, '..', '..')

describe('packageImage — 제품 패키지 실사 경로 (사장님 2026-08-25 실촬영)', () => {
  test('4종 단백질 → 경로', () => {
    assert.equal(packageImageForProtein('chicken'), '/pkg/chicken.webp')
    assert.equal(packageImageForProtein('pork'), '/pkg/pork.webp')
    assert.equal(packageImageForProtein('duck'), '/pkg/duck.webp')
    assert.equal(packageImageForProtein('beef'), '/pkg/beef.webp')
  })
  test('wide=true → 가로판', () => {
    assert.equal(packageImageForProtein('beef', true), '/pkg/beef-wide.webp')
  })
  test('판매 안 하는 단백질·빈 값 → null (가짜 경로 금지)', () => {
    assert.equal(packageImageForProtein('salmon'), null)
    assert.equal(packageImageForProtein('lamb'), null)
    assert.equal(packageImageForProtein(null), null)
    assert.equal(packageImageForProtein(undefined), null)
  })
  test('라인 → 단백질 매핑 (skin=연어는 판매 SKU 아님 → null)', () => {
    assert.equal(packageImageForLine('weight'), '/pkg/chicken.webp')
    assert.equal(packageImageForLine('basic'), '/pkg/duck.webp')
    assert.equal(packageImageForLine('joint'), '/pkg/pork.webp')
    assert.equal(packageImageForLine('premium'), '/pkg/beef.webp')
    assert.equal(packageImageForLine('skin'), null)
    assert.equal(packageImageForLine(null), null)
  })
  test('★반환한 경로의 파일이 실제로 존재한다 (404 방지)', () => {
    for (const p of ['chicken', 'duck', 'pork', 'beef']) {
      for (const wide of [false, true]) {
        const url = packageImageForProtein(p, wide)!
        const file = join(ROOT, 'public', url.replace(/^\//, ''))
        assert.ok(existsSync(file), `${url} 파일 없음 — 화면에 깨진 이미지가 뜬다`)
      }
    }
  })
})

describe('bowlImageForLine — 레시피별 화식 그릇 (사장님 2026-08-25 "다 똑같이 생겼다")', () => {
  test('4종이 서로 다른 파일을 가리킨다', () => {
    const paths = (['weight', 'basic', 'joint', 'premium'] as const).map((l) =>
      bowlImageForLine(l),
    )
    assert.equal(new Set(paths).size, 4, '그릇 사진이 겹친다 — 구분이 안 된다')
  })
  test('라인 → 단백질 매핑이 맞다', () => {
    assert.equal(bowlImageForLine('weight'), '/bowl/chicken.webp')
    assert.equal(bowlImageForLine('basic'), '/bowl/duck.webp')
    assert.equal(bowlImageForLine('joint'), '/bowl/pork.webp')
    assert.equal(bowlImageForLine('premium'), '/bowl/beef.webp')
  })
  test('모르는 라인·null 은 공용 원본으로 폴백 (빈 화면 금지)', () => {
    assert.equal(bowlImageForLine(null), FRESH_BOWL_IMAGE)
    assert.equal(bowlImageForLine('skin'), FRESH_BOWL_IMAGE)
  })
  test('★반환 경로의 파일이 실제로 존재한다 (404 방지)', () => {
    for (const l of ['weight', 'basic', 'joint', 'premium', 'skin'] as const) {
      const file = join(ROOT, 'public', bowlImageForLine(l).replace(/^\//, ''))
      assert.ok(existsSync(file), `${bowlImageForLine(l)} 파일 없음`)
    }
  })
})
