import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { packageImageForProtein, packageImageForLine } from './packageImage.ts'

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
