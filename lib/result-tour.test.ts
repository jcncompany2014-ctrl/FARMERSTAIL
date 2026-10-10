/**
 * result-tour — 결과 화면 둘러보기 단계 상태(2026-10-09 앱 새 디자인 3단계, 캔버스 TR0~TR4) 회귀 테스트.
 *
 * 보호 대상:
 *   1. 시작 조건 — 설문 직후 + 그 강아지의 첫 분석 + 이 폰에서 처음 + 진행 중 아님, 넷 다일 때만
 *   2. 단계 왕복(write → read) · 끝(finish → 봤음 표식)
 *   3. 30분 지난 진행 상태는 조용히 끝낸다(며칠 뒤 홈에 안내가 갑자기 뜨지 않게)
 *   4. 깨진 값·바깥 주소(backHref)는 버린다 — '결과로 돌아가기'가 router.push 로 그 주소를 연다
 *   5. 저장소를 못 쓰면 '봤음'(= 시작 안 함) — 단계를 못 들고 다니면 홈에서 길을 잃는다
 */
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { finishTour, readTour, shouldStartTour, tourSeen, writeTour, type TourState } from './result-tour.ts'

const store = new Map<string, string>()
let broken = false
const fakeStorage = {
  getItem: (k: string) => {
    if (broken) throw new Error('blocked')
    return store.has(k) ? (store.get(k) as string) : null
  },
  setItem: (k: string, v: string) => {
    if (broken) throw new Error('blocked')
    store.set(k, String(v))
  },
  removeItem: (k: string) => {
    if (broken) throw new Error('blocked')
    store.delete(k)
  },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage
;(globalThis as unknown as { window: { localStorage: Storage } }).window = { localStorage: fakeStorage }

const base = (over: Partial<TourState> = {}): TourState => ({
  step: 'intro',
  dogName: '땅콩',
  backHref: '/dogs/abc/analysis?fromSurvey=1',
  startedAt: 1_000_000,
  ...over,
})

describe('result-tour', () => {
  beforeEach(() => {
    store.clear()
    broken = false
  })

  it('시작 조건 — 넷 다 맞을 때만 시작한다', () => {
    const ok = { fromSurvey: true, analysisCount: 1, seen: false, inProgress: false }
    assert.equal(shouldStartTour(ok), true)
    assert.equal(shouldStartTour({ ...ok, fromSurvey: false }), false, '설문 직후가 아니면(기록에서 다시 연 결과 화면) 안 뜬다')
    assert.equal(shouldStartTour({ ...ok, analysisCount: 0 }), false, '분석 수를 아직 못 읽었으면(0) 기다린다')
    assert.equal(shouldStartTour({ ...ok, analysisCount: 2 }), false, '두 번째 분석부터는 안 뜬다')
    assert.equal(shouldStartTour({ ...ok, seen: true }), false, '이 폰에서 이미 봤으면 안 뜬다')
    assert.equal(shouldStartTour({ ...ok, inProgress: true }), false, '진행 중이면 새로 시작하지 않는다')
  })

  it('단계 왕복 + 끝 표식', () => {
    writeTour(base({ step: 'record' }))
    assert.equal(readTour(1_000_000 + 60_000)?.step, 'record')
    assert.equal(tourSeen(), false)
    finishTour()
    assert.equal(readTour(1_000_000 + 60_000), null, '끝나면 진행 상태가 지워진다')
    assert.equal(tourSeen(), true, '끝나면 봤음이 남는다')
  })

  it('30분 지난 진행 상태는 끝낸 것으로 친다', () => {
    writeTour(base({ step: 'stats' }))
    assert.equal(readTour(1_000_000 + 30 * 60 * 1000 + 1), null)
    assert.equal(tourSeen(), true, '오래된 건 조용히 끝내고 다시 띄우지 않는다')
  })

  it('바깥 주소·깨진 값은 버린다', () => {
    for (const backHref of ['//evil.example/x', '/\\evil.example/x', 'https://evil.example/x', 'dogs/abc']) {
      store.set('ft_result_tour', JSON.stringify(base({ backHref })))
      assert.equal(readTour(1_000_000), null, `${backHref} 를 돌아갈 주소로 받아들였다`)
      assert.equal(store.has('ft_result_tour'), false, '버린 값은 지운다')
    }
    store.set('ft_result_tour', JSON.stringify({ ...base(), step: 'nope' }))
    assert.equal(readTour(1_000_000), null)
    store.set('ft_result_tour', '{깨진')
    assert.equal(readTour(1_000_000), null)
  })

  it('저장소를 못 쓰면 시작하지 않는다(봤음으로 친다)', () => {
    broken = true
    assert.equal(tourSeen(), true)
    assert.equal(readTour(1_000_000), null)
    writeTour(base()) // 던지지 않는다
  })
})
