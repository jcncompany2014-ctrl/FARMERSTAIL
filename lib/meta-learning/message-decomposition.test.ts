import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  TEMPLATES,
  selectTemplate,
  composeMessage,
} from './message-decomposition.ts'

before(() => {
  process.env.NEXT_PUBLIC_INVENTION_CORE = 'on'
  process.env.NEXT_PUBLIC_INVENTION_META_LEARNING = 'on'
})
after(() => {
  delete process.env.NEXT_PUBLIC_INVENTION_CORE
  delete process.env.NEXT_PUBLIC_INVENTION_META_LEARNING
})

describe('selectTemplate', () => {
  it('flag OFF → full fallback', () => {
    delete process.env.NEXT_PUBLIC_INVENTION_META_LEARNING
    process.env.NEXT_PUBLIC_INVENTION_CORE = 'off'
    const t = selectTemplate('emotional')
    assert.equal(t.id, 'full')
    process.env.NEXT_PUBLIC_INVENTION_CORE = 'on'
    process.env.NEXT_PUBLIC_INVENTION_META_LEARNING = 'on'
  })

  it('학습 데이터 있음 → best CTR template', () => {
    const ctr = new Map<string, number>([
      ['full', 0.1],
      ['action_only', 0.5],
      ['reward_first', 0.3],
    ])
    const t = selectTemplate('data_lover', ctr)
    assert.equal(t.id, 'action_only')
  })

  it('persona default heuristic — emotional → no_problem', () => {
    const t = selectTemplate('emotional')
    assert.equal(t.id, 'no_problem')
  })

  it('persona convenience → action_only', () => {
    const t = selectTemplate('convenience')
    assert.equal(t.id, 'action_only')
  })

  it('persona null → full', () => {
    const t = selectTemplate(null)
    assert.equal(t.id, 'full')
  })
})

describe('composeMessage', () => {
  it('template 요소 순서대로 합성', () => {
    const full = TEMPLATES.find((t) => t.id === 'full')!
    const msg = composeMessage(full, {
      intro: '안녕하세요',
      problem: '체중↑',
      evidence: '+0.5kg',
      action: '사료 5g ↓',
      reward: '1000P',
    })
    assert.match(msg, /안녕하세요/)
    assert.match(msg, /1000P/)
  })

  it('일부 part 누락 → 그 부분 skip', () => {
    const action = TEMPLATES.find((t) => t.id === 'action_only')!
    const msg = composeMessage(action, { action: '사료 5g ↓' })
    assert.equal(msg, '사료 5g ↓')
  })
})
