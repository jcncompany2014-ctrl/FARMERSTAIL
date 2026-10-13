import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chunkIds, selectInChunks, IN_CHUNK_SIZE } from './in-chunks.ts'

test('chunkIds: 200개씩 순서대로 나눈다', () => {
  const ids = Array.from({ length: 450 }, (_, i) => `id-${i}`)
  const chunks = chunkIds(ids)
  assert.equal(IN_CHUNK_SIZE, 200)
  assert.deepEqual(chunks.map((c) => c.length), [200, 200, 50])
  assert.deepEqual(chunks.flat(), ids)
})

test('chunkIds: 빈 목록은 묶음 0개, 잘못된 크기는 거부', () => {
  assert.deepEqual(chunkIds([]), [])
  assert.throws(() => chunkIds(['a'], 0))
})

test('selectInChunks: 묶음마다 묻고 행을 합친다', async () => {
  const ids = Array.from({ length: 401 }, (_, i) => i)
  const seen: number[] = []
  const r = await selectInChunks(ids, async (chunk) => {
    seen.push(chunk.length)
    return { data: chunk.map((n) => ({ n })), error: null }
  })
  assert.deepEqual(seen, [200, 200, 1])
  assert.equal(r.error, null)
  assert.equal(r.data?.length, 401)
})

test('selectInChunks: 한 묶음이라도 실패하면 전체 실패 — 부분 결과로 판정하지 않는다', async () => {
  const ids = Array.from({ length: 450 }, (_, i) => i)
  let calls = 0
  const r = await selectInChunks(ids, async (chunk) => {
    calls += 1
    if (calls === 2) return { data: null, error: { message: 'header too large' } }
    return { data: chunk.map((n) => ({ n })), error: null }
  })
  assert.equal(r.data, null)
  assert.equal(r.error?.message, 'header too large')
  assert.equal(calls, 2, '실패한 뒤에는 더 묻지 않는다')
})

test('selectInChunks: id 가 없으면 조회하지 않고 빈 배열', async () => {
  let calls = 0
  const r = await selectInChunks([], async () => {
    calls += 1
    return { data: [], error: null }
  })
  assert.equal(calls, 0)
  assert.deepEqual(r, { data: [], error: null })
})
