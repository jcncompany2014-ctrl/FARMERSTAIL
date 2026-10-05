import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plainTrigger, isPlainCustomerText } from './plain-reason.ts'

test('실제 DB 에 저장돼 고객에게 나가던 표기가 쉬운 말이 된다', () => {
  assert.equal(plainTrigger('12개월 미만 puppy'), '12개월 미만 아기 강아지')
  assert.equal(plainTrigger('6개월 체중 감소 + BCS 정상'), '6개월 체중 감소 + 체형 정상')
  assert.equal(plainTrigger('BCS 7/9 (과체중)'), '체형: 과체중')
  assert.equal(plainTrigger('대형견 puppy (성견 30kg 예상, 6개월)'), '대형견 아기 강아지 (성견 30kg 예상, 6개월)')
  assert.equal(plainTrigger('만성 신장질환 (IRIS Stage 4 — 심한 azotemia)'), '만성 신장질환 (4단계 — 신장 수치가 많이 높음)')
  assert.equal(plainTrigger('심장병 / DCM 진단'), '심장병 진단')
  assert.equal(plainTrigger("Cushing's (부신피질항진증)"), '쿠싱(부신피질항진증)')
  assert.equal(plainTrigger('케어 목표 = 체중 관리'), '케어 목표: 체중 관리')
  assert.equal(plainTrigger('2주차 변 #6 (무름)'), '2주차 변 (무름)')
})

test('바꾼 뒤엔 고객 화면에 그려도 되는 말이다 — 엔진의 알려진 임상 표기 전부', () => {
  const engineTriggers = [
    '12개월 미만 puppy', '대형견 puppy (성견 25kg 예상, 5개월)', 'BCS 8/9 (비만)', 'BCS 1/9 (응급 — 심한 저체중)',
    '6개월 체중 증가 + BCS 6+', '6개월 체중 감소 + BCS 과체중', '만성 신장질환 (IRIS Stage 2)',
    '만성 신장질환 (입력값 7 비정상 — Stage 1-4 만 유효, 보수적 처방)', '만성 신장질환 (stage 미진단 — 보수적)',
    '염증성 장질환 (IBD)', 'IBD + 위장 적응', '심장병 / DCM 진단', 'MMVD 진단', 'EPI (외분비 췌장 부전)',
    '인지저하증 (CDS)', "Cushing's (부신피질항진증)", '슬개골 탈구 / IVDD', 'CKD + 관절염 동시',
    '활동량 high · 산책 70분', '활동량 low', '4주차 변 #7 (무름)',
  ]
  for (const t of engineTriggers) {
    const p = plainTrigger(t)
    assert.ok(isPlainCustomerText(p), `아직 전문 표기가 남았다: ${t} → ${p}`)
    assert.equal(plainTrigger(p), p, `두 번 바꾸면 달라진다: ${t}`)
  }
})

test('문헌 인용·영문 약어가 든 설명은 고객 화면에서 걸러진다', () => {
  assert.equal(isPlainCustomerText('DM 지방 19.2% — 목표 <15% 충족 (만성 췌장염, Xenoulis & Steiner 2008)'), false)
  assert.equal(isPlainCustomerText('저나트륨 + grain-free 시판 사료 회피 (FDA 2018-2022).'), false)
  assert.equal(isPlainCustomerText('관찰 (week_4 까지). 야채 토퍼 ↑ 권장'), false)
  assert.equal(isPlainCustomerText('변이 무른 편이라 지방이 적은 체중 관리 레시피(치킨) 쪽으로 조금 옮겼어요'), true)
})
