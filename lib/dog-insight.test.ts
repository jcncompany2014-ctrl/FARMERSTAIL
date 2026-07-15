/**
 * dog-insight 단위 테스트 — 개요 인사이트 멘트.
 *
 * 핵심 회귀 방지:
 *  1. 상황별로 다른 situation/tone 이 나온다(멘트가 늘 똑같으면 안 됨).
 *  2. 같은 입력 → 같은 문구 (SSR 하이드레이션 안전).
 *  3. 기록이 쌓이면 같은 상황 안에서도 문구가 돌아간다.
 *  4. 재설문 노트는 최근 설문일 때만 붙는다.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildDogInsight, type InsightWeightLog } from './dog-insight.ts'

const DAY = 86_400_000
const NOW = new Date('2026-07-15T00:00:00.000Z')

function log(daysAgo: number, weight: number): InsightWeightLog {
  return {
    weight,
    measured_at: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
  }
}

function build(logs: InsightWeightLog[], extra = {}) {
  return buildDogInsight({ dogName: '푸린', weightLogs: logs, now: NOW, ...extra })
}

describe('buildDogInsight — 기록이 부족할 때', () => {
  it('기록 0건 → 기록을 권한다', () => {
    const r = build([])
    assert.equal(r.situation, 'no_log')
    assert.equal(r.tone, 'prompt')
    assert.match(r.headline, /푸린이/)
  })

  it('기록 1건 → 첫 기록 안내', () => {
    const r = build([log(2, 5.0)])
    assert.equal(r.situation, 'first_log')
    assert.match(r.headline, /5kg|5\.0kg/)
  })

  it('기록이 촘촘해 비교 간격이 안 나오면 → 첫 기록 취급', () => {
    const r = build([log(0, 5.0), log(1, 5.0), log(2, 5.0)])
    assert.equal(r.situation, 'first_log')
  })

  it('0kg·NaN 같은 잘못된 기록은 무시한다', () => {
    const r = build([log(2, 0), log(30, Number.NaN)])
    assert.equal(r.situation, 'no_log')
  })
})

describe('buildDogInsight — 오래된 기록', () => {
  it('마지막 기록이 21일보다 오래되면 → stale', () => {
    const r = build([log(40, 5.0), log(70, 5.0)])
    assert.equal(r.situation, 'stale')
    assert.equal(r.tone, 'prompt')
    assert.match(r.headline, /6주 전/)
  })

  it('21일 이내면 stale 이 아니다', () => {
    const r = build([log(14, 5.0), log(42, 5.0)])
    assert.notEqual(r.situation, 'stale')
  })
})

describe('buildDogInsight — 체중 변화 방향', () => {
  it('변화 2% 미만 → stable(good)', () => {
    const r = build([log(1, 5.0), log(29, 5.0)])
    assert.equal(r.situation, 'stable')
    assert.equal(r.tone, 'good')
    assert.match(r.headline, /4주째/)
  })

  it('2~5% 증가 → gain_slight, 사장님 예시 문구("살짝")', () => {
    const r = build([log(1, 5.15), log(29, 5.0)]) // +3%
    assert.equal(r.situation, 'gain_slight')
    assert.equal(r.tone, 'neutral')
    assert.match(r.headline, /살짝 통통/)
  })

  it('5% 이상 증가 → gain_notable(watch)', () => {
    const r = build([log(1, 5.5), log(29, 5.0)]) // +10%
    assert.equal(r.situation, 'gain_notable')
    assert.equal(r.tone, 'watch')
    assert.match(r.headline, /0\.5kg 늘었/)
  })

  it('2~5% 감소 → loss_slight', () => {
    const r = build([log(1, 4.85), log(29, 5.0)]) // -3%
    assert.equal(r.situation, 'loss_slight')
    assert.equal(r.tone, 'neutral')
  })

  it('5% 이상 감소 → loss_notable(watch)', () => {
    const r = build([log(1, 4.5), log(29, 5.0)]) // -10%
    assert.equal(r.situation, 'loss_notable')
    assert.equal(r.tone, 'watch')
    assert.match(r.headline, /0\.5kg 줄었/)
  })

  it('순변화는 없지만 오르내림이 크면 → swing', () => {
    const r = build([log(1, 5.0), log(10, 5.35), log(20, 4.9), log(29, 5.0)])
    assert.equal(r.situation, 'swing')
  })
})

describe('buildDogInsight — 결정성 / 문구 회전', () => {
  it('같은 입력이면 항상 같은 문구 (하이드레이션 안전)', () => {
    const logs = [log(1, 5.0), log(29, 5.0)]
    const a = build(logs)
    const b = build(logs)
    assert.deepEqual(a, b)
  })

  it('같은 상황이라도 기록 수가 다르면 문구가 달라진다', () => {
    const a = build([log(1, 5.0), log(29, 5.0)])
    const b = build([log(1, 5.0), log(15, 5.0), log(29, 5.0)])
    assert.equal(a.situation, b.situation)
    assert.notEqual(a.body, b.body)
  })
})

describe('buildDogInsight — 재설문 노트', () => {
  it('최근 설문이면 BCS 정보를 덧붙인다', () => {
    const r = build([log(1, 5.0), log(29, 5.0)], {
      lastSurveyAt: new Date(NOW.getTime() - 3 * DAY).toISOString(),
      bcs: 6,
    })
    assert.ok(r.surveyNote)
    assert.match(r.surveyNote!, /3일 전/)
    assert.match(r.surveyNote!, /살짝 통통/)
    assert.match(r.surveyNote!, /BCS 6\/9/)
  })

  it('30일 넘은 설문이면 노트 없음', () => {
    const r = build([log(1, 5.0), log(29, 5.0)], {
      lastSurveyAt: new Date(NOW.getTime() - 60 * DAY).toISOString(),
      bcs: 6,
    })
    assert.equal(r.surveyNote, undefined)
  })

  it('설문 이력이 없으면 노트 없음', () => {
    const r = build([log(1, 5.0), log(29, 5.0)])
    assert.equal(r.surveyNote, undefined)
  })

  it('BCS 가 없어도 재설문 사실은 알린다', () => {
    const r = build([log(1, 5.0), log(29, 5.0)], {
      lastSurveyAt: new Date(NOW.getTime() - 1 * DAY).toISOString(),
    })
    assert.match(r.surveyNote!, /반영/)
  })

  it('기록이 없어도(no_log) 재설문 노트는 붙는다', () => {
    const r = build([], {
      lastSurveyAt: NOW.toISOString(),
      bcs: 4,
    })
    assert.equal(r.situation, 'no_log')
    assert.match(r.surveyNote!, /오늘/)
  })
})
