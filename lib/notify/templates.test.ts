import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ALIMTALK_MAX_CHARS,
  ALIMTALK_TEMPLATES,
  maskPhone,
  renderAlimtalk,
  templateVariables,
  type AlimtalkTemplateCode,
} from './templates.ts'

const codes = Object.keys(ALIMTALK_TEMPLATES) as AlimtalkTemplateCode[]

describe('알림톡 템플릿 — 카카오 심사 규칙', () => {
  it('코드와 키가 같고, 버전 접미사(_V숫자)가 있다 — 승인 후 수정 불가라 새 버전으로만 바꾼다', () => {
    for (const c of codes) {
      assert.equal(ALIMTALK_TEMPLATES[c].code, c)
      assert.match(c, /_V\d+$/)
    }
  })
  it('버튼명엔 변수가 없고, 웹링크는 우리 도메인 https 만', () => {
    for (const c of codes) {
      for (const b of ALIMTALK_TEMPLATES[c].buttons) {
        assert.doesNotMatch(b.name, /#\{/, `${c} 버튼명에 변수`)
        if (b.type === 'WL') assert.match(b.url, /^https:\/\/www\.farmerstail\.kr\//, `${c} 링크`)
      }
    }
  })
  it('변수만으로 된 템플릿은 없고, 긴 값을 넣어도 1,000자 이내', () => {
    for (const c of codes) {
      const t = ALIMTALK_TEMPLATES[c]
      const names = templateVariables(t.body)
      assert.ok(t.body.replace(/#\{[^}]+\}/g, '').trim().length > 20, `${c} 고정 문구가 너무 적다`)
      const long = Object.fromEntries(names.map((n) => [n, '가'.repeat(40)]))
      const r = renderAlimtalk(c, long)
      assert.ok(r.ok, `${c} 렌더 실패`)
      if (r.ok) assert.ok(r.text.length <= ALIMTALK_MAX_CHARS)
    }
  })
  it('정보성만 — 광고·유도 문구와 "언제든 해지" 과약속이 없다', () => {
    for (const c of codes) {
      const b = ALIMTALK_TEMPLATES[c].body
      assert.doesNotMatch(b, /쿠폰|할인|리뷰|이벤트|추천|앱 설치|구매하세요|광고/, `${c} 광고성 표현`)
      assert.doesNotMatch(b, /언제든/, `${c} 언제든`)
    }
  })
  it('배송조회(DS) 버튼이 있는 템플릿은 본문에 택배사·송장번호가 있다', () => {
    for (const c of codes) {
      const t = ALIMTALK_TEMPLATES[c]
      if (t.buttons.some((b) => b.type === 'DS')) {
        assert.match(t.body, /택배사: #\{택배사\}/)
        assert.match(t.body, /송장번호: #\{송장번호\}/)
      }
    }
  })
})

describe('알림톡 렌더', () => {
  it('빠진 값·빈 값이 있으면 보내지 않는다', () => {
    const r = renderAlimtalk('SHIPPED_V1', { 이름: '민지', 택배사: '', 송장번호: '1234' })
    assert.equal(r.ok, false)
    if (!r.ok) assert.deepEqual(r.missing, ['택배사'])
  })
  it('채우면 솔라피 형식 변수와 치환된 본문', () => {
    const r = renderAlimtalk('SHIPPED_V1', { 이름: '민지', 택배사: 'CJ대한통운', 송장번호: '123456789012' })
    assert.ok(r.ok)
    if (r.ok) {
      assert.equal(r.variables['#{이름}'], '민지')
      assert.match(r.text, /송장번호: 123456789012/)
      assert.doesNotMatch(r.text, /#\{/)
    }
  })
  it('번호 마스킹', () => {
    assert.equal(maskPhone('01012345678'), '010-****-5678')
    assert.equal(maskPhone('010-1234-5678'), '010-****-5678')
    assert.equal(maskPhone('12'), '***')
  })
})
