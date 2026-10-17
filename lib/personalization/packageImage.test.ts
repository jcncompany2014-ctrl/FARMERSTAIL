import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  FRESH_BOWL_IMAGE,
  studioPouchImage,
  studioPouchImageForLine,
} from './packageImage.ts'

const ROOT = join(import.meta.dirname, '..', '..')

describe('studioPouchImage — 스튜디오 파우치 컷 (사장님 2026-10-02 앱 레시피 시트)', () => {
  test('단백질 → 스튜디오 컷 (pork=흑돼지·beef=한우 파일명)', () => {
    assert.equal(studioPouchImage('chicken'), '/pouch-chicken.webp')
    assert.equal(studioPouchImage('duck'), '/pouch-duck.webp')
    assert.equal(studioPouchImage('pork'), '/pouch-blackpork.webp')
    assert.equal(studioPouchImage('beef'), '/pouch-hanwoo.webp')
  })
  test('라인 → 스튜디오 컷 (skin=연어·null → null)', () => {
    assert.equal(studioPouchImageForLine('weight'), '/pouch-chicken.webp')
    assert.equal(studioPouchImageForLine('basic'), '/pouch-duck.webp')
    assert.equal(studioPouchImageForLine('joint'), '/pouch-blackpork.webp')
    assert.equal(studioPouchImageForLine('premium'), '/pouch-hanwoo.webp')
    assert.equal(studioPouchImageForLine('skin'), null)
    assert.equal(studioPouchImageForLine(null), null)
    assert.equal(studioPouchImage('salmon'), null)
    assert.equal(studioPouchImage(undefined), null)
  })
  test('★반환 경로의 파일이 실제로 존재한다 (404 방지)', () => {
    for (const p of ['chicken', 'duck', 'pork', 'beef']) {
      const url = studioPouchImage(p)!
      const file = join(ROOT, 'public', url.replace(/^\//, ''))
      assert.ok(existsSync(file), `${url} 파일 없음`)
    }
  })
})

describe('FRESH_BOWL_IMAGE — 사장님 실촬영 그릇 한 장(4종 공용·연어 폴백)', () => {
  test('★파일이 실제로 존재한다 (404 방지)', () => {
    assert.ok(existsSync(join(ROOT, 'public', FRESH_BOWL_IMAGE.replace(/^\//, ''))), `${FRESH_BOWL_IMAGE} 파일 없음`)
  })
})
