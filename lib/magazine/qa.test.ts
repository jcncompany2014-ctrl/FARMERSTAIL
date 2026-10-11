import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractQa } from './qa.ts'

test('매거진 문답 뽑기 — 질문 상자만, 꾸밈은 걷고 글자만', () => {
  const md = [
    ':::요약 세 줄 요약',
    '- 요약은 문답이 아니다',
    ':::',
    '',
    ':::질문 화식만 먹여야 하나요?',
    '아니요. **건사료에 곁들여** 줘도 돼요. [영양 근거](/science)에 적어 두었어요.',
    ':::',
    '',
    ':::질문 녹인 팩을 3일이 지나서 발견했어요.',
    '아깝지만 ==주지 말아== 주세요.',
    ':::',
  ].join('\n')
  assert.deepEqual(extractQa(md), [
    { question: '화식만 먹여야 하나요?', answer: '아니요. 건사료에 곁들여 줘도 돼요. 영양 근거에 적어 두었어요.' },
    { question: '녹인 팩을 3일이 지나서 발견했어요.', answer: '아깝지만 주지 말아 주세요.' },
  ])
})

test('매거진 문답 뽑기 — 윈도 줄바꿈·빈 상자·질문 없는 글', () => {
  assert.deepEqual(extractQa(':::질문 물음\r\n답이에요\r\n:::'), [{ question: '물음', answer: '답이에요' }])
  assert.deepEqual(extractQa(':::질문 물음만\n\n:::'), [])
  assert.deepEqual(extractQa('## 그냥 소제목\n본문'), [])
})
