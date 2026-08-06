import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { withHonorific } from '../korean.ts'

/**
 * 메일 인사말의 호칭 (2026-08-07 문구 감사).
 *
 * 템플릿들이 `${recipientName}님` 으로 직접 붙이고 있었다. 그러면:
 *   · 이름이 이미 '님' 으로 끝나면 → "김철수님님"
 *   · 영문 이름이면 → "John님"
 * `lib/korean` 의 withHonorific() 이 그 두 경우를 이미 처리한다 — 정본이 있는데
 * 메일만 안 쓰고 있었다.
 */

test('withHonorific — 님이 두 번 붙지 않는다', () => {
  assert.equal(withHonorific('김철수'), '김철수님')
  assert.equal(withHonorific('김철수님'), '김철수님')
})

test('withHonorific — 영문 이름엔 님을 붙이지 않는다', () => {
  assert.equal(withHonorific('John'), 'John')
  assert.equal(withHonorific('Mary Jane'), 'Mary Jane')
})

test('withHonorific — 빈 값은 빈 문자열', () => {
  assert.equal(withHonorific(''), '')
  assert.equal(withHonorific('   '), '')
  assert.equal(withHonorific(null), '')
  assert.equal(withHonorific(undefined), '')
})

test('★메일 템플릿이 님을 직접 붙이지 않는다', () => {
  const dir = join(import.meta.dirname, 'templates')
  const offenders: string[] = []
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.ts') || f.includes('.test.')) continue
    const src = readFileSync(join(dir, f), 'utf8')
    // `${...recipientName...}님` / `${...name...}님` 형태
    for (const m of src.matchAll(/\$\{[^}]*[Nn]ame[^}]*\}님/g)) {
      offenders.push(`${f} (${m[0]})`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    '메일이 이름 뒤에 님을 직접 붙인다 — 이름이 님으로 끝나면 "님님", ' +
      '영문 이름이면 "John님" 이 된다. withHonorific() 을 쓸 것. ' +
      offenders.join(' / '),
  )
})
